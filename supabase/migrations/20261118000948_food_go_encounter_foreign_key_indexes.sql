begin;

-- Cover the encounter foreign keys so parent updates/deletions do not scan
-- every customer's history or temporary challenge. No client access changes.
create index encounter_campaign_creator_idx on private.encounter_campaigns(creator);
create index encounter_pool_promotion_idx on private.encounter_pool_items(promotion_id);
create index encounter_session_campaign_idx on private.encounter_sessions(encounter_id);
create index encounter_inventory_campaign_idx on private.encounter_inventory(encounter_id);
create index encounter_inventory_venue_idx on private.encounter_inventory(venue_id);
create index encounter_inventory_pool_item_idx on private.encounter_inventory(pool_item_id);
create index encounter_inventory_promotion_idx on private.encounter_inventory(promotion_id);
create index encounter_inventory_redeemer_idx on private.encounter_inventory(redeemed_by);
create index encounter_code_beneficiary_idx on private.encounter_codes(beneficiary);
create index encounter_code_issuer_idx on private.encounter_codes(issuer);
create index encounter_code_issuer_session_idx on private.encounter_codes(issuer_session_id);
create index encounter_code_used_by_idx on private.encounter_codes(used_by);
create index encounter_review_campaign_idx on private.encounter_review_audit(encounter_id);

commit;
