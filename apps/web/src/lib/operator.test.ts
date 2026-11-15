import assert from "node:assert/strict";
import test from "node:test";
import { operatorActionSchema, operatorError, queueSchema } from "./operator";

const id="75110000-0000-4000-8000-000000000011";
const requestId="75110000-0000-4000-8000-000000000012";
const decision={id,requestId,reason:"Ownership evidence reviewed",version:"2026-11-14T08:00:00Z"};
test("operator decisions require the specific decision fields, target, version and reason",()=>{
  const publish={...decision,action:"venue.publish"};
  assert.ok(operatorActionSchema.safeParse(publish).success);
  for (const change of [{...publish,serviceRole:true},{...publish,reason:" "},{...publish,version:"old"},{...publish,id:"*"},
    {...publish,action:"operator.grant"}, {...publish,action:"venue.locate",latitude:-37.81,longitude:181}]) {
    assert.equal(operatorActionSchema.safeParse(change).success,false);
  }
  assert.ok(operatorActionSchema.safeParse({...publish,action:"venue.locate",latitude:0,longitude:0}).success);
});
test("promotion decisions distinguish create, edit and publish and use explicit time zones",()=>{
  const offer={id,requestId,reason:"Approved for publication",action:"promo.create",venueId:id,title:"Lunch special",
    description:"Weekday lunch",startsAt:"2026-11-14T09:00:00+11:00",endsAt:"2026-11-14T16:00:00+11:00"};
  assert.ok(operatorActionSchema.safeParse(offer).success);
  assert.ok(operatorActionSchema.safeParse({...offer,action:"promo.edit",version:decision.version}).success);
  for (const change of [{...offer,endsAt:offer.startsAt},{...offer,startsAt:"tomorrow"},{...offer,action:"promo.edit"},
    {...offer,action:"promo.publish"},{...offer,moderationStatus:"published"}]) {
    assert.equal(operatorActionSchema.safeParse(change).success,false);
  }
});
test("report decisions require a queue version and provider failures use safe messages",()=>{
  assert.ok(operatorActionSchema.safeParse({...decision,action:"report.dismiss",version:"a".repeat(32)}).success);
  assert.equal(operatorActionSchema.safeParse({...decision,action:"report.dismiss"}).success,false);
  assert.equal(operatorError("42501").status,403);
  assert.equal(operatorError("FG409").status,409);
  assert.equal(operatorError("FG404").status,404);
  assert.equal(operatorError("unexpected database details").status,503);
  assert.ok(queueSchema.safeParse({items:[],hasMore:false}).success);
  assert.equal(queueSchema.safeParse({items:[{id,name:"Offer",state:"draft",detail:"...",startsAt:"today"}],hasMore:false}).success,false);
});
