import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, type AnimationAction, type AnimationClip, type Material, type Mesh, type Object3D, type SkinnedMesh, type Texture } from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { AVATAR_ANIMATION_STATES, AVATAR_MODEL_LIMITS, parseAvatarAssetManifest, type AvatarAnimationState, type AvatarAssetManifest } from "../lib/avatar-assets";

export type AvatarModelErrorCode = "manifest" | "aborted" | "network" | "size" | "integrity" | "format" | "external-resource" | "compression" | "rig" | "budget" | "clips";
export class AvatarModelError extends Error {
  constructor(public readonly code: AvatarModelErrorCode) { super(`Character asset ${code}.`); this.name = "AvatarModelError"; }
}
const abort = () => new AvatarModelError("aborted");
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw abort(); }

/** Loaded model owns its resources exclusively. Do not share its materials or
 * textures with another lifetime. Disposal includes ImageBitmap.close().
 */
export function disposeAvatarResources(roots: readonly Object3D[]) {
  const geometries = new Set<Mesh["geometry"]>(), materials = new Set<Material>(), textures = new Set<Texture>();
  const bitmaps = new Set<{ close: () => void }>();
  for (const root of roots) root.traverse(object => {
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
    const skin = object as SkinnedMesh;
    if (skin.isSkinnedMesh && skin.skeleton.boneTexture) textures.add(skin.skeleton.boneTexture);
  });
  for (const material of materials) for (const value of Object.values(material)) if (value && typeof value === "object" && value.isTexture) textures.add(value as Texture);
  for (const texture of textures) {
    const image = texture.image as { close?: () => void } | undefined;
    if (image && typeof image.close === "function") bitmaps.add(image as { close: () => void });
    texture.dispose();
  }
  for (const bitmap of bitmaps) bitmap.close();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function validateRig(scene: Group, manifest: AvatarAssetManifest) {
  const bones = new Set<Object3D>(), materials = new Set<Material>(), textures = new Set<Texture>();
  let triangles = 0, vertices = 0, nodes = 0, skinned = false;
  scene.traverse(object => {
    nodes++;
    const mesh = object as Mesh;
    if ((object as Object3D & { isLight?: boolean; isCamera?: boolean }).isLight || (object as Object3D & { isCamera?: boolean }).isCamera) throw new AvatarModelError("rig");
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position");
    if (!position) throw new AvatarModelError("rig");
    vertices += position.count; triangles += (mesh.geometry.index?.count ?? position.count) / 3;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    const skin = object as SkinnedMesh;
    if (skin.isSkinnedMesh) {
      if (!skin.skeleton.bones.length || !skin.geometry.getAttribute("skinIndex") || !skin.geometry.getAttribute("skinWeight")) throw new AvatarModelError("rig");
      skinned = true; for (const bone of skin.skeleton.bones) bones.add(bone);
    }
  });
  if (!skinned) throw new AvatarModelError("rig");
  for (const material of materials) for (const value of Object.values(material)) if (value && typeof value === "object" && value.isTexture) textures.add(value as Texture);
  if (nodes > AVATAR_MODEL_LIMITS.nodes || triangles > AVATAR_MODEL_LIMITS.triangles || vertices > AVATAR_MODEL_LIMITS.triangles * 3
    || bones.size > AVATAR_MODEL_LIMITS.bones || materials.size > AVATAR_MODEL_LIMITS.materials || textures.size > AVATAR_MODEL_LIMITS.textures) throw new AvatarModelError("budget");
  for (const texture of textures) {
    const image = texture.image as { width?: number; height?: number } | undefined;
    if ((image?.width ?? 0) > AVATAR_MODEL_LIMITS.textureEdge || (image?.height ?? 0) > AVATAR_MODEL_LIMITS.textureEdge) throw new AvatarModelError("budget");
  }
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene), height = box.max.y - box.min.y;
  if (!Number.isFinite(height) || Math.abs(height - manifest.metrics.heightMetres) > Math.max(.08, manifest.metrics.heightMetres * .05)
    || Math.abs(box.min.y) > .05) throw new AvatarModelError("rig");
}

