import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Evaluate the actual route and its actual server request/auth modules. The
// only replaced application module is the provider client's cookie adapter;
// no cookie, credential, network call or hosted account is needed by this test.
// Each subprocess has a private environment and module cache.
const harness = `
  import assert from 'node:assert/strict';
  import { readFile } from 'node:fs/promises';
  import { stripTypeScriptTypes } from 'node:module';
  import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
  import * as zod from 'zod';
  const origin = 'http://127.0.0.1:3000';
  const sourceRoot = ${JSON.stringify(new URL("../", import.meta.url).href)};
  const domainRoot = ${JSON.stringify(new URL("../../../../packages/domain/src/", import.meta.url).href)};
  const authServer = new URL('lib/auth/server.ts', sourceRoot).href;
  const env = { NODE_ENV:'development', APP_ORIGIN:origin, FOOD_GO_EXPLORATION_ENABLED:'true', FOOD_GO_AUTH_ENABLED:'true',
    SUPABASE_URL:'http://127.0.0.1:54321', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_public_not_a_real_key',
    FOOD_GO_AUTH_COOKIE_SECRET:'fixture-cookie-secret-that-is-at-least-43-characters' };
  const calls = { clients:0, identities:0, rpc:[], signals:[], deadlines:[] };
  const fixture = {
    user:{ id:'11111111-1111-4111-8111-111111111111', email:'explorer@example.invalid', email_confirmed_at:'2026-11-17T00:00:00Z' },
    identityError:null, error:null, throws:false,
    data:{ ok:true, version:1, enabled:true, consented:true, recordingId:'22222222-2222-4222-8222-222222222222',
      cells:['wm18:236633:160858'], observation:null, rewardEligible:false },
  };
  const plain = value => JSON.parse(JSON.stringify(value));
  const client = {
    auth:{ async getUser() { calls.identities++; return {data:{user:fixture.user},error:fixture.identityError}; } },
    rpc(name,args) {
      calls.rpc.push(plain({name,args}));
      return { async abortSignal(signal) { calls.signals.push(signal); if(fixture.throws) throw new Error('private provider details');
        return {data:fixture.data,error:fixture.error}; } };
    },
  };
  const context = createContext({ process:{env}, Request, Response, Headers, URL, TextDecoder, TextEncoder, Uint8Array,
    AbortSignal:new Proxy(AbortSignal,{get(target,key) { return key==='timeout'
      ? milliseconds => {calls.deadlines.push(milliseconds);return target.timeout(milliseconds);}
      : Reflect.get(target,key); }}), AbortController, Buffer, setTimeout, clearTimeout, crypto, console,
    fetch:() => { throw new Error('Network is forbidden in route fixtures'); } });
  const modules = new Map();
  function synthetic(id, exports) {
    const names = Object.keys(exports);
    const module = new SyntheticModule(names, function() { for(const name of names) this.setExport(name,exports[name]); }, {context,identifier:id});
    modules.set(id,module); return module;
  }
  synthetic('fixture:zod',zod);
  synthetic('fixture:server-only',{});
  synthetic(authServer,{ createAuthClient:async () => { calls.clients++; return client; } });
  async function load(id) {
    if(modules.has(id)) return modules.get(id);
    const source = stripTypeScriptTypes(await readFile(new URL(id),'utf8'), {mode:'transform',sourceUrl:id});
    const module = new SourceTextModule(source,{context,identifier:id});
    modules.set(id,module);
    await module.link(async (specifier,parent) => {
      if(specifier==='server-only') return modules.get('fixture:server-only');
      if(specifier==='zod') return modules.get('fixture:zod');
      let target;
      if(specifier.startsWith('@/')) target = new URL(specifier.slice(2),sourceRoot);
      else if(specifier.startsWith('@food-go/domain/')) target = new URL(specifier.slice('@food-go/domain/'.length),domainRoot);
      else if(specifier.startsWith('.')) target = new URL(specifier,parent.identifier);
      else throw new Error('Unreviewed fixture import '+specifier);
      if(!target.pathname.endsWith('.ts')) target.pathname += '.ts';
      return load(target.href);
    });
    return module;
  }
  const routeModule = await load(new URL('app/api/exploration/route.ts',sourceRoot).href);
  await routeModule.evaluate();
  const route = routeModule.namespace;
  const observation = { action:'observe',requestId:'33333333-3333-4333-8333-333333333333', recordingId:fixture.data.recordingId,
    longitude:144.967146,latitude:-37.816813,accuracy:8,timestamp:1800000000000 };
  const make = (value=observation,headers={}) => new Request(origin+'/api/exploration',{method:'POST',
    headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(value)});
  async function responseStatus(response,status) {
    assert.equal(response.status,status);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('pragma'),'no-cache');
    return response.json();
  }
`;

