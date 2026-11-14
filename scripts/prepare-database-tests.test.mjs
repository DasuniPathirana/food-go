import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, link, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { prepareDatabaseTest, prepareTestFile, splitSqlStatements, sqlTokens } from "./prepare-database-tests.mjs";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const suite = (assertions = "select ok(true, 'example');", plan = 1) =>
  `begin; select plan(${plan}); ${assertions} select * from finish(); rollback;`;
const outerWords = statement => sqlTokens(statement)
  .filter(token => token.depth === 0 && token.kind === "word").map(token => token.value);

test("SQL splitting preserves semicolons and transaction words inside strings, identifiers and nested comments", () => {
  const source = String.raw`-- commit; begin;
    begin;
    /* outer ; /* nested rollback; */ still comment */
    select 'a; ''quoted'' value', E'escaped\'; string', "column;name";
    do $outer$ begin perform 'inside;'; -- inner comment;
      perform $inner$commit; rollback;$inner$;
    end; $outer$;
    rollback; -- ignored trailing ;
  `;
  const statements = splitSqlStatements(source);
  assert.equal(statements.length, 4);
  assert.deepEqual(outerWords(statements[0]), ["begin"]);
  assert.deepEqual(outerWords(statements[3]), ["rollback"]);
  assert.ok(statements[1].includes("'a; ''quoted'' value'"));
  assert.ok(statements[2].includes("perform $inner$commit; rollback;$inner$"));
});

test("SQL lexer rejects interrupted quotes, blocks, parentheses and incomplete trailing SQL", () => {
  for (const source of [
    "begin; select 'unfinished; rollback;",
    'begin; select "unfinished; rollback;',
    "begin; do $tag$ missing close; rollback;",
    "begin; /* nested /* unfinished */ rollback;",
    "begin; select (1; rollback;",
    "begin; select 1); rollback;",
    "begin; select 1; rollback",
    "begin; select '\0'; rollback;",
  ]) assert.throws(() => splitSqlStatements(source), Error, source);
});

