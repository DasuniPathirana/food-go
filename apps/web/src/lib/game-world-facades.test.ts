import assert from "node:assert/strict";
import test from "node:test";
import { sampleFacades } from "./game-world-facades";

const center={longitude:144.968,latitude:-37.818};
const ring=[
  [144.96790,-37.81812],[144.96815,-37.81812],
  [144.96815,-37.81792],[144.96790,-37.81792],[144.96790,-37.81812],
];
test("facade dressing is stable, bounded and follows real building geometry",()=>{
  const source=[{id:"melbourne-1",ring,height:23.5}];
  const result=sampleFacades(source,center);
  assert.equal(result.length,1);
  assert.equal(result[0].kind,"facade");
  assert.equal(result[0].ring.length,4);
  assert.equal(result[0].height,16.57);
  assert.deepEqual(result,sampleFacades(source,center));
  assert.equal(sampleFacades([source[0],source[0]],center).length,1);
});
test("facade dressing rejects far, extreme and invalid footprints",()=>{
  assert.deepEqual(sampleFacades([],center),[]);
  assert.deepEqual(sampleFacades([{id:"bad",ring,height:NaN}],center),[]);
  assert.deepEqual(sampleFacades([{id:"building",ring,height:20}],{latitude:85,longitude:144.9}),[]);
  assert.deepEqual(sampleFacades([{id:"building",ring,height:20}],{latitude:-38.5,longitude:145.5}),[]);
  assert.deepEqual(sampleFacades([{id:"building",ring,height:20}],center,0),[]);
});
