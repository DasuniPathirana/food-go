import assert from "node:assert/strict";
import test from "node:test";
import { pilotFogClip } from "./pilot-fog";

test("pilot fog uses an even-odd hole and rejects invalid projected coordinates", () => {
  const ring = [{x:10,y:10},{x:70,y:10},{x:70,y:80},{x:10,y:10}];
  const clip = pilotFogClip(100, 120, ring);
  assert.ok(clip?.startsWith("polygon(evenodd, 0px 0px, 100px 0px, 100px 120px"));
  assert.ok(clip?.includes("10.00px 10.00px, 70.00px 10.00px, 70.00px 80.00px"));
  assert.equal(pilotFogClip(100, 120, [{x:NaN,y:0}, ...ring]), null);
  assert.equal(pilotFogClip(0, 120, ring), null);
});
