import assert from "node:assert/strict";
import test from "node:test";
import { demoParkScenery } from "./demo-park-scenery";

test("Fitzroy client showcase planting is deterministic, bounded and decorative",()=>{
  const first=demoParkScenery(),second=demoParkScenery();
  assert.deepEqual(first,second);
  assert.ok(first.length>=50 && first.length<=102);
  assert.equal(new Set(first.map(x=>x.id)).size,first.length);
  assert.ok(first.every(x=>x.kind==="tree"&&
    Math.abs(x.longitude-144.9794)<.004&&Math.abs(x.latitude+37.8134)<.004));
});
