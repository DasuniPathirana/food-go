import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Actual route, schemas and server guards, with only provider adapters replaced.
// The fixture never opens a network connection or uses a hosted account.
const harness = `
  import assert from 'node:assert/strict';
  import { readFile } from 'node:fs/promises';
  import { stripTypeScriptTypes } from 'node:module';
  import { SourceTextModule,SyntheticModule,createContext } from 'node:vm';
  import * as zod from 'zod';
  const root=${JSON.stringify(new URL("../", import.meta.url).href)};
  const domain=${JSON.stringify(new URL("../../../../packages/domain/src/", import.meta.url).href)};
  const origin='http://127.0.0.1:3000';
  const env={ NODE_ENV:'development',APP_ORIGIN:origin,FOOD_GO_ENCOUNTERS_ENABLED:'true',FOOD_GO_AUTH_ENABLED:'true',
    FOOD_GO_CATALOGUE_MODE:'supabase',SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_public_not_a_real_key',
    FOOD_GO_AUTH_COOKIE_SECRET:'fixture-cookie-secret-that-is-at-least-43-characters' };
  const ids={user:'11111111-1111-4111-8111-111111111111',venue:'22222222-2222-4222-8222-222222222222',session:'33333333-3333-4333-8333-333333333333',
    request:'44444444-4444-4444-8444-444444444444',campaign:'55555555-5555-4555-8555-555555555555'};
  const at='2026-11-17T00:00:00Z';
  const snapshot={ok:true,version:1,serverTime:at,inventory:[],sessions:[],managedVenues:[],campaigns:[],operator:false,result:null};
  const publicState={ok:true,version:1,serverTime:at,encounters:[]};
  const fixture={user:{id:ids.user,email:'fixture@example.invalid',email_confirmed_at:at},identityError:null,error:null,data:snapshot,publicData:publicState,throws:false};
  const calls={auth:0,anonymous:0,identities:0,rpc:[],deadlines:[],bodyDeadlines:[],signals:[]};
  const plain=value=>JSON.parse(JSON.stringify(value));
  function rpc(kind,name,args) {calls.rpc.push(plain({kind,name,args}));return {async abortSignal(signal){calls.signals.push(signal);
    if(fixture.throws)throw new Error('private provider payload');return {data:kind==='public'?fixture.publicData:fixture.data,error:fixture.error};}};}
  const client={auth:{async getUser(){calls.identities++;return {data:{user:fixture.user},error:fixture.identityError};}},rpc:(name,args)=>rpc('account',name,args)};
  const context=createContext({process:{env},Request,Response,Headers,URL,TextEncoder,TextDecoder,Uint8Array,Buffer,AbortController,
    AbortSignal:new Proxy(AbortSignal,{get(target,key){return key==='timeout'?ms=>{calls.deadlines.push(ms);return target.timeout(ms);}:Reflect.get(target,key);}}),
    setTimeout:(callback,ms)=>{calls.bodyDeadlines.push(ms);return setTimeout(callback,Math.min(ms,25));},clearTimeout,crypto,console,
    fetch:()=>{throw new Error('Network forbidden in fixture');}});
  const modules=new Map();
  function synthetic(id,exports){const names=Object.keys(exports);const m=new SyntheticModule(names,function(){for(const name of names)this.setExport(name,exports[name]);},{context,identifier:id});modules.set(id,m);return m;}
  synthetic('fixture:zod',zod);synthetic('fixture:server-only',{});
  synthetic(new URL('lib/auth/server.ts',root).href,{createAuthClient:async()=>{calls.auth++;return client;}});
  synthetic('fixture:supabase',{createClient:(url,key,options)=>{calls.anonymous++;assert.equal(url,env.SUPABASE_URL);assert.equal(key,env.SUPABASE_PUBLISHABLE_KEY);
    assert.deepEqual(plain(options.auth),{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
    assert.equal(options.global.headers,undefined);return {rpc:(name,args)=>rpc('public',name,args)};}});
  async function load(id){if(modules.has(id))return modules.get(id);const source=stripTypeScriptTypes(await readFile(new URL(id),'utf8'),{mode:'transform',sourceUrl:id});
    const m=new SourceTextModule(source,{context,identifier:id});modules.set(id,m);await m.link(async(specifier,parent)=>{
      if(specifier==='server-only')return modules.get('fixture:server-only');if(specifier==='zod')return modules.get('fixture:zod');
      if(specifier==='@supabase/supabase-js')return modules.get('fixture:supabase');
      let url;if(specifier.startsWith('@/'))url=new URL(specifier.slice(2),root);else if(specifier==='@food-go/domain')url=new URL('index.ts',domain);else if(specifier.startsWith('@food-go/domain/'))url=new URL(specifier.slice(16),domain);
      else if(specifier.startsWith('.'))url=new URL(specifier,parent.identifier);else throw new Error('Unexpected fixture import '+specifier);
      if(!url.pathname.endsWith('.ts'))url.pathname+='.ts';return load(url.href);});return m;}
  const module=await load(new URL('app/api/encounters/route.ts',root).href);await module.evaluate();const route=module.namespace;
  const get=query=>new Request(origin+'/api/encounters'+(query?'?'+query:''));
  const post=(data,headers={})=>new Request(origin+'/api/encounters',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(data)});
  const start={action:'start',encounterId:ids.campaign,requestId:ids.request};
  async function status(response,expected){assert.equal(response.status,expected);assert.equal(response.headers.get('cache-control'),'no-store');return response.json();}
`;
function run(source: string) {
  const result = spawnSync(process.execPath, ["--experimental-vm-modules", "--input-type=module", "--eval", harness + source], {
    cwd: process.cwd(), env: { SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, NODE_ENV: "test" }, encoding: "utf8", timeout: 20000,
  });
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("encounter route keeps release gates closed and public reads use no account cookie adapter", () => run(`
  env.FOOD_GO_ENCOUNTERS_ENABLED='false';
  for(const response of [await route.GET(get()),await route.GET(get('venueId='+ids.venue)),await route.POST(post(start))])await status(response,503);
  assert.equal(calls.auth+calls.anonymous,0);
  env.FOOD_GO_ENCOUNTERS_ENABLED='true';fixture.user=null;env.FOOD_GO_AUTH_ENABLED='false';
  assert.deepEqual(await status(await route.GET(get('venueId='+ids.venue)),200),publicState);
  assert.equal(calls.auth,0);assert.equal(calls.anonymous,1);assert.equal(calls.identities,0);
  assert.deepEqual(calls.rpc[0],{kind:'public',name:'food_go_venue_encounters',args:{p_venue:ids.venue}});
  const canonical='abcdefab-1234-4234-8234-abcdefabcdef';
  fixture.publicData={...publicState,encounters:[{id:ids.campaign,venue:{id:canonical,name:'Fixture venue',slug:'fixture-venue',coordinates:{longitude:144.96,latitude:-37.81}},
    title:'Fixture pool',description:'Only approved fixture items.',theme:'cafe',state:'published',version:at,startsAt:at,endsAt:'2026-11-18T00:00:00Z',radiusMetres:60,cooldownHours:24,
    maxClaims:10,claimedCount:0,offerValidityHours:24,pool:[{id:ids.request,kind:'collectible',name:'Fixture keepsake',description:'A fixture digital item.',rarity:'common',weight:1,promotionId:null}]}]};
  assert.deepEqual(await status(await route.GET(get('venueId='+canonical.toUpperCase())),200),fixture.publicData);
  assert.equal(calls.rpc[1].args.p_venue,canonical);
  await status(await route.GET(get()),503);await status(await route.POST(post(start)),503);
`));
test("encounter route rejects malformed or location-bearing public queries before provider access", () => run(`
  for(const query of ['venueId=invalid','userId='+ids.user,'venueId='+ids.venue+'&latitude=-37','venueId='+ids.venue+'&venueId='+ids.venue])
    await status(await route.GET(get(query)),400);
  assert.equal(calls.auth+calls.anonymous,0);
  env.SUPABASE_PUBLISHABLE_KEY='not-a-public-key';await status(await route.GET(get('venueId='+ids.venue)),503);assert.equal(calls.anonymous,0);
`));
test("encounter route enforces origin, streamed byte limits, deadline and strict claim authority", () => run(`
  await status(await route.POST(post(start,{origin:'https://attacker.example'})),403);
  await status(await route.POST(post(start,{'content-type':'text/plain'})),415);
  await status(await route.POST(post(start,{'content-length':'16385'})),413);
  for(const extra of [{userId:ids.user},{xp:999},{rarity:'legendary'},{latitude:-37},{eligible:true},{itemId:ids.venue}])
    await status(await route.POST(post({...start,...extra})),400);
  let cancelled=false;
  const raw=body=>new Request(origin+'/api/encounters',{method:'POST',headers:{origin,'content-type':'application/json'},body,duplex:'half'});
  await status(await route.POST(raw(new ReadableStream({start(c){c.enqueue(new Uint8Array(16385));},cancel(){cancelled=true;}}))),413);
  assert.equal(cancelled,true);cancelled=false;
  await status(await route.POST(raw(new ReadableStream({cancel(){cancelled=true;}}))),400);
  assert.equal(cancelled,true);assert.ok(calls.bodyDeadlines.includes(5000));assert.equal(calls.auth+calls.anonymous,0);
`));
test("encounter route accepts full reviewed pool bodies beyond the original auth limit and forwards exact commands", () => run(`
  const command={action:'create',requestId:ids.request,encounterId:ids.campaign,venueId:ids.venue,title:'Fixture pool',description:'A'.repeat(600),theme:'cafe',
    radiusMetres:60,cooldownHours:24,startsAt:at,endsAt:'2026-11-18T00:00:00Z',maxClaims:10,offerValidityHours:24,
    pool:Array.from({length:8},(_,i)=>({id:'66666666-6666-4666-8666-'+String(i).padStart(12,'0'),kind:'collectible',name:'N'.repeat(80),description:'D'.repeat(300),rarity:'common',weight:10}))};
  assert.ok(Buffer.byteLength(JSON.stringify(command))>4096);
  await status(await route.POST(post(command)),200);assert.deepEqual(calls.rpc[0],{kind:'account',name:'food_go_encounter_journey',args:{p_action:command}});
  await status(await route.GET(get()),200);assert.deepEqual(calls.rpc[1].args,{p_action:{action:'read'}});
  assert.equal(calls.deadlines.length,2);assert.ok(calls.deadlines.every(ms=>ms===10000));
  fixture.user={id:ids.user,email:'unverified@example.invalid'};await status(await route.POST(post(start)),401);assert.equal(calls.rpc.length,2);
`));
test("encounter route rejects private or inconsistent output and preserves persisted safe guess refusals", () => run(`
  const good=fixture.data;
  for(const data of [{...good,userId:ids.user},{...good,inventory:new Array(501).fill({})},{...good,operator:'true'},{...good,result:{action:'claim',code:'private'}}]){
    fixture.data=data;const body=await status(await route.POST(post(start)),503);assert.ok(!JSON.stringify(body).includes('private'));
  }
  fixture.data={...good,result:{action:'claim',sessionId:ids.session,itemId:null,code:null,codeExpiresAt:null,replayed:false,error:{code:'invalid',message:'The confirmation code is unavailable or expired.'}}};
  const body=await status(await route.POST(post({action:'claim',sessionId:ids.session,code:'a'.repeat(32),requestId:ids.request})),200);
  assert.equal(body.result.error.code,'invalid');assert.equal(body.inventory.length,0);
  fixture.publicData={...publicState,issuer:ids.user};await status(await route.GET(get('venueId='+ids.venue)),503);
`));
test("encounter route sanitises database refusal and transport details", () => run(`
  for(const [code,expected] of [['42501',403],['FG409',409],['FG429',429],['22023',400],['private',503]]){
    fixture.error={code,message:'private provider payload'};const body=await status(await route.POST(post(start)),expected);
    assert.ok(!JSON.stringify(body).includes('private provider payload'));
  }
  fixture.error=null;fixture.throws=true;await status(await route.GET(get()),503);
`));