export type LoadedAvatarModel = {
  readonly root: Group; readonly manifest: AvatarAssetManifest; readonly mixer: AnimationMixer;
  readonly actions: Readonly<Record<AvatarAnimationState, AnimationAction>>;
  readonly state: AvatarAnimationState; readonly disposed: boolean;
  setState: (state: AvatarAnimationState, options?: { restart?: boolean; immediate?: boolean }) => void;
  update: (seconds: number) => void; dispose: () => void;
};

/** Controller uses the renderer's existing frame loop. It creates no canvas,
 * renderer, frame scheduler or geographic/verified movement state.
 */
export function createAvatarModel(gltf: Pick<GLTF, "scene" | "scenes" | "animations">, manifest: AvatarAssetManifest): LoadedAvatarModel {
  validateRig(gltf.scene, manifest);
  const byName = new Map<string, AnimationClip>();
  for (const clip of gltf.animations) {
    if (byName.has(clip.name)) throw new AvatarModelError("clips");
    byName.set(clip.name, clip);
  }
  for (const state of AVATAR_ANIMATION_STATES) {
    const clip = byName.get(manifest.clips[state]);
    if (!clip || !Number.isFinite(clip.duration) || clip.duration <= 0 || clip.tracks.length === 0) throw new AvatarModelError("clips");
  }
  const root = new Group(); root.name = `Food Go ${manifest.avatarId}`; root.add(gltf.scene);
  // Canonicalise inside the world pivot so heading changes can set root yaw
  // without losing an asset's authored forward-axis correction.
  if (manifest.metrics.forwardAxis === "-z") gltf.scene.rotation.y += Math.PI;
  const mixer = new AnimationMixer(gltf.scene);
  const actions = Object.fromEntries(AVATAR_ANIMATION_STATES.map(state => {
    const action = mixer.clipAction(byName.get(manifest.clips[state])!);
    const loop = state === "idle" || state === "walk" || state === "jog";
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1); action.clampWhenFinished = !loop;
    return [state, action];
  })) as Record<AvatarAnimationState, AnimationAction>;
  let current: AvatarAnimationState = "idle", locomotion: AvatarAnimationState = "idle", pending: AvatarAnimationState | null = null, disposed = false;
  actions.idle.play(); mixer.update(0);
  function setState(state: AvatarAnimationState, options: { restart?: boolean; immediate?: boolean } = {}) {
    if (disposed || !AVATAR_ANIMATION_STATES.includes(state) || (current === state && !options.restart)) return;
    if (state === "idle" || state === "walk" || state === "jog") locomotion = state;
    const previous = actions[current], next = actions[state];
    if (options.immediate) mixer.stopAllAction();
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (options.immediate || next === previous) next.stopFading();
    else next.crossFadeFrom(previous, .2, false);
    current = state; mixer.update(0);
  }
  const finished = (event: { action: AnimationAction }) => { if (event.action === actions[current]) pending = locomotion; };
  mixer.addEventListener("finished", finished);
  return { root, manifest, mixer, actions, get state() { return current; }, get disposed() { return disposed; }, setState,
    update(seconds) {
      if (disposed || !Number.isFinite(seconds) || seconds < 0) return;
      mixer.update(Math.min(seconds, .1));
      if (pending) { const state = pending; pending = null; setState(state); }
    },
    dispose() {
      if (disposed) return; disposed = true;
      mixer.removeEventListener("finished", finished); mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene);
      disposeAvatarResources(gltf.scenes); for (const scene of gltf.scenes) scene.clear(); root.removeFromParent(); root.clear();
    },
  };
}

