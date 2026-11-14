import assert from "node:assert/strict";
import test from "node:test";
import { createDemoGame, DEMO_AUTHOR_ID, DEMO_QUESTS, demoDay, demoProgress, parseDemoGame, reduceDemoGame, type DemoGameState, type DemoSocialEvent } from "./demo-game";
const now = new Date("2026-11-13T08:00:00.000Z");
function visit(state: DemoGameState, venueId: string) {
  state = reduceDemoGame(state, { type: "route", venueId }, now);
  state = reduceDemoGame(state, { type: "arrive" }, now);
  return reduceDemoGame(state, { type: "check-in", venueId }, now);
}
test("demo check-in requires the matching arrival and a dish remains separate", () => {
  let state = createDemoGame();
  assert.equal(reduceDemoGame(state, { type: "check-in", venueId: "finch-and-field" }, now), state);
  assert.equal(reduceDemoGame(state, { type: "collect-dish", venueId: "finch-and-field" }, now), state);
  state = reduceDemoGame(state, { type: "route", venueId: "finch-and-field" }, now);
  assert.equal(reduceDemoGame(state, { type: "check-in", venueId: "finch-and-field" }, now), state);
  state = visit(state, "finch-and-field");
  assert.deepEqual(state.collected, []);
  assert.equal(demoProgress(state).xp, 370);
  assert.equal(reduceDemoGame(state, { type: "check-in", venueId: "finch-and-field" }, now), state);
  state = reduceDemoGame(state, { type: "collect-dish", venueId: "finch-and-field" }, now);
  assert.equal(demoProgress(state).xp, 445);
  assert.equal(reduceDemoGame(state, { type: "collect-dish", venueId: "finch-and-field" }, now), state);
});
test("trail claims require starting and every real stop ID, then pay once", () => {
  let state = createDemoGame();
  const quest = DEMO_QUESTS.find((entry) => entry.id === "small-rituals")!;
  assert.equal(reduceDemoGame(state, { type: "claim-quest", questId: quest.id }, now), state);
  state = reduceDemoGame(state, { type: "start-quest", questId: quest.id }, now);
  state = visit(state, quest.stops[0]);
  assert.equal(reduceDemoGame(state, { type: "claim-quest", questId: quest.id }, now), state);
  state = visit(state, quest.stops[1]);
  state = reduceDemoGame(state, { type: "claim-quest", questId: quest.id }, now);
  assert.equal(demoProgress(state).xp, 520);
  assert.equal(demoProgress(state).level, 4);
  assert.deepEqual(state.claimedQuests, [quest.id]);
  assert.equal(reduceDemoGame(state, { type: "claim-quest", questId: quest.id }, now), state);
});
test("daily claim follows the Sydney calendar, once a day through DST", () => {
  assert.equal(demoDay(new Date("2026-11-13T12:59:59Z")), "2026-11-13");
  assert.equal(demoDay(new Date("2026-11-13T13:00:00Z")), "2026-11-14");
  let state = reduceDemoGame(createDemoGame(), { type: "daily" }, now);
  assert.equal(reduceDemoGame(state, { type: "daily" }, now), state);
  state = reduceDemoGame(state, { type: "daily" }, new Date("2026-11-13T13:00:00Z"));
  assert.equal(demoProgress(state).xp, 370);
});
test("social sample XP is unique, capped, other-author-only and removal cannot farm", () => {
  let state = createDemoGame();
  const social = (kind: DemoSocialEvent["kind"], postId: string, authorId = "other-explorer") => {
    state = reduceDemoGame(state, { type: "social", event: { kind, postId, authorId } }, now);
  };
  social("like", "p1", DEMO_AUTHOR_ID);
  assert.equal(demoProgress(state).xp, 320);
  social("like", "p1"); social("like", "p1");
  assert.equal(demoProgress(state).xp, 322);
  for (let n = 2; n <= 7; n++) social("like", `p${n}`);
  assert.equal(demoProgress(state).xp, 330);
  for (let n = 1; n <= 3; n++) social("comment", `p${n}`);
  assert.equal(demoProgress(state).xp, 340);
  social("share", "p1"); social("share", "p2");
  assert.equal(demoProgress(state).xp, 345);
  for (let n = 1; n <= 4; n++) social("post", `own${n}`, DEMO_AUTHOR_ID);
  assert.equal(demoProgress(state).xp, 420);
  social("remove-post", "own1", DEMO_AUTHOR_ID);
  social("post", "own5", DEMO_AUTHOR_ID);
  social("post", "own1", DEMO_AUTHOR_ID);
  assert.equal(demoProgress(state).xp, 395);
});
test("round-trip validation rejects forged award amounts, missing prerequisites and oversized data", () => {
  let state = visit(createDemoGame(), "finch-and-field");
  state = reduceDemoGame(state, { type: "collect-dish", venueId: "finch-and-field" }, now);
  assert.deepEqual(parseDemoGame(JSON.parse(JSON.stringify(state))), state);
  assert.equal(demoProgress(parseDemoGame({ ...state, xp: 999999 })).xp, 445);
  const forged = structuredClone(state); forged.ledger[0].amount = 9999;
  assert.deepEqual(parseDemoGame(forged), createDemoGame());
  assert.deepEqual(parseDemoGame({ ...state, visited: [] }), createDemoGame());
  assert.deepEqual(parseDemoGame({ ...state, name: "a".repeat(41) }), createDemoGame());
  assert.deepEqual(parseDemoGame({ ...state, ledger: Array(2001).fill(state.ledger[0]) }), createDemoGame());
  assert.deepEqual(parseDemoGame(null), createDemoGame());
});
test("reset clears the complete game identity, collections, route and ledger", () => {
  const state = reduceDemoGame(visit(createDemoGame(), "small-hours"), { type: "reset" }, now);
  assert.deepEqual(state, createDemoGame());
});
