import { readFile, writeFile, mkdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const assertions = new Set(["is", "ok", "throws_ok", "lives_ok"]);
const collector = "pg_temp.food_go_tap_results";

/** A lexer for the repository's SQL scripts, not a general PostgreSQL parser. */
export function sqlTokens(source) {
  const tokens = [];
  let position = 0;
  let depth = 0;
  while (position < source.length) {
    const start = position;
    const char = source[position];
    if (/\s/u.test(char)) { position++; continue; }
    if (source.startsWith("--", position)) {
      const end = source.indexOf("\n", position + 2);
      position = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith("/*", position)) {
      let comments = 1;
      position += 2;
      while (comments && position < source.length) {
        if (source.startsWith("/*", position)) { comments++; position += 2; }
        else if (source.startsWith("*/", position)) { comments--; position += 2; }
        else position++;
      }
      if (comments) throw new Error("Unterminated SQL block comment.");
      continue;
    }
    if (char === "'" || char === '"') {
      const escaped = char === "'" && /[eE]/u.test(source[position - 1] ?? "") &&
        !/[A-Za-z0-9_$]/u.test(source[position - 2] ?? "");
      position++;
      let closed = false;
      while (position < source.length) {
        if (escaped && source[position] === "\\") { position += 2; continue; }
        if (source[position] === char) {
          if (source[position + 1] === char) { position += 2; continue; }
          position++; closed = true; break;
        }
        position++;
      }
      if (!closed) throw new Error("Unterminated SQL quoted value.");
      tokens.push({ value: source.slice(start, position), kind: "quoted", start, end: position, depth });
      continue;
    }
    const tag = char === "$" ? /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u.exec(source.slice(position))?.[0] : null;
    if (tag) {
      const end = source.indexOf(tag, position + tag.length);
      if (end < 0) throw new Error("Unterminated SQL dollar-quoted value.");
      position = end + tag.length;
      tokens.push({ value: source.slice(start, position), kind: "quoted", start, end: position, depth });
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_$]*/u.exec(source.slice(position))?.[0];
    const number = /^\d+/u.exec(source.slice(position))?.[0];
    if (word || number) {
      const value = word || number;
      position += value.length;
      tokens.push({ value: value.toLowerCase(), kind: word ? "word" : "number", start, end: position, depth });
      continue;
    }
    tokens.push({ value: char, kind: "symbol", start, end: ++position, depth });
    if (char === "(") depth++;
    if (char === ")" && --depth < 0) throw new Error("Unbalanced SQL parentheses.");
  }
  if (depth) throw new Error("Unbalanced SQL parentheses.");
  return tokens;
}

export function splitSqlStatements(source) {
  if (typeof source !== "string" || source.includes("\0")) throw new Error("SQL must be text without NUL bytes.");
  const tokens = sqlTokens(source);
  const result = [];
  let start = 0;
  for (const token of tokens) {
    if (token.value === ";" && token.depth === 0) {
      const statement = source.slice(start, token.end);
      if (sqlTokens(statement).some(item => item.value !== ";")) result.push(statement);
      start = token.end;
    }
  }
  const tail = source.slice(start);
  if (sqlTokens(tail).length) throw new Error("Every SQL statement must end with a semicolon.");
  return result;
}

const literal = value => `'${String(value).replaceAll("'", "''")}'`;

function tapSelect(statement) {
  const tokens = sqlTokens(statement).filter(token => token.value !== ";");
  const first = tokens[0]?.value;
  if (first !== "select" && first !== "with") return null;
  const selectIndex = tokens.findIndex(token => token.depth === 0 && token.value === "select");
  if (selectIndex < 0) return null;
  const select = tokens[selectIndex];
  let at = selectIndex + 1;
  let finishStar = false;
  if (tokens[at]?.value === "*") {
    if (tokens[at + 1]?.value !== "from") return null;
    finishStar = true; at += 2;
  }
  // The checked-in suites use unqualified helpers; explicit extensions helpers
  // are also understood. Other schemas or expression shapes are rejected.
  if (tokens[at]?.value === "extensions" && tokens[at + 1]?.value === ".") at += 2;
  const name = tokens[at]?.value;
  if (!["plan", "finish", ...assertions].includes(name)) return null;
  if (finishStar !== (name === "finish")) throw new Error("Unsupported TAP SELECT shape.");
  const opening = tokens[at + 1];
  if (opening?.value !== "(") throw new Error("Unsupported TAP function call.");
  const closing = tokens.findIndex((token, index) => index > at + 1 && token.value === ")" && token.depth === opening.depth + 1);
  if (closing !== tokens.length - 1) throw new Error("TAP SELECT must contain one standalone helper call.");
  let plan;
  if (name === "plan") {
    const value = tokens[at + 2];
    if (closing !== at + 3 || value?.kind !== "number") throw new Error("TAP plan must be a literal positive integer.");
    plan = Number(value.value);
    if (!Number.isSafeInteger(plan) || plan < 1 || plan > 10000) throw new Error("TAP plan is outside the supported range.");
  }
  if (name === "finish" && closing !== at + 2) throw new Error("Only finish() without arguments is supported.");
  return { select, kind: name === "plan" ? "plan" : name === "finish" ? "finish" : "assertion", plan };
}

function failureGuard(suite, expected) {
  return `
reset role;
do $food_go_tap_guard$
declare
  planned integer;
  actual integer;
  unique_numbers integer;
  first_number integer;
  last_number integer;
begin
  select count(*) into planned from ${collector} where kind = 'plan';
  if planned <> 1 or (select output from ${collector} where kind = 'plan' limit 1) is distinct from '1..${expected}' then
    raise exception 'Food Go TAP harness: invalid plan for %', ${literal(suite)};
  end if;
  select count(*) into actual from ${collector} where kind = 'assertion';
  if actual <> ${expected} then
    raise exception 'Food Go TAP harness: expected ${expected} assertions but received % for %', actual, ${literal(suite)};
  end if;
  if exists (select 1 from ${collector} where kind = 'assertion' and (output is null or output !~ '^ok [0-9]+([[:space:]]|$)'))
    or exists (select 1 from ${collector} where output ~ '(^|[[:cntrl:]])not ok([[:space:]]|$)') then
    raise exception 'Food Go TAP harness: an assertion failed for %: %', ${literal(suite)},
      (select left(output, 1600) from ${collector} where kind = 'assertion'
        and (output is null or output !~ '^ok [0-9]+([[:space:]]|$)') limit 1);
  end if;
  select count(distinct substring(output from '^ok ([0-9]+)')::integer),
    min(substring(output from '^ok ([0-9]+)')::integer), max(substring(output from '^ok ([0-9]+)')::integer)
    into unique_numbers, first_number, last_number from ${collector} where kind = 'assertion';
  if unique_numbers <> ${expected} or first_number <> 1 or last_number <> ${expected} then
    raise exception 'Food Go TAP harness: invalid assertion numbering for %', ${literal(suite)};
  end if;
  if exists (select 1 from ${collector} where kind = 'finish' and nullif(btrim(output), '') is not null) then
    raise exception 'Food Go TAP harness: finish reported diagnostics for %', ${literal(suite)};
  end if;
end;
$food_go_tap_guard$;
`;
}

/** Generates reviewed SQL only. It never connects to or chooses a database. */
export function prepareDatabaseTest(source, suite = "database-test") {
  if (!suite || /[\0\r\n\\]/u.test(suite)) throw new Error("Invalid suite label.");
  const statements = splitSqlStatements(source);
  if (statements.length < 3) throw new Error("Expected a complete transactional TAP suite.");
  const classifications = statements.map(statement => {
    const tokens = sqlTokens(statement).filter(token => token.value !== ";");
    return { tokens, tap: tapSelect(statement) };
  });
  if (classifications[0].tokens.map(token => token.value).join(" ") !== "begin" ||
    classifications.at(-1).tokens.map(token => token.value).join(" ") !== "rollback")
    throw new Error("Suite must start with BEGIN and end with ROLLBACK.");
  for (let index = 1; index < statements.length - 1; index++) {
    const first = classifications[index].tokens[0]?.value;
    if (["begin", "start", "commit", "end", "rollback", "abort", "prepare", "savepoint", "release"].includes(first))
      throw new Error("Nested or committing transaction controls are unsupported.");
  }
  const plans = classifications.filter(item => item.tap?.kind === "plan");
  if (plans.length !== 1 || classifications.filter(item => item.tap?.kind === "finish").length !== 1)
    throw new Error("Suite must have exactly one literal plan and one finish().");
  const expected = plans[0].tap.plan;
  const assertionStatements = classifications.filter(item => item.tap?.kind === "assertion").length;
  if (assertionStatements !== expected)
    throw new Error(`TAP plan expects ${expected} assertions but recognised ${assertionStatements}.`);
  const capture = statements.map((statement, index) => {
    const tap = classifications[index].tap;
    if (!tap) return statement;
    // Keep data-modifying CTEs at statement top: WITH ... INSERT ... SELECT.
    // Adding capture columns directly also preserves scalar and SETOF helpers.
    return statement.slice(0, tap.select.start) +
      `insert into ${collector}(suite, kind, statement_no, output) ` +
      statement.slice(tap.select.start, tap.select.end) +
      ` ${literal(suite)}, ${literal(tap.kind)}, ${index}, ` + statement.slice(tap.select.end);
  });
  capture[0] += `
-- Collector and grants are temporary and disappear with the original rollback.
create temporary table food_go_tap_results (
  suite text not null,
  kind text not null check (kind in ('plan', 'assertion', 'finish')),
  statement_no integer not null,
  output text
) on commit drop;
grant insert on table ${collector} to anon, authenticated;
`;
  capture.splice(capture.length - 1, 0, failureGuard(suite, expected));
  const evidence = `
select jsonb_build_object('suite', ${literal(suite)}, 'assertions', ${expected},
  'status', 'passed', 'rolledBack', to_regclass('pg_temp.food_go_tap_results') is null) as food_go_database_test;
`;
  return {
    suite, expectedAssertions: expected,
    assertionStatements,
    sql: `-- Generated rollback-only TAP capture. Run as one batch with stop-on-error.
-- Only use an explicitly authorised disposable/development database.
-- Reviewed source fixtures may contain transactional DDL; no COMMIT is added.
${capture.join("\n")}\n${evidence}`,
  };
}

function inside(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(rel);
}

export async function prepareTestFile(testPath, outputPath, workspace = process.cwd()) {
  const root = await realpath(resolve(workspace));
  const input = await realpath(resolve(root, testPath));
  const output = resolve(root, outputPath);
  if (!inside(root, input) || !inside(root, output) || input === output || !output.endsWith(".sql"))
    throw new Error("Input and distinct .sql output must stay inside the workspace.");
  // Validate the nearest existing parent before creating any output directory.
  let parent = dirname(output);
  while (true) {
    try { parent = await realpath(parent); break; }
    catch (error) { if (error.code !== "ENOENT") throw error; parent = dirname(parent); }
  }
  if (!inside(root, parent)) throw new Error("Output resolves outside the workspace.");
  const prepared = prepareDatabaseTest(await readFile(input, "utf8"), basename(input).replace(/\.test\.sql$/u, ""));
  await mkdir(dirname(output), { recursive: true });
  // Recheck after directory creation so existing junctions/symlinks cannot escape.
  if (!inside(root, await realpath(dirname(output)))) throw new Error("Output resolves outside the workspace.");
  try {
    const existingOutput = await realpath(output);
    if (!inside(root, existingOutput)) throw new Error("Output resolves outside the workspace.");
    const pathKey = path => process.platform === "win32" ? path.toLowerCase() : path;
    const [inputInfo, outputInfo] = await Promise.all([stat(input, { bigint: true }), stat(existingOutput, { bigint: true })]);
    if (pathKey(existingOutput) === pathKey(input) ||
      (inputInfo.ino !== 0n && inputInfo.dev === outputInfo.dev && inputInfo.ino === outputInfo.ino))
      throw new Error("Output must be distinct from the source, including filesystem aliases.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  await writeFile(output, prepared.sql, "utf8");
  return { suite: prepared.suite, assertions: prepared.expectedAssertions, assertionStatements: prepared.assertionStatements, output, preparedOnly: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 4 || new Set([args[0], args[2]]).size !== 2 || ![args[0], args[2]].every(arg => ["--test", "--output"].includes(arg)))
      throw new Error("Usage: node scripts/prepare-database-tests.mjs --test supabase/tests/example.test.sql --output artifacts/example.sql");
    const options = { [args[0]]: args[1], [args[2]]: args[3] };
    process.stdout.write(`${JSON.stringify(await prepareTestFile(options["--test"], options["--output"]), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Test preparation failed."}\n`);
    process.exitCode = 1;
  }
}
