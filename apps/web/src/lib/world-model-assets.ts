/**
 * Optional static GLB library. Files are downloaded separately with their
 * attribution notices. The map remains usable without the optional models.
 * This module never grants venue eligibility, visits, rewards or ownership.
 */
import { Box3, Group, Mesh, Texture, Vector3, type Object3D, type Material, type BufferGeometry } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const directory = "/models/world/";
const filenames = {
  kyotoRestaurant: "kyoto-restaurant.glb",
  parkTree: "park-tree.glb",
  riverRock: "river-rock.glb",
  isometricCafe: "isometric-cafe.glb",
  japaneseBakery: "japanese-bakery.glb",
  stylizedFoodTruck: "stylized-food-truck.glb",
  rewardCrates: "reward-crates.glb",
  parkBench: "park-bench.glb",
  streetLight: "street-light.glb",
} as const;
export type WorldAssetId = keyof typeof filenames;
const venueAssetIds = ["kyotoRestaurant", "isometricCafe", "japaneseBakery", "stylizedFoodTruck"] as const;
type VenueAssetId = typeof venueAssetIds[number];
type Manifest = {
  assets: Partial<Record<WorldAssetId, string>>;
  venueModels: Record<string, VenueAssetId>;
};
export type WorldModelTarget = {
  id: string; fallback: Group; x: number; z: number;
  asset?: "parkTree"; width: number; height: number; rotation?: number;
};

export function parseWorldManifest(value: unknown): Manifest {
  const manifest: Manifest = { assets: {}, venueModels: Object.create(null) };
  if (!value || typeof value !== "object") return manifest;
  const input = value as { version?: unknown; assets?: unknown; venueModels?: unknown };
  if (input.version !== 1) return manifest;
  if (input.assets && typeof input.assets === "object") {
    const assets = input.assets as Record<string, unknown>;
    for (const key of Object.keys(filenames) as WorldAssetId[]) {
      if (assets[key] === filenames[key]) manifest.assets[key] = filenames[key];
    }
  }
  if (input.venueModels && typeof input.venueModels === "object") {
    for (const [id, model] of Object.entries(input.venueModels)) {
      if (/^[a-zA-Z0-9_-]{1,120}$/.test(id) && venueAssetIds.includes(model as VenueAssetId)) manifest.venueModels[id] = model as VenueAssetId;
    }
  }
  return manifest;
}

let manifestRequest: Promise<Manifest> | undefined;
function getManifest() {
  manifestRequest ??= fetch(directory + "manifest.json", { cache: "no-store" })
    .then(response => response.ok ? response.json() : null)
    .then(parseWorldManifest).catch(() => parseWorldManifest(null));
  return manifestRequest;
}

/** Centre the complete imported scene on its geographic anchor and align
 * its lowest vertex with the ground. Preserve its original proportions. */
export function groundWorldModel(model: Object3D, width: number, height: number): Group | null {
  const box = new Box3().setFromObject(model);
  if (box.isEmpty()) return null;
  const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
  const scale = Math.min(width / Math.max(size.x, size.z), height / size.y);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const aligned = new Group();
  const scaled = new Group();
  scaled.scale.setScalar(scale);
  scaled.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
  scaled.add(model); aligned.add(scaled);
  return aligned;
}

export function disposeWorldResources(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse(node => {
    const mesh = node as Mesh<BufferGeometry, Material | Material[]>;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

/** Load once per asset per active scene, share mesh resources between clones.
 * Keep the procedural fallback visible until a complete model is ready. */
export async function attachWorldModels(
  scene: Object3D, targets: readonly WorldModelTarget[],
  isActive: () => boolean, onChange: (count: number) => void,
): Promise<void> {
  const manifest = await getManifest();
  if (!isActive()) return;
  const groups = new Map<WorldAssetId, WorldModelTarget[]>();
  for (const target of targets) {
    const id = target.asset ?? manifest.venueModels[target.id];
    if (!id || !manifest.assets[id]) continue;
    const list = groups.get(id) ?? [];
    // Detailed storefronts can have hundreds of draw calls. Bound the imported instances.
    if (id !== "parkTree" && list.length >= 2) continue;
    list.push(target); groups.set(id, list);
  }
  const loader = new GLTFLoader();
  let count = 0;
  await Promise.all(Array.from(groups, async ([asset, entries]) => {
    let imported: Object3D | undefined;
    let attached = false;
    try {
      imported = (await loader.loadAsync(directory + filenames[asset])).scene;
      if (!isActive()) return;
      for (const target of entries) {
        const model = groundWorldModel(imported.clone(true), target.width, target.height);
        if (!model) continue;
        model.position.set(target.x, 0, target.z);
        model.rotation.y = target.rotation ?? 0;
        model.name = "world-model:" + target.id;
        scene.add(model);
        target.fallback.visible = false;
        attached = true;
        count += 1;
      }
      onChange(count);
    } catch {
      // A missing or unsupported model is not a fatal map error.
    } finally {
      if (imported && !attached) disposeWorldResources(imported);
    }
  }));
  if (isActive()) onChange(count);
}
