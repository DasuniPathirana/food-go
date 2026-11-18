import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { AnimationClip, Bone, BufferGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, NumberKeyframeTrack, Skeleton, SkinnedMesh, Texture, Uint16BufferAttribute } from "three";
import { AVATAR_ANIMATION_STATES, AVATAR_ASSET_CATALOGUE, avatarAnimationForMotion, parseAvatarAssetManifest, type AvatarAssetManifest } from "./avatar-assets";
import { AvatarModelError, createAvatarModel, disposeAvatarResources, loadAvatarModel } from "../components/avatar-model-loader";

function manifest(bytes: ArrayBuffer): AvatarAssetManifest {
  return {
    version: 1, avatarId: "foodie", path: "/models/avatars/test-fixture.glb", byteLength: bytes.byteLength,
    sha256: createHash("sha256").update(new Uint8Array(bytes)).digest("hex"),
    licence: { name: "Unit test fixture", author: "Food Go tests", sourceUrl: "https://example.invalid/test-fixture", noticePath: "/models/avatars/licenses/test-fixture.txt", commercialUse: true, redistribution: true, attributionRequired: false },
    metrics: { heightMetres: 1.8, eyeHeightMetres: 1.7, walkCycleMetres: 1.45, jogCycleMetres: 2.1, forwardAxis: "+z", units: "metres", rootMotion: "in-place" },
    clips: Object.fromEntries(AVATAR_ANIMATION_STATES.map(state => [state, state])) as AvatarAssetManifest["clips"],
  };
}

/** Tiny authored test rig, never registered as production artwork. */
function fixtureRig() {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, .3, 1.8, 0, -.3, 1, 0], 3));
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(new Uint16Array(12), 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const material = new MeshStandardMaterial(), skin = new SkinnedMesh(geometry, material), hip = new Bone();
  skin.add(hip); skin.bind(new Skeleton([hip]));
  const scene = new Group(); scene.add(skin);
  const animations = AVATAR_ANIMATION_STATES.map((state, index) => new AnimationClip(state, 1, [new NumberKeyframeTrack(".position[x]", [0, 1], [0, (index + 1) * .02])]));
  return { scene, scenes: [scene], animations, geometry, material };
}

function fixtureGlb(change?: (json: Record<string, unknown>) => void): ArrayBuffer {
  const segments: Uint8Array[] = [], views: { buffer: number; byteOffset: number; byteLength: number }[] = [];
  let size = 0;
  function add(array: Float32Array | Uint16Array) {
    const data = new Uint8Array(array.buffer); const index = views.length;
    views.push({ buffer: 0, byteOffset: size, byteLength: data.byteLength });
    const padded = new Uint8Array(Math.ceil(data.byteLength / 4) * 4); padded.set(data); segments.push(padded); size += padded.byteLength;
    return index;
  }
  const positions = add(new Float32Array([0, 0, 0, .3, 1.8, 0, -.3, 1, 0]));
  const joints = add(new Uint16Array(12));
  const weights = add(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]));
  const times = add(new Float32Array([0, 1]));
  const translations = add(new Float32Array([0, 0, 0, 0, .01, 0]));
  const json: Record<string, unknown> = {
    asset: { version: "2.0", generator: "Food Go unit test fixture" }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: "Explorer", mesh: 0, skin: 0, children: [1] }, { name: "Hip" }], skins: [{ joints: [1], skeleton: 1 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    buffers: [{ byteLength: size }], bufferViews: views,
    accessors: [
      { bufferView: positions, componentType: 5126, count: 3, type: "VEC3", min: [-.3, 0, 0], max: [.3, 1.8, 0] },
      { bufferView: joints, componentType: 5123, count: 3, type: "VEC4" },
      { bufferView: weights, componentType: 5126, count: 3, type: "VEC4" },
      { bufferView: times, componentType: 5126, count: 2, type: "SCALAR", min: [0], max: [1] },
      { bufferView: translations, componentType: 5126, count: 2, type: "VEC3" },
    ],
    animations: AVATAR_ANIMATION_STATES.map(name => ({ name, samplers: [{ input: 3, output: 4 }], channels: [{ sampler: 0, target: { node: 1, path: "translation" } }] })),
  };
  change?.(json);
  const encoded = new TextEncoder().encode(JSON.stringify(json)), jsonLength = Math.ceil(encoded.length / 4) * 4;
  const output = new ArrayBuffer(12 + 8 + jsonLength + 8 + size), bytes = new Uint8Array(output), header = new DataView(output);
  header.setUint32(0, 0x46546c67, true); header.setUint32(4, 2, true); header.setUint32(8, output.byteLength, true);
  header.setUint32(12, jsonLength, true); header.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + jsonLength); bytes.set(encoded, 20);
  header.setUint32(20 + jsonLength, size, true); header.setUint32(24 + jsonLength, 0x004e4942, true);
  let offset = 28 + jsonLength; for (const segment of segments) { bytes.set(segment, offset); offset += segment.byteLength; }
  return output;
}
const errorCode = (code: string) => (error: unknown) => error instanceof AvatarModelError && error.code === code;

