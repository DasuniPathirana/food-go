begin;
-- Preserve the cooldown promised when an item was granted. A replacement pool
-- with a shorter cooldown cannot shorten an existing customer's wait.
alter table private.encounter_inventory add column cooldown_until timestamptz;
update private.encounter_inventory i set cooldown_until=i.claimed_at+make_interval(hours=>q.cooldown_hours)
  from private.encounter_campaigns q where q.id=i.encounter_id;
alter table private.encounter_inventory alter column cooldown_until set not null;
alter table private.encounter_inventory add constraint encounter_inventory_cooldown_valid check (cooldown_until>claimed_at);
create or replace function private.encounter_journey(p_action jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='8s' as $$
declare actor uuid:=private.journey_user(); operation text:=p_action->>'action';
  request_id_value uuid; fingerprint bytea; previous private.encounter_requests%rowtype; account private.encounter_accounts%rowtype;
  q private.encounter_campaigns%rowtype; v public.venues%rowtype; s private.encounter_sessions%rowtype;
  item private.encounter_inventory%rowtype; entry private.encounter_pool_items%rowtype; offer public.promotions%rowtype;
  proof private.encounter_codes%rowtype; allowed text[]; at_time timestamptz; today date; result jsonb;
  token text; expiry timestamptz; target uuid; pool_input jsonb; entry_input jsonb; chosen uuid;
  start_time timestamptz; end_time timestamptz; number_value numeric; total_weight bigint; draw bigint; ceiling_value bigint;
  failed_code text; failed_message text; session_value uuid; item_value uuid; is_guess boolean;
begin
  if p_action is null or jsonb_typeof(p_action)<>'object' or octet_length(p_action::text)>16384
    or jsonb_typeof(p_action->'action') is distinct from 'string' then
    raise exception using errcode='22023',message='Invalid encounter action'; end if;
  if operation='read' then
    if p_action<>jsonb_build_object('action','read') then raise exception using errcode='22023',message='Invalid fields'; end if;
    return private.encounter_state();
  end if;
  allowed:=case operation
    when 'create' then array['encounterId','venueId','title','description','theme','radiusMetres','cooldownHours','startsAt','endsAt','maxClaims','offerValidityHours','pool']
    when 'submit' then array['encounterId','version'] when 'review' then array['encounterId','version','decision','reason']
    when 'start' then array['encounterId'] when 'cancel' then array['sessionId'] when 'issue' then array['sessionId']
    when 'claim' then array['sessionId','code'] when 'prepareRedemption' then array['itemId'] when 'redeem' then array['code'] else null end;
  if allowed is null or exists(select 1 from jsonb_object_keys(p_action) k where k<>all(allowed||array['action','requestId']))
    or exists(select 1 from unnest(allowed||array['requestId']) k where not p_action ? k or p_action->k='null'::jsonb)
    or jsonb_typeof(p_action->'requestId') is distinct from 'string' then
    raise exception using errcode='22023',message='Invalid encounter fields'; end if;
  request_id_value:=(p_action->>'requestId')::uuid;
  if request_id_value is null then raise exception using errcode='22023',message='Request identifier required'; end if;
  if operation in ('claim','redeem') and (jsonb_typeof(p_action->'code') is distinct from 'string' or not (p_action->>'code' ~ '^[a-f0-9]{32}$')) then
    raise exception using errcode='22023',message='Invalid confirmation format'; end if;
  fingerprint:=extensions.digest(p_action::text,'sha256');
  perform pg_advisory_xact_lock(hashtextextended(actor::text,250701));
  at_time:=clock_timestamp(); today:=(at_time at time zone 'Australia/Sydney')::date;
  select * into previous from private.encounter_requests where user_id=actor and request_id=request_id_value;
  if found then
    if previous.payload_hash<>fingerprint then raise exception using errcode='FG409',message='Request changed'; end if;
    return private.encounter_state(previous.result||jsonb_build_object('replayed',true,'code',null));
  end if;
  insert into private.encounter_accounts(user_id,mutation_day) values(actor,today) on conflict do nothing;
  select * into account from private.encounter_accounts where user_id=actor for update;
  if account.mutation_day is distinct from today then account.mutations_today:=0; end if;
  if account.mutations_today>=200 then raise exception using errcode='FG429',message='Daily encounter activity limit reached'; end if;
  is_guess:=operation in ('claim','redeem');
  if is_guess then
    if account.guess_window<=at_time-interval '15 minutes' then account.guesses:=0; account.guess_window:=at_time; end if;
    if account.guesses>=20 then
      return private.encounter_state(jsonb_build_object('action',operation,'sessionId',null,'itemId',null,'code',null,'codeExpiresAt',null,'replayed',false,
        'error',jsonb_build_object('code','limit','message','Too many confirmation attempts. Try again later.')));
    end if;
    update private.encounter_accounts set guesses=account.guesses+1,guess_window=account.guess_window where user_id=actor;
  end if;
  result:=jsonb_build_object('action',operation,'sessionId',null,'itemId',null,'code',null,'codeExpiresAt',null,'replayed',false,'error',null);

  if operation='create' then
    if jsonb_typeof(p_action->'venueId') is distinct from 'string' or jsonb_typeof(p_action->'encounterId') is distinct from 'string' then
      raise exception using errcode='22023',message='Invalid campaign identifier'; end if;
    select * into v from public.venues where id=(p_action->>'venueId')::uuid for share;
    if not found or not private.encounter_manager(v.id,actor) then raise exception using errcode='42501',message='Restaurant manager required'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v.id::text,250702));
    at_time:=clock_timestamp();
    perform private.journey_user();
    today:=(at_time at time zone 'Australia/Sydney')::date;
    if account.mutation_day is distinct from today then account.mutations_today:=0; end if;
    if not private.encounter_venue_valid(v.id) then raise exception using errcode='FG409',message='Published participating venue with coordinates required'; end if;
    if jsonb_typeof(p_action->'title') is distinct from 'string' or not private.partner_text_valid(p_action->>'title',2,90)
      or jsonb_typeof(p_action->'description') is distinct from 'string' or not private.partner_text_valid(p_action->>'description',2,600)
      or jsonb_typeof(p_action->'theme') is distinct from 'string' or p_action->>'theme' not in ('cafe','restaurant','market')
      or jsonb_typeof(p_action->'startsAt') is distinct from 'string' or jsonb_typeof(p_action->'endsAt') is distinct from 'string' then
      raise exception using errcode='22023',message='Invalid campaign details'; end if;
    foreach token in array array['radiusMetres','cooldownHours','maxClaims','offerValidityHours'] loop
      if jsonb_typeof(p_action->token) is distinct from 'number' or mod((p_action->>token)::numeric,1)<>0 then
        raise exception using errcode='22023',message='Use integral campaign limits'; end if;
    end loop;
    if (p_action->>'radiusMetres')::numeric not between 30 and 150 or (p_action->>'cooldownHours')::numeric not between 24 and 168
      or (p_action->>'maxClaims')::numeric not between 1 and 10000 or (p_action->>'offerValidityHours')::numeric not between 1 and 168 then
      raise exception using errcode='22023',message='Campaign limits out of range'; end if;
    start_time:=(p_action->>'startsAt')::timestamptz; end_time:=(p_action->>'endsAt')::timestamptz;
    if not isfinite(start_time) or not isfinite(end_time) or end_time<=greatest(start_time,at_time)
      or end_time>start_time+interval '90 days' or start_time>at_time+interval '90 days' then
      raise exception using errcode='22023',message='Invalid campaign schedule'; end if;
    pool_input:=p_action->'pool';
    if jsonb_typeof(pool_input) is distinct from 'array' or jsonb_array_length(pool_input) not between 1 and 8 then
      raise exception using errcode='22023',message='Use one to eight pool entries'; end if;
    if (select count(*) from private.encounter_campaigns where venue_id=v.id and created_at>at_time-interval '1 day')>=10 then
      raise exception using errcode='FG429',message='Daily venue campaign limit reached'; end if;
    target:=(p_action->>'encounterId')::uuid;
    insert into private.encounter_campaigns(id,venue_id,creator,venue_snapshot,title,description,theme,starts_at,ends_at,
      radius_metres,cooldown_hours,max_claims,offer_validity_hours,created_at,updated_at)
      values(target,v.id,actor,private.encounter_venue_json(v.id),btrim(p_action->>'title'),btrim(p_action->>'description'),p_action->>'theme',start_time,end_time,
        (p_action->>'radiusMetres')::integer,(p_action->>'cooldownHours')::integer,(p_action->>'maxClaims')::integer,(p_action->>'offerValidityHours')::integer,at_time,at_time);
    for entry_input in select value from jsonb_array_elements(pool_input) loop
      if jsonb_typeof(entry_input)<>'object' or jsonb_typeof(entry_input->'id') is distinct from 'string'
        or jsonb_typeof(entry_input->'kind') is distinct from 'string' or entry_input->>'kind' not in ('collectible','offer')
        or jsonb_typeof(entry_input->'rarity') is distinct from 'string' or entry_input->>'rarity' not in ('common','rare','epic','legendary')
        or jsonb_typeof(entry_input->'weight') is distinct from 'number' or mod((entry_input->>'weight')::numeric,1)<>0
        or (entry_input->>'weight')::numeric not between 1 and 1000 then raise exception using errcode='22023',message='Invalid pool entry'; end if;
      allowed:=case when entry_input->>'kind'='offer' then array['id','kind','rarity','weight','promotionId'] else array['id','kind','rarity','weight','name','description'] end;
      if exists(select 1 from jsonb_object_keys(entry_input) k where k<>all(allowed))
        or exists(select 1 from unnest(allowed) k where not entry_input ? k or entry_input->k='null'::jsonb) then
        raise exception using errcode='22023',message='Invalid pool fields'; end if;
      if entry_input->>'kind'='offer' then
        if jsonb_typeof(entry_input->'promotionId') is distinct from 'string' then raise exception using errcode='22023',message='Approved promotion required'; end if;
        select * into offer from public.promotions where id=(entry_input->>'promotionId')::uuid for share;
        if not found or offer.venue_id<>v.id or offer.status<>'published' or offer.starts_at>start_time or offer.ends_at<end_time then
          raise exception using errcode='FG404',message='Published promotion must cover this venue campaign'; end if;
        insert into private.encounter_pool_items(id,encounter_id,kind,name,description,rarity,weight,promotion_id,promotion_version)
          values((entry_input->>'id')::uuid,target,'offer',offer.title,offer.description,entry_input->>'rarity',(entry_input->>'weight')::integer,offer.id,offer.updated_at);
      else
        if jsonb_typeof(entry_input->'name') is distinct from 'string' or not private.partner_text_valid(entry_input->>'name',2,80)
          or jsonb_typeof(entry_input->'description') is distinct from 'string' or not private.partner_text_valid(entry_input->>'description',2,300) then
          raise exception using errcode='22023',message='Invalid collectible details'; end if;
        insert into private.encounter_pool_items(id,encounter_id,kind,name,description,rarity,weight)
          values((entry_input->>'id')::uuid,target,'collectible',btrim(entry_input->>'name'),btrim(entry_input->>'description'),entry_input->>'rarity',(entry_input->>'weight')::integer);
      end if;
    end loop;
  else
    -- Resolve identity without locking, then always lock campaign -> venue ->
    -- session/item -> code. No other account's inventory is returned or mutated.
    if operation in ('submit','review','start') then
      if jsonb_typeof(p_action->'encounterId') is distinct from 'string' then raise exception using errcode='22023',message='Campaign identifier required'; end if;
      target:=(p_action->>'encounterId')::uuid;
    elsif operation in ('cancel','issue','claim') then
      if jsonb_typeof(p_action->'sessionId') is distinct from 'string' then raise exception using errcode='22023',message='Session identifier required'; end if;
      session_value:=(p_action->>'sessionId')::uuid;
      select encounter_id into target from private.encounter_sessions where id=session_value;
    elsif operation='prepareRedemption' then
      if jsonb_typeof(p_action->'itemId') is distinct from 'string' then raise exception using errcode='22023',message='Item identifier required'; end if;
      item_value:=(p_action->>'itemId')::uuid;
      select encounter_id into target from private.encounter_inventory where id=item_value and user_id=actor;
    else
      select encounter_id,item_id into target,item_value from private.encounter_codes
        where purpose='redemption' and token_hash=extensions.digest(p_action->>'code','sha256');
    end if;
    select * into q from private.encounter_campaigns where id=target for update;
    if not found then
      if is_guess then failed_code:='missing'; failed_message:='Confirmation is unavailable or expired.';
      else raise exception using errcode='FG404',message='Encounter unavailable'; end if;
    else
      select * into v from public.venues where id=q.venue_id for share;
      perform pg_advisory_xact_lock(hashtextextended(v.id::text,250702));
      perform 1 from public.promotions where id in (select promotion_id from private.encounter_pool_items where encounter_id=q.id and promotion_id is not null) order by id for share;
      at_time:=clock_timestamp();
      perform private.journey_user();
      today:=(at_time at time zone 'Australia/Sydney')::date;
      if account.mutation_day is distinct from today then account.mutations_today:=0; end if;
      if operation in ('submit','review') then
        if jsonb_typeof(p_action->'version') is distinct from 'string' or (p_action->>'version')::timestamptz<>q.updated_at then
          raise exception using errcode='FG409',message='Campaign changed'; end if;
        if operation='submit' then
          if not private.encounter_manager(v.id,actor) then raise exception using errcode='42501',message='Restaurant manager required'; end if;
          if q.state not in ('draft','rejected') or q.ends_at<=at_time or not private.encounter_venue_valid(v.id) or not private.encounter_pool_valid(q.id) then
            raise exception using errcode='FG409',message='Campaign is not ready for review'; end if;
          update private.encounter_campaigns set state='pending',updated_at=at_time where id=q.id;
        else
          if private.food_go_operator_access()<>'ready' or coalesce(q.creator=actor,false)
            or exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor) then
            raise exception using errcode='42501',message='Independent MFA operator required'; end if;
          if jsonb_typeof(p_action->'decision') is distinct from 'string' or p_action->>'decision' not in ('approve','reject','withdraw')
            or jsonb_typeof(p_action->'reason') is distinct from 'string' or not private.partner_text_valid(p_action->>'reason',5,400) then
            raise exception using errcode='22023',message='Invalid review decision'; end if;
          if (p_action->>'decision' in ('approve','reject') and q.state<>'pending') or (p_action->>'decision'='withdraw' and q.state<>'published') then
            raise exception using errcode='FG409',message='Campaign review state changed'; end if;
          if p_action->>'decision'='approve' then
            if q.ends_at<=at_time or not private.encounter_venue_valid(v.id) or not private.encounter_pool_valid(q.id) then
              raise exception using errcode='FG409',message='Approved venue, pool and current schedule required'; end if;
            if (select count(*) from private.encounter_campaigns where venue_id=v.id and state='published' and id<>q.id
              and starts_at<q.ends_at and ends_at>q.starts_at)>=3 then raise exception using errcode='FG429',message='Venue encounter overlap limit reached'; end if;
          end if;
          update private.encounter_campaigns set state=case p_action->>'decision' when 'approve' then 'published' when 'reject' then 'rejected' else 'withdrawn' end,
            updated_at=at_time where id=q.id;
          insert into private.encounter_review_audit(encounter_id,actor,request_id,decision,reason,previous_version)
            values(q.id,actor,request_id_value,p_action->>'decision',btrim(p_action->>'reason'),q.updated_at);
        end if;
      elsif operation='start' then
        if not private.encounter_available(q.id,at_time) then raise exception using errcode='FG404',message='Active encounter unavailable'; end if;
        if exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor) then
          raise exception using errcode='42501',message='Customer encounter required'; end if;
        update private.encounter_sessions set state='expired' where user_id=actor and state in ('started','awaiting_confirmation') and expires_at<=at_time;
        select * into s from private.encounter_sessions where user_id=actor and encounter_id=q.id and state in ('started','awaiting_confirmation') for update;
        if found and s.encounter_version=q.updated_at then session_value:=s.id;
        else
          if found then update private.encounter_sessions set state='cancelled' where id=s.id; end if;
          if (select count(*) from private.encounter_sessions where user_id=actor and state in ('started','awaiting_confirmation') and expires_at>at_time)>=3
            then raise exception using errcode='FG429',message='Finish or cancel an existing encounter'; end if;
          if exists(select 1 from private.encounter_inventory where user_id=actor and venue_id=v.id and (cooldown_until>at_time or claimed_at>at_time-make_interval(hours=>q.cooldown_hours))) then
            raise exception using errcode='FG429',message='This venue is on cooldown'; end if;
          if (select count(*) from private.encounter_inventory where user_id=actor and (claimed_at at time zone 'Australia/Sydney')::date=today)>=10
            or (select count(*) from private.encounter_inventory where user_id=actor)>=500 then raise exception using errcode='FG429',message='Inventory or daily claim limit reached'; end if;
          insert into private.encounter_sessions(user_id,encounter_id,encounter_version,created_at,expires_at)
            values(actor,q.id,q.updated_at,at_time,least(at_time+interval '15 minutes',q.ends_at)) returning id into session_value;
        end if;
        result:=result||jsonb_build_object('sessionId',session_value);
      elsif operation in ('cancel','issue','claim') then
        select * into s from private.encounter_sessions where id=session_value and encounter_id=q.id for update;
        if operation='claim' then
          if not found or s.user_id<>actor then failed_code:='missing'; failed_message:='Confirmation is unavailable or expired.';
          elsif s.state='claimed' then
            select id into item_value from private.encounter_inventory where session_id=s.id and user_id=actor;
            result:=result||jsonb_build_object('sessionId',s.id,'itemId',item_value,'replayed',true);
          elsif s.state not in ('started','awaiting_confirmation') or s.expires_at<=at_time or s.encounter_version<>q.updated_at or not private.encounter_available(q.id,at_time)
            or exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor) then
            failed_code:='ineligible'; failed_message:='This encounter cannot be claimed.';
          else
            select * into proof from private.encounter_codes where purpose='claim' and session_id=s.id and beneficiary=actor
              and token_hash=extensions.digest(p_action->>'code','sha256') for update;
            if not found or proof.used_at is not null or proof.expires_at<=at_time or proof.encounter_id<>q.id
              or proof.encounter_version<>q.updated_at or not private.encounter_issuer_valid(proof.id) then
              failed_code:='missing'; failed_message:='Confirmation is unavailable or expired.';
            elsif exists(select 1 from private.encounter_inventory where user_id=actor and venue_id=v.id and (cooldown_until>at_time or claimed_at>at_time-make_interval(hours=>q.cooldown_hours))) then
              failed_code:='limit'; failed_message:='This venue is on cooldown.';
            elsif (select count(*) from private.encounter_inventory where user_id=actor and (claimed_at at time zone 'Australia/Sydney')::date=today)>=10
              or (select count(*) from private.encounter_inventory where user_id=actor)>=500 then
              failed_code:='limit'; failed_message:='Inventory or daily claim limit reached.';
            else
              select sum(weight) into total_weight from private.encounter_pool_items where encounter_id=q.id;
              ceiling_value:=(4294967296::bigint/total_weight)*total_weight;
              loop
                draw:=('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint;
                exit when draw<ceiling_value;
              end loop;
              draw:=draw%total_weight;
              select id into chosen from (select id,sum(weight) over(order by id) cutoff from private.encounter_pool_items where encounter_id=q.id) weighted
                where cutoff>draw order by cutoff limit 1;
              select * into entry from private.encounter_pool_items where id=chosen;
              expiry:=null;
              if entry.kind='offer' then select * into offer from public.promotions where id=entry.promotion_id;
                expiry:=least(at_time+make_interval(hours=>q.offer_validity_hours),offer.ends_at); end if;
              insert into private.encounter_inventory(user_id,session_id,encounter_id,venue_id,pool_item_id,venue_snapshot,name,description,rarity,kind,
                promotion_id,promotion_version,claimed_at,expires_at,cooldown_until)
                values(actor,s.id,q.id,v.id,entry.id,private.encounter_venue_json(v.id),entry.name,entry.description,entry.rarity,entry.kind,
                  entry.promotion_id,entry.promotion_version,at_time,expiry,at_time+make_interval(hours=>q.cooldown_hours)) returning id into item_value;
              update private.encounter_codes set used_at=at_time,used_by=actor where id=proof.id and used_at is null;
              update private.encounter_sessions set state='claimed' where id=s.id;
              update private.encounter_campaigns set claimed_count=claimed_count+1 where id=q.id;
              result:=result||jsonb_build_object('sessionId',s.id,'itemId',item_value);
            end if;
          end if;
        elsif operation='cancel' then
          if not found or s.user_id<>actor then raise exception using errcode='FG404',message='Encounter session unavailable'; end if;
          if s.state='claimed' then raise exception using errcode='FG409',message='Claimed encounters cannot be cancelled'; end if;
          update private.encounter_sessions set state='cancelled' where id=s.id;
          update private.encounter_codes set expires_at=least(expires_at,at_time) where session_id=s.id and purpose='claim' and used_at is null;
          result:=result||jsonb_build_object('sessionId',s.id);
        else
          if not private.encounter_manager(v.id,actor) then raise exception using errcode='42501',message='Restaurant manager required'; end if;
          if not found or s.user_id=actor or s.state not in ('started','awaiting_confirmation') or s.expires_at<=at_time
            or s.encounter_version<>q.updated_at or not private.encounter_available(q.id,at_time)
            or exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=s.user_id) then
            raise exception using errcode='FG404',message='Customer encounter unavailable'; end if;
          if (select count(*) from private.encounter_codes c join private.encounter_campaigns x on x.id=c.encounter_id
            where x.venue_id=v.id and c.created_at>at_time-interval '1 hour')>=60 then raise exception using errcode='FG429',message='Venue confirmation limit reached'; end if;
          token:=encode(extensions.gen_random_bytes(16),'hex'); expiry:=least(at_time+interval '2 minutes',s.expires_at);
          update private.encounter_codes set expires_at=least(expires_at,at_time) where session_id=s.id and purpose='claim' and used_at is null;
          insert into private.encounter_codes(purpose,encounter_id,encounter_version,session_id,beneficiary,issuer,issuer_session_id,token_hash,created_at,expires_at)
            values('claim',q.id,q.updated_at,s.id,s.user_id,actor,(auth.jwt()->>'session_id')::uuid,extensions.digest(token,'sha256'),at_time,expiry);
          update private.encounter_sessions set state='awaiting_confirmation' where id=s.id;
          result:=result||jsonb_build_object('sessionId',s.id,'code',token,'codeExpiresAt',expiry);
        end if;
      else
        select * into item from private.encounter_inventory where id=item_value and encounter_id=q.id for update;
        if operation='prepareRedemption' then
          if not found or item.user_id<>actor then raise exception using errcode='FG404',message='Inventory item unavailable'; end if;
          if not private.encounter_item_available(item.id,at_time)
            or exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=actor) then
            raise exception using errcode='FG409',message='Approved available offer required'; end if;
          if (select count(*) from private.encounter_codes c join private.encounter_campaigns x on x.id=c.encounter_id
            where x.venue_id=v.id and c.created_at>at_time-interval '1 hour')>=60 then raise exception using errcode='FG429',message='Venue confirmation limit reached'; end if;
          token:=encode(extensions.gen_random_bytes(16),'hex'); expiry:=least(at_time+interval '2 minutes',item.expires_at);
          update private.encounter_codes set expires_at=least(expires_at,at_time) where item_id=item.id and purpose='redemption' and used_at is null;
          insert into private.encounter_codes(purpose,encounter_id,encounter_version,session_id,item_id,beneficiary,issuer,issuer_session_id,token_hash,created_at,expires_at)
            values('redemption',q.id,q.updated_at,item.session_id,item.id,actor,actor,(auth.jwt()->>'session_id')::uuid,extensions.digest(token,'sha256'),at_time,expiry);
          result:=result||jsonb_build_object('itemId',item.id,'code',token,'codeExpiresAt',expiry);
        else
          if not found or not private.encounter_manager(v.id,actor) or item.user_id=actor then
            failed_code:='missing'; failed_message:='Confirmation is unavailable or expired.';
          else
            select * into proof from private.encounter_codes where purpose='redemption' and item_id=item.id and beneficiary=item.user_id
              and token_hash=extensions.digest(p_action->>'code','sha256') for update;
            if not found or proof.used_at is not null or proof.expires_at<=at_time or proof.encounter_version<>q.updated_at
              or not private.encounter_issuer_valid(proof.id) or not private.encounter_item_available(item.id,at_time)
              or exists(select 1 from public.organization_members where organization_id=v.organization_id and user_id=item.user_id) then
              failed_code:='missing'; failed_message:='Confirmation is unavailable or expired.';
            else
              update private.encounter_inventory set redeemed_at=at_time,redeemed_by=actor where id=item.id and redeemed_at is null;
              update private.encounter_codes set used_at=at_time,used_by=actor where id=proof.id and used_at is null;
              result:=result||jsonb_build_object('itemId',item.id,'sessionId',item.session_id);
            end if;
          end if;
        end if;
      end if;
    end if;
  end if;
  if failed_code is not null then
    result:=result||jsonb_build_object('error',jsonb_build_object('code',failed_code,'message',failed_message));
  else
    update private.encounter_accounts set mutation_day=today,mutations_today=account.mutations_today+1 where user_id=actor;
  end if;
  -- Store no plaintext confirmation or redemption code, including on replay.
  delete from private.encounter_requests where user_id=actor and created_at<at_time-interval '2 days';
  delete from private.encounter_codes where beneficiary=actor and expires_at<at_time-interval '2 days';
  delete from private.encounter_sessions where user_id=actor and state in ('cancelled','expired') and expires_at<at_time-interval '2 days';
  insert into private.encounter_requests(user_id,request_id,payload_hash,result,created_at)
    values(actor,request_id_value,fingerprint,result||jsonb_build_object('code',null),at_time);
  return private.encounter_state(result);
end;
$$;

commit;
