import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// Only the disposable local CI stack. No URL, password, hosted project or remote
// target is accepted. Separate psql processes create actual competing transactions.
assert.equal(process.env.CI, "true", "This check belongs to the disposable CI database");
const container = "supabase_db_food-go-local";
const psql = ["exec", "-i", container, "psql", "-XAtq", "-U", "postgres", "-d", "postgres",
  "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
const sql = input => execFileSync("docker", psql, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const organisation = randomUUID(), venue = randomUUID(), managers = [randomUUID(), randomUUID()];
const candidates = [randomUUID(), randomUUID()];
const connections = [];
function connection() {
  const child = spawn("docker", psql, { stdio: ["pipe", "pipe", "pipe"] });
  let output = "", error = "", finished = false;
  const observers = new Set();
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { output += chunk; for (const observe of observers) observe(); });
  child.stderr.on("data", chunk => { error += chunk; });
  const result = new Promise(resolve => {
    child.on("error", () => { error = "Local psql process failed"; });
    child.on("close", code => { finished = true; for (const observe of observers) observe(); resolve({ code, error }); });
  });
  const waitFor = pattern => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { observers.delete(observe); reject(new Error("Winner did not reach its transaction barrier")); }, 12000);
    function observe() {
      const match = pattern.exec(output);
      if (match || finished) {
        clearTimeout(timer); observers.delete(observe);
        if (match) resolve(match); else reject(new Error("Winner exited before its transaction barrier"));
      }
    }
    observers.add(observe); observe();
  });
  const session = { child, result, waitFor, get finished() { return finished; } };
  connections.push(session);
  return session;
}
async function bounded(promise, timeout, message) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeout); })]); }
  finally { clearTimeout(timer); }
}
function attempt(actor, candidate) {
  return `set local statement_timeout='12s';
    set local role authenticated;
    select set_config('request.jwt.claims',jsonb_build_object('sub','${actor}','session_id','${actor}','role','authenticated')::text,true);
    select public.food_go_adventure(jsonb_build_object('action','questCreate','requestId','${randomUUID()}','id','${candidate}',
      'venueId','${venue}','title','Competing manager campaign','description','A genuine disposable campaign.','category','explore',
      'startsAt',now(),'endsAt',now()+interval '1 day','capacity',10));`;
}
try {
  sql(`begin;
    insert into auth.users(id,email,email_confirmed_at) values
      ('${managers[0]}','race-owner-${managers[0]}@example.invalid',now()),
      ('${managers[1]}','race-manager-${managers[1]}@example.invalid',now());
    insert into auth.sessions(id,user_id) values ('${managers[0]}','${managers[0]}'),('${managers[1]}','${managers[1]}');
    insert into public.organizations(id,name) values ('${organisation}','Disposable quota fixture');
    insert into public.organization_members(organization_id,user_id,role) values
      ('${organisation}','${managers[0]}','owner'),('${organisation}','${managers[1]}','manager');
    insert into public.venues(id,organization_id,slug,name,venue_type,cuisine,address,suburb,state,postcode,status,ownership_verified_at)
      values('${venue}','${organisation}','race-${venue}','Disposable concurrency kitchen','restaurant','Italian','1 Test Street','Melbourne','VIC','3000','published',now());
    insert into private.adventure_quests(id,venue_id,creator,category,title,description,starts_at,ends_at,capacity)
      select gen_random_uuid(),'${venue}','${managers[0]}','explore','Existing campaign '||n,'A genuine disposable campaign.',now(),now()+interval '1 day',10 from generate_series(1,9) n;
    commit;`);
  const winnerName = `food-go-winner-${organisation}`, contenderName = `food-go-contender-${organisation}`;
  const marker = "FOOD_GO_WINNER_READY:";
  const winner = connection();
  // Keep stdin open: the winner has completed its mutation but cannot COMMIT
  // until an independent observer proves its competitor is blocked by it.
  winner.child.stdin.write(`begin;
    set local application_name='${winnerName}';
    ${attempt(managers[0], candidates[0])}
    select '${marker}'||pg_backend_pid();
  `);
  const ready = await winner.waitFor(new RegExp(`${marker}(\\d+)`, "u"));
  const winnerPid = Number(ready[1]);
  assert.ok(Number.isInteger(winnerPid) && winnerPid > 0, "Winner barrier identifies its real PostgreSQL backend");
  const contender = connection();
  contender.child.stdin.end(`begin;
    set local application_name='${contenderName}';
    ${attempt(managers[1], candidates[1])}
    commit;`);
  let blocked = false;
  const deadline = Date.now() + 6000; // The function's own timeout is eight seconds.
  while (!blocked && Date.now() < deadline) {
    assert.equal(contender.finished, false, "Contender must still be executing while overlap is proved");
    blocked = sql(`select exists(select 1 from pg_stat_activity a
      where a.application_name='${contenderName}' and a.wait_event_type='Lock'
        and a.query like '%food_go_adventure%'
        and ${winnerPid}=any(pg_blocking_pids(a.pid))
        and exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted)
        and exists(select 1 from pg_stat_activity w where w.pid=${winnerPid}
          and w.application_name='${winnerName}' and w.state='idle in transaction' and w.xact_start is not null))::integer;`) === "1";
    if (!blocked) await delay(75);
  }
  assert.ok(blocked, "Observed the second quest mutation waiting on the uncommitted winner's actual database lock");
  assert.equal(Number(sql(`select count(*) from private.adventure_quests where venue_id='${venue}';`)), 9,
    "Winner has not committed its tenth campaign while the contender is blocked");
  winner.child.stdin.end("commit;\n");
  const results = await bounded(Promise.all([winner.result, contender.result]), 12000, "Competing transactions did not settle");
  assert.equal(results.filter(result => result.code === 0).length, 1, "Exactly one manager wins the last campaign slot");
  assert.equal(results.filter(result => result.code !== 0 && /FG429/u.test(result.error)).length, 1, "The competing manager receives the shared quota refusal");
  assert.equal(Number(sql(`select count(*) from private.adventure_quests where venue_id='${venue}';`)), 10, "Two connections cannot overfill the shared daily quota");
  console.log("Adventure concurrency: observed contender blocked by the uncommitted winner; one success, one quota refusal, ten campaigns.");
} finally {
  // Release/await both real transactions before cleanup, including on a failed
  // overlap assertion. Closing a held winner with ROLLBACK releases its locks.
  for (const session of connections) if (!session.finished && !session.child.stdin.writableEnded)
    session.child.stdin.end("rollback;\n");
  try { await bounded(Promise.all(connections.map(session => session.result)), 12000, "Local race sessions did not close"); }
  catch { for (const session of connections) if (!session.finished) session.child.kill("SIGTERM");
    await bounded(Promise.all(connections.map(session => session.result)), 4000, "Local race sessions could not be terminated"); }
  sql(`begin;
    delete from private.adventure_requests where user_id in ('${managers[0]}','${managers[1]}');
    delete from private.adventure_quests where venue_id='${venue}';
    delete from public.venues where id='${venue}';
    delete from public.organization_members where organization_id='${organisation}';
    delete from public.organizations where id='${organisation}';
    delete from auth.users where id in ('${managers[0]}','${managers[1]}');
    commit;`);
}