test("asset admission requires canonical local art, explicit redistribution rights, metrics and distinct clips", () => {
  const valid = manifest(fixtureGlb());
  assert.deepEqual(parseAvatarAssetManifest(valid), valid);
  assert.deepEqual(AVATAR_ASSET_CATALOGUE, {}, "No supplied production art may be invented by this boundary");
  for (const value of [
    { ...valid, path: "https://example.invalid/avatar.glb" }, { ...valid, path: "/models/avatars/../avatar.glb" },
    { ...valid, path: "/models/avatars/a//b.glb" }, { ...valid, path: "/models/avatars/a.glb?key=x" },
    { ...valid, licence: { ...valid.licence, redistribution: false } }, { ...valid, sha256: "bad" },
    { ...valid, metrics: { ...valid.metrics, eyeHeightMetres: 2 } }, { ...valid, clips: { ...valid.clips, jog: valid.clips.walk } },
    { ...valid, verified: true }, { ...valid, byteLength: 50_000_000 },
  ]) assert.equal(parseAvatarAssetManifest(value), null);
  assert.equal(avatarAnimationForMotion({ walking: true, action: "idle" }), "walk");
  assert.equal(avatarAnimationForMotion({ walking: false, action: "wave" }), "interact");
});

test("a real animation mixer crossfades locomotion, returns after one-shot actions and freezes without updates", () => {
  const rig = fixtureRig(), model = createAvatarModel(rig, manifest(fixtureGlb()));
  model.setState("walk"); model.update(.1);
  assert.ok(model.actions.walk.getEffectiveWeight() > 0 && model.actions.walk.getEffectiveWeight() < 1);
  assert.ok(model.actions.idle.getEffectiveWeight() > 0 && model.actions.idle.getEffectiveWeight() < 1);
  model.update(.1); model.update(.1);
  assert.equal(model.actions.walk.getEffectiveWeight(), 1);
  const before = model.actions.walk.time; model.update(Number.NaN); model.update(-1); assert.equal(model.actions.walk.time, before);
  model.setState("celebrate");
  for (let tick = 0; tick < 12; tick++) model.update(.1);
  assert.equal(model.state, "walk");
  model.setState("discover", { immediate: true }); model.update(0);
  assert.equal(model.actions.walk.isRunning(), false); assert.equal(model.actions.discover.getEffectiveWeight(), 1);
  model.dispose(); assert.equal(model.disposed, true); model.update(.1); assert.equal(model.root.children.length, 0);
});