function inspectEmbeddedGlb(bytes: ArrayBuffer) {
  if (bytes.byteLength < 20) throw new AvatarModelError("format");
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength
    || view.getUint32(16, true) !== 0x4e4f534a || view.getUint32(12, true) > bytes.byteLength - 20) throw new AvatarModelError("format");
  let json: { buffers?: { uri?: string }[]; images?: { uri?: string }[]; nodes?: unknown[]; materials?: unknown[]; animations?: unknown[]; accessors?: unknown[]; extensionsRequired?: string[]; extensionsUsed?: string[] };
  try { json = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + view.getUint32(12, true)))); } catch { throw new AvatarModelError("format"); }
  if (!json || typeof json !== "object") throw new AvatarModelError("format");
  if (!Array.isArray(json.buffers) || (json.images !== undefined && !Array.isArray(json.images))) throw new AvatarModelError("format");
  if ([json.extensionsRequired, json.extensionsUsed].some(value => value !== undefined && (!Array.isArray(value) || value.some(name => typeof name !== "string")))) throw new AvatarModelError("format");
  for (const [values, maximum] of [[json.nodes, AVATAR_MODEL_LIMITS.nodes], [json.materials, AVATAR_MODEL_LIMITS.materials], [json.animations, 32], [json.accessors, 512], [json.images, AVATAR_MODEL_LIMITS.textures]] as const) {
    if (values !== undefined && (!Array.isArray(values) || values.length > maximum)) throw new AvatarModelError("budget");
  }
  if ([...json.buffers, ...(json.images ?? [])].some(value => !value || typeof value !== "object" || "uri" in value)) throw new AvatarModelError("external-resource");
  const compressed = ["KHR_draco_mesh_compression", "KHR_texture_basisu", "EXT_meshopt_compression", "KHR_meshopt_compression"];
  if ([...(json.extensionsRequired ?? []), ...(json.extensionsUsed ?? [])].some(name => compressed.includes(name))) throw new AvatarModelError("compression");
}

async function readBounded(response: Response, bytes: number, signal?: AbortSignal): Promise<ArrayBuffer> {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > bytes)) throw new AvatarModelError("size");
  const reader = response.body?.getReader();
  if (!reader) throw new AvatarModelError("format");
  const chunks: Uint8Array[] = []; let total = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      checkAbort(signal); const result = await reader.read(); checkAbort(signal);
      if (result.done) break;
      total += result.value.byteLength;
      if (total > bytes) { await reader.cancel(); throw new AvatarModelError("size"); }
      chunks.push(result.value);
    }
  } finally { signal?.removeEventListener("abort", cancel); reader.releaseLock(); }
  if (total !== bytes) throw new AvatarModelError("size");
  const output = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output.buffer;
}

function parseCancellable(bytes: ArrayBuffer, signal?: AbortSignal): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cancelled = () => { if (!settled) { settled = true; reject(abort()); } };
    signal?.addEventListener("abort", cancelled, { once: true });
    if (signal?.aborted) cancelled();
    new GLTFLoader().parseAsync(bytes, "").then(gltf => {
      signal?.removeEventListener("abort", cancelled);
      if (settled) { disposeAvatarResources(gltf.scenes); return; }
      settled = true; resolve(gltf);
    }, () => { signal?.removeEventListener("abort", cancelled); if (!settled) { settled = true; reject(new AvatarModelError("format")); } });
  });
}

/** Safe integration boundary for admitted local art. An empty catalogue uses
 * the existing procedural/illustrated fallback; it never fabricates a model.
 */
export async function loadAvatarModel(value: unknown, options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<LoadedAvatarModel> {
  const manifest = parseAvatarAssetManifest(value);
  if (!manifest) throw new AvatarModelError("manifest");
  const { signal } = options; checkAbort(signal);
  const timeout = new AbortController(), timer = setTimeout(() => timeout.abort(), 15000);
  const loadingSignal = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  let gltf: GLTF | undefined;
  try {
    const response = await (options.fetcher ?? fetch)(manifest.path, { signal: loadingSignal, credentials: "omit", redirect: "error", cache: "force-cache" });
    checkAbort(loadingSignal);
    if (!response.ok) throw new AvatarModelError("network");
    const bytes = await readBounded(response, manifest.byteLength, loadingSignal);
    if (!globalThis.crypto?.subtle) throw new AvatarModelError("integrity");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); checkAbort(loadingSignal);
    if (Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("") !== manifest.sha256) throw new AvatarModelError("integrity");
    inspectEmbeddedGlb(bytes); gltf = await parseCancellable(bytes, loadingSignal); checkAbort(loadingSignal);
    const model = createAvatarModel(gltf, manifest);
    const dispose = model.dispose;
    const cancelled = () => model.dispose();
    model.dispose = () => { signal?.removeEventListener("abort", cancelled); dispose(); };
    signal?.addEventListener("abort", cancelled, { once: true });
    checkAbort(signal); return model;
  } catch (error) {
    if (gltf) disposeAvatarResources(gltf.scenes);
    if (signal?.aborted) throw abort();
    if (timeout.signal.aborted) throw new AvatarModelError("network");
    throw error instanceof AvatarModelError ? error : new AvatarModelError("network");
  } finally { clearTimeout(timer); }
}