function run(source: string) {
  const result = spawnSync(process.execPath, ["--experimental-vm-modules", "--input-type=module", "--eval", harness + source], {
    cwd: process.cwd(),
    env: { NODE_ENV: "test", SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP },
    encoding: "utf8", timeout: 20000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("actual discovery route keeps disabled and unconfigured saving closed before provider access", () => run(`
  env.FOOD_GO_EXPLORATION_ENABLED='false';
  for(const response of [await route.GET(),await route.POST(make())]) {
    assert.deepEqual(await responseStatus(response,503),{error:'Saving exploration is not enabled yet. You can use a session preview.'});
  }
  assert.equal(calls.clients,0); assert.equal(calls.rpc.length,0);
  env.FOOD_GO_EXPLORATION_ENABLED='true'; env.FOOD_GO_AUTH_ENABLED='false';
  await responseStatus(await route.GET(),503); await responseStatus(await route.POST(make()),503);
  assert.equal(calls.clients,0); assert.equal(calls.rpc.length,0);
`));

test("actual discovery route verifies identity and never calls the RPC for absent or unconfirmed accounts", () => run(`
  for(const user of [null,{id:'11111111-1111-4111-8111-111111111111',email:'unverified@example.invalid'},
    {id:'11111111-1111-4111-8111-111111111111',phone:'+12125550123',phone_confirmed_at:'2026-11-17T00:00:00Z'}]) {
    fixture.user=user;
    for(const response of [await route.GET(),await route.POST(make())])
      assert.deepEqual(await responseStatus(response,401),{error:'Sign in with a verified account to continue.'});
  }
  fixture.user={email:'explorer@example.invalid',email_confirmed_at:'2026-11-17T00:00:00Z'}; fixture.identityError={message:'private token details'};
  await responseStatus(await route.GET(),401);
  assert.equal(calls.rpc.length,0);
`));

test("actual discovery route rejects hostile origins, invalid bodies and forged authority before provider access", () => run(`
  for(const headers of [{origin:'https://attacker.example'},{origin:origin+'/'},{'sec-fetch-site':'cross-site'},{origin:''}])
    await responseStatus(await route.POST(make(observation,headers)),403);
  await responseStatus(await route.POST(make(observation,{'content-type':'text/plain'})),415);
  await responseStatus(await route.POST(make(observation,{'content-length':'4097'})),413);
  for(const payload of [{...observation,userId:'44444444-4444-4444-8444-444444444444'}, {...observation,cells:['wm18:1:2']},
    {...observation,xp:999},{...observation,recordingId:undefined},{...observation,latitude:90},{...observation,timestamp:0},
    {action:'consent',version:2,enabled:true},{action:'clear',userId:'44444444-4444-4444-8444-444444444444'}])
    await responseStatus(await route.POST(make(payload)),400);
  const raw = body => new Request(origin+'/api/exploration',{method:'POST',headers:{origin,'content-type':'application/json'},body,duplex:'half'});
  await responseStatus(await route.POST(raw('{broken-json')),400);
  await responseStatus(await route.POST(raw(new Uint8Array([255]))),400);
  let cancelled=false;
  const oversized=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4097));},cancel(){cancelled=true;}});
  await responseStatus(await route.POST(raw(oversized)),413); assert.equal(cancelled,true);
  assert.equal(calls.clients,0); assert.equal(calls.rpc.length,0);
`));

test("actual discovery route forwards only the validated command and imposes an RPC deadline", () => run(`
  assert.deepEqual(await responseStatus(await route.GET(),200),fixture.data);
  assert.deepEqual(calls.rpc[0],{name:'food_go_geographic_exploration',args:{p_action:{action:'read'}}});
  fixture.data={...fixture.data,observation:{accepted:true,reason:null}};
  assert.deepEqual(await responseStatus(await route.POST(make()),200),fixture.data);
  assert.deepEqual(calls.rpc[1],{name:'food_go_geographic_exploration',args:{p_action:observation}});
  for(const command of [{action:'consent',version:1,enabled:true},{action:'consent',version:1,enabled:false},{action:'clear'}]) {
    const enabled=command.action==='consent' && command.enabled;
    fixture.data={...fixture.data,enabled,recordingId:enabled?observation.recordingId:null,observation:null,
      ...(command.action==='clear'?{cells:[],consented:false}:{})};
    await responseStatus(await route.POST(make(command)),200);
    assert.deepEqual(calls.rpc.at(-1),{name:'food_go_geographic_exploration',args:{p_action:command}});
  }
  assert.equal(calls.identities,5); assert.equal(calls.signals.length,5);
  for(const signal of calls.signals) { assert.ok(signal instanceof AbortSignal); assert.equal(signal.aborted,false); }
  assert.deepEqual(calls.deadlines,Array(5).fill(10000));
`));

test("actual discovery route fails closed on malformed or private provider responses", () => run(`
  const good=fixture.data;
  for(const value of [{...good,rewardEligible:true},{...good,cells:['wm18:01:2']},{...good,cells:Array(4097).fill('wm18:1:2')},
    {...good,recordingId:'invalid'},{...good,longitude:144.96},null]) {
    fixture.data=value;
    for(const response of [await route.GET(),await route.POST(make())])
      assert.deepEqual(await responseStatus(response,503),{error:'The service is temporarily unavailable.'});
  }
  fixture.data=good; fixture.throws=true;
  assert.deepEqual(await responseStatus(await route.GET(),503),{error:'The service is temporarily unavailable.'});
`));

test("actual discovery route maps database failures without returning provider details", () => run(`
  for(const [code,status] of [['42501',403],['FG409',409],['23505',409],['FG429',429],['22023',400],['22P02',400],['unknown',503]]) {
    fixture.error={code,message:'private location and provider details',details:'private fixture state'};
    for(const response of [await route.GET(),await route.POST(make())]) {
      const body=await responseStatus(response,status);
      assert.deepEqual(Object.keys(body),['error']); assert.equal(typeof body.error,'string');
      assert.equal(JSON.stringify(body).includes('private'),false); assert.equal(JSON.stringify(body).includes(code),false);
    }
  }
`));
