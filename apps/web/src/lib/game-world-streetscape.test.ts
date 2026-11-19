import assert from "node:assert/strict";
import test from "node:test";
import { sampleStreetLamps } from "./game-world-streetscape";

const city={longitude:144.968,latitude:-37.818};
const road=[[144.967,-37.818],[144.969,-37.818]];

test("decorative street lighting follows mapped road segments within a strict budget",()=>{
  const a=sampleStreetLamps([road],city);
  assert.ok(a.length>1);
  assert.ok(a.length<=50);
  assert.deepEqual(a,sampleStreetLamps([road],city));
  assert.equal(new Set(a.map(x=>x.id)).size,a.length);
  assert.ok(a.every(x=>x.kind==="lamp"&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)));
});
test("street ambience never invents positions without supported road segments",()=>{
  assert.deepEqual(sampleStreetLamps([],city),[]);
  assert.deepEqual(sampleStreetLamps([road],{longitude:145.4,latitude:-38.2}),[]);
  assert.deepEqual(sampleStreetLamps([road],{longitude:144.968,latitude:86}),[]);
  assert.deepEqual(sampleStreetLamps([road],city,0),[]);
});