test("disposal releases shared geometry, materials, textures and bitmaps once per model lifetime", () => {
  const rig = fixtureRig(); let geometry = 0, material = 0, texture = 0, bitmap = 0;
  const map = new Texture({ width: 1, height: 1, close() { bitmap++; } });
  rig.material.map = map; rig.material.emissiveMap = map;
  rig.geometry.addEventListener("dispose", () => geometry++); rig.material.addEventListener("dispose", () => material++); map.addEventListener("dispose", () => texture++);
  const model = createAvatarModel(rig, manifest(fixtureGlb())); model.dispose(); model.dispose();
  assert.deepEqual([geometry, material, texture, bitmap], [1, 1, 1, 1]);
});

test("a real rig must match metric scale and material budgets before it can enter a renderer", () => {
  const rig = fixtureRig(), source = manifest(fixtureGlb());
  assert.throws(() => createAvatarModel(rig, { ...source, metrics: { ...source.metrics, heightMetres: 2.1 } }), errorCode("rig"));
  const mesh = rig.scene.children[0] as SkinnedMesh;
  mesh.material = Array.from({ length: 5 }, () => new MeshStandardMaterial());
  assert.throws(() => createAvatarModel(rig, source), errorCode("budget"));
  disposeAvatarResources(rig.scenes); rig.material.dispose();
});

test("forward-axis correction lives below the world heading pivot", () => {
  const rig = fixtureRig(), source = manifest(fixtureGlb());
  const model = createAvatarModel(rig, { ...source, metrics: { ...source.metrics, forwardAxis: "-z" } });
  assert.equal(model.root.rotation.y, 0); assert.equal(rig.scene.rotation.y, Math.PI);
  model.root.rotation.y = .7; assert.equal(rig.scene.rotation.y, Math.PI);
  model.dispose();
});

test("embedded GLB loading validates integrity and actual skin/clip assets without a graphics context", async () => {
  const bytes = fixtureGlb(), source = manifest(bytes); let requests = 0;
  const model = await loadAvatarModel(source, { fetcher: async (input, init) => {
    requests++; assert.equal(input, source.path); assert.equal(init?.credentials, "omit"); assert.equal(init?.redirect, "error");
    return new Response(bytes);
  } });
  assert.equal(requests, 1); assert.equal(model.state, "idle");
  model.setState("walk"); model.update(.1); assert.equal(model.state, "walk"); model.dispose();
  await assert.rejects(loadAvatarModel({ ...source, sha256: "0".repeat(64) }, { fetcher: async () => new Response(bytes) }), errorCode("integrity"));
  await assert.rejects(loadAvatarModel(source, { fetcher: async () => new Response(new Uint8Array(source.byteLength + 1)) }), errorCode("size"));
});

test("external resources, unsupported decoders and missing authored clips fail closed", async () => {
  for (const [change, code] of [
    [(json: Record<string, unknown>) => { json.images = [{ uri: "https://example.invalid/texture.png" }]; }, "external-resource"],
    [(json: Record<string, unknown>) => { json.extensionsUsed = ["KHR_draco_mesh_compression"]; }, "compression"],
    [(json: Record<string, unknown>) => { json.animations = []; }, "clips"],
  ] as const) {
    const bytes = fixtureGlb(change);
    await assert.rejects(loadAvatarModel(manifest(bytes), { fetcher: async () => new Response(bytes) }), errorCode(code));
  }
});

test("abort prevents requests, cancels pending response reads and disposes a completed model", async () => {
  const bytes = fixtureGlb(), source = manifest(bytes), early = new AbortController(); early.abort(); let requests = 0;
  await assert.rejects(loadAvatarModel(source, { signal: early.signal, fetcher: async () => { requests++; return new Response(bytes); } }), errorCode("aborted"));
  assert.equal(requests, 0);
  const pending = new AbortController(); let cancelled = false;
  const loading = loadAvatarModel(source, { signal: pending.signal, fetcher: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
  setTimeout(() => pending.abort(), 0);
  await assert.rejects(loading, errorCode("aborted")); assert.equal(cancelled, true);
  const signal = new AbortController(), model = await loadAvatarModel(source, { signal: signal.signal, fetcher: async () => new Response(bytes) });
  signal.abort(); assert.equal(model.disposed, true);
});