test("TAP capture retains data-changing CTEs at statement top and captures SETOF finish without nesting", () => {
  const source = suite(`
    with changed as (update public.profiles set display_name = 'example' returning id)
    select is((select count(*) from changed), 0::bigint, 'no cross-user update');
  `);
  const prepared = prepareDatabaseTest(source, "cte-suite");
  const statements = splitSqlStatements(prepared.sql);
  const cte = statements.find(statement => outerWords(statement)[0] === "with");
  assert.ok(cte);
  const words = outerWords(cte);
  assert.ok(words.indexOf("insert") < words.indexOf("select"));
  assert.match(cte, /with changed as \(update public\.profiles[\s\S]*?\)\s*insert into pg_temp\.food_go_tap_results/u);
  assert.ok(cte.includes("select count(*) from changed"));
  const finish = statements.find(statement => statement.includes("'finish'") && statement.includes("from finish()"));
  assert.ok(finish);
  assert.match(finish, /select 'cte-suite', 'finish', \d+,\s*\* from finish\(\)/u);
  assert.doesNotMatch(prepared.sql, /select \* from \(with|create (?:temporary )?table[^;]+as\s*with/iu);
});

test("only complete rollback-only suites with one literal matching plan and finish are prepared", () => {
  for (const source of [
    suite().replace("begin;", ""),
    suite().replace("rollback;", "commit;"),
    suite().replace("rollback;", ""),
    suite().replace("select plan(1);", "select plan(1); commit; begin;"),
    suite().replace("select plan(1);", "select plan(1); savepoint fixture;"),
    suite().replace("select plan(1);", "select plan(1); select plan(1);"),
    suite().replace("select plan(1);", "select plan(1 + 0);"),
    suite().replace("select plan(1);", "select plan(0);"),
    suite().replace("select * from finish();", ""),
    suite().replace("select * from finish();", "select * from finish(); select * from finish();"),
    suite("select ok(true);", 2),
    suite("select ok(true); select ok(true);", 1),
  ]) assert.throws(() => prepareDatabaseTest(source), Error, source);
});

test("reviewed fixture DDL and grants remain inside the original transaction, with guard before rollback and evidence after", () => {
  const source = suite(`
    create table public.test_fixture(id integer);
    grant select on public.test_fixture to anon;
    do $fixture$ begin perform 'commit; is only a string'; end; $fixture$;
    select extensions.throws_ok('select * from private.example', '42501', null, 'denied');
  `);
  const statements = splitSqlStatements(prepareDatabaseTest(source, "quoted' suite").sql);
  const first = outerWords(statements[0]);
  assert.deepEqual(first, ["begin"]);
  const rollback = statements.findIndex(statement => outerWords(statement).join(" ") === "rollback");
  assert.equal(rollback, statements.length - 2);
  assert.ok(statements.findIndex(statement => statement.includes("$food_go_tap_guard$")) < rollback);
  assert.ok(statements.findIndex(statement => statement.includes("grant select on public.test_fixture")) < rollback);
  assert.ok(statements.at(-1).includes("to_regclass('pg_temp.food_go_tap_results') is null"));
  assert.ok(statements.at(-1).includes("'quoted'' suite'"));
  assert.equal(statements.filter(statement => outerWords(statement)[0] === "commit").length, 0);
});

test("all checked-in suites capture every planned assertion without altering their top-level fixture statements", async () => {
  for (const [name, count, cteCount] of [["tenant_isolation", 27, 3], ["partner_drafts", 29, 0], ["community", 46, 0], ["social_xp", 83, 0]]) {
    const source = await readFile(new URL(`../supabase/tests/${name}.test.sql`, import.meta.url), "utf8");
    const prepared = prepareDatabaseTest(source, name);
    assert.equal(prepared.expectedAssertions, count, name);
    assert.equal(prepared.assertionStatements, count, name);
    const originalStatements = splitSqlStatements(source);
    const generatedStatements = splitSqlStatements(prepared.sql);
    assert.equal(generatedStatements.filter(statement => outerWords(statement)[0] === "with").length, cteCount, name);
    for (const statement of originalStatements) {
      const first = outerWords(statement)[0];
      if (!["select", "with", "begin", "rollback"].includes(first))
        assert.ok(prepared.sql.includes(statement), `${name} fixture statement must be preserved`);
    }
  }
});

test("file preparation refuses source overwrite through filesystem aliases and output escapes", async () => {
  await mkdir(join(workspace, "artifacts"), { recursive: true });
  const temporary = await mkdtemp(join(workspace, "artifacts", "tap-harness-test-"));
  try {
    const source = join(temporary, "source.test.sql");
    const alias = join(temporary, process.platform === "win32" ? "SOURCE.TEST.sql" : "output.sql");
    const sql = suite();
    await writeFile(source, sql, "utf8");
    // Windows case aliases need no special link privilege; other platforms use
    // a hardlink to exercise the same-file check independently of path spelling.
    if (process.platform !== "win32") await link(source, alias);
    await assert.rejects(prepareTestFile(source, alias, workspace), /distinct/u);
    assert.equal(await readFile(source, "utf8"), sql);
    await assert.rejects(prepareTestFile(source, join(dirname(workspace), "outside.sql"), workspace), /inside/u);
    const output = join(temporary, "prepared", "valid.sql");
    const result = await prepareTestFile(source, output, workspace);
    assert.equal(result.preparedOnly, true);
    assert.equal(result.assertions, 1);
    assert.ok((await readFile(output, "utf8")).includes("food_go_database_test"));
  } finally {
    const checked = relative(workspace, temporary);
    assert.ok(checked && !checked.startsWith("..") && !isAbsolute(checked));
    await rm(temporary, { recursive: true, force: true });
  }
});
