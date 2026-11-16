import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";

test("actual registration handler never returns inbox success for rejected signup and forwards private age once", () => {
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--import=tsx", "--input-type=module", "--eval", `
    import assert from 'node:assert/strict';
    import { registerWithClient } from ${JSON.stringify(new URL("./auth/actions.ts", import.meta.url).href)};
    const origin='http://127.0.0.1:3000';
    Object.assign(process.env,{NODE_ENV:'development',FOOD_GO_AUTH_ENABLED:'true',APP_ORIGIN:origin,
      SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_public_not_a_real_key',FOOD_GO_AUTH_COOKIE_SECRET:'fixture-cookie-secret-that-is-at-least-43-characters'});
    const payload={email:'fixture@example.invalid',password:'an ephemeral fixture password',displayName:'Fixture user',birthDate:'1990-01-01',accountType:'explorer',acceptedAcknowledgement:true,acknowledgementVersion:'food-go-community-2026-11-15'};
    const request=()=>new Request(origin+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    for(const code of ['signup_disabled','email_provider_disabled','email_address_not_authorized','hook_timeout']){
      let supplied;
      const client={auth:{signUp:async input=>{supplied=input;return {data:{user:null,session:null},error:{status:422,code}}}}};
      const response=await registerWithClient(request(),async()=>client);
      const body=await response.json();assert.equal(response.status,503);assert.equal('message' in body,false);assert.equal(supplied.options.data.date_of_birth,payload.birthDate);
    }
    const response=await registerWithClient(request(),async()=>({auth:{signUp:async()=>({data:{user:null,session:null},error:null})}}));
    assert.equal(response.status,200);assert.equal(typeof(await response.json()).message,'string');
  `], { cwd: process.cwd(), env: { NODE_ENV: "test", SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
    NODE_PATH: join(dirname(createRequire(import.meta.url).resolve("next/package.json")), "dist", "compiled") }, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
