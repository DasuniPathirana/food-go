import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import { MercatorCoordinate } from "maplibre-gl";
import {
  AmbientLight,
  AnimationAction,
  AnimationMixer,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  RingGeometry,
  Scene,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { attachWorldModels, type WorldModelTarget } from "./world-model-assets";
import type { LiveMall, VenueAppearance, WorldLoot } from "./world-data";
import { AVATAR_ASSET_CATALOGUE } from "./avatar-assets";
import type { AvatarId } from "./avatar-preferences";

export const GAME_WORLD_OBJECT_LAYER = "food-go-game-world-objects";

const ORIGIN_LNG = 144.9665;
const ORIGIN_LAT = -37.8152;

export type GameWorldObject = {
  id: string;
  name?: string;
  longitude: number;
  latitude: number;
  kind: "restaurant" | "cafe" | "market" | "bakery" | "food_truck" | "mall" | "lamp" | "bench" | "park" | "tree" | "building" | "roof";
  preset?: string;
  accentColour?: string;
  shopCount?: number;
  width?: number;
  depth?: number;
  height?: number;
  variant?: number;
  selected?: boolean;
};

export type GameWorldPlayerState = {
  longitude: number;
  latitude: number;
  heading: number;
  walking: boolean;
  speedMode?: "walk" | "jog";
  celebrating?: boolean;
  avatarId: AvatarId;
  hiddenInFirstPerson?: boolean;
};

export type GameWorldSceneData = {
  objects: readonly GameWorldObject[];
  player?: GameWorldPlayerState;
  loots?: readonly WorldLoot[];
  malls?: readonly LiveMall[];
  appearances?: Readonly<Record<string, VenueAppearance>>;
  trailCoords?: readonly [number, number][];
  reducedMotion?: boolean;
};

const AVATAR_TINTS: Record<AvatarId, { jacket: string; pack: string }> = {
  explorer: { jacket: "#ea6c28", pack: "#0e7d6c" },
  foodie: { jacket: "#ff7b5c", pack: "#103b33" },
  trailblazer: { jacket: "#28bdb0", pack: "#1a3c48" },
  "anime-sky": { jacket: "#4388de", pack: "#1d2f52" },
  "anime-violet": { jacket: "#b782ed", pack: "#383459" },
};

function projectLocalMeters(lng: number, lat: number): { x: number; z: number } {
  const originMerc = MercatorCoordinate.fromLngLat([ORIGIN_LNG, ORIGIN_LAT], 0);
  const meterScale = originMerc.meterInMercatorCoordinateUnits();
  const pt = MercatorCoordinate.fromLngLat([lng, lat], 0);
  return {
    x: (pt.x - originMerc.x) / meterScale,
    z: (pt.y - originMerc.y) / meterScale,
  };
}

function makeMysteryQuestionTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 118);
    grad.addColorStop(0, "rgba(255, 240, 122, 0.96)");
    grad.addColorStop(0.65, "rgba(245, 180, 36, 0.55)");
    grad.addColorStop(1, "rgba(245, 180, 36, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "900 132px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 18;
    ctx.fillText("?", 128, 134);
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeFootprintTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = "#2cf6d8";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 14;
    // Left sole print
    ctx.beginPath();
    ctx.ellipse(42, 54, 13, 24, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(44, 88, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right sole print offset forward
    ctx.beginPath();
    ctx.ellipse(84, 34, 13, 24, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(82, 68, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function venueAssetForKind(kind: GameWorldObject["kind"], preset?: string) {
  if (preset === "japanese-bakery" || preset === "isometric-cafe" || preset === "city-bistro") {
    return "japaneseBakery" as const;
  }
  if (preset === "kyoto-restaurant") return "kyotoRestaurant" as const;
  if (preset === "stylized-food-truck") return "stylizedFoodTruck" as const;
  if (kind === "cafe" || kind === "bakery") return "japaneseBakery" as const;
  if (kind === "food_truck") return "stylizedFoodTruck" as const;
  return "kyotoRestaurant" as const;
}

function createStyledVenueFallback(kind: GameWorldObject["kind"], accentHex = "#00b894"): Group {
  const g = new Group();
  const baseMat = new MeshStandardMaterial({ color: "#faf3e3", roughness: 0.72, metalness: 0.05 });
  const roofColor = kind === "cafe" ? "#0b7261" : kind === "bakery" ? "#e05a3a" : kind === "mall" ? "#0d5b4f" : accentHex;
  const roofMat = new MeshStandardMaterial({ color: roofColor, roughness: 0.55, metalness: 0.1 });
  const trimMat = new MeshStandardMaterial({ color: "#f6c944", roughness: 0.35, metalness: 0.25 });

  const bodyW = kind === "mall" ? 26 : 14;
  const bodyD = kind === "mall" ? 22 : 12;
  const bodyH = kind === "mall" ? 18 : 10;

  const body = new Mesh(new BoxGeometry(bodyW, bodyH, bodyD), baseMat);
  body.position.y = bodyH / 2;
  g.add(body);

  const roof = new Mesh(new BoxGeometry(bodyW + 1.2, 2.2, bodyD + 1.2), roofMat);
  roof.position.y = bodyH + 1.1;
  g.add(roof);

  const awning = new Mesh(new BoxGeometry(bodyW - 2, 0.9, 3.2), trimMat);
  awning.position.set(0, 4.2, bodyD / 2 + 1.2);
  g.add(awning);

  return g;
}

function createLootVisualGroup(loot: WorldLoot, mysteryTex: CanvasTexture): { group: Group; spinner: Object3D } {
  const group = new Group();
  const isAr = loot.grabMode === "ar_grab";
  const ringColor = isAr ? "#fb923c" : "#00f0ff";
  const glowColor = isAr ? "#f59e0b" : "#00d2aa";

  // Ground beacon ring
  const outerRing = new Mesh(
    new RingGeometry(3.4, 4.2, 32),
    new MeshBasicMaterial({ color: ringColor, side: DoubleSide, transparent: true, opacity: 0.85 })
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.22;
  group.add(outerRing);

  const innerDisc = new Mesh(
    new RingGeometry(0.1, 3.3, 32),
    new MeshBasicMaterial({ color: glowColor, side: DoubleSide, transparent: true, opacity: 0.22 })
  );
  innerDisc.rotation.x = -Math.PI / 2;
  innerDisc.position.y = 0.18;
  group.add(innerDisc);

  const spinner = new Group();
  spinner.position.y = 4.6;

  if (loot.modelStyle === "mystery_ring") {
    const badge = new Mesh(
      new PlaneGeometry(7.2, 7.2),
      new MeshBasicMaterial({ map: mysteryTex, transparent: true, side: DoubleSide, depthWrite: false })
    );
    spinner.add(badge);
    const halo = new Mesh(
      new TorusGeometry(2.6, 0.26, 10, 28),
      new MeshStandardMaterial({ color: "#f6c944", emissive: "#f59e0b", emissiveIntensity: 0.75, roughness: 0.25 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -2.2;
    spinner.add(halo);
  } else if (loot.modelStyle === "reward_crate" || loot.modelStyle === "star_chest" || loot.modelStyle === "dish_trophy") {
    const base = new Mesh(
      new CylinderGeometry(2.4, 3.0, 1.0, 12),
      new MeshStandardMaterial({ color: "#4e6357", roughness: 0.8 })
    );
    base.position.y = -3.8;
    group.add(base);

    const crateMat = new MeshStandardMaterial({
      color: isAr ? "#ff8a34" : "#0d7463",
      emissive: isAr ? "#b45309" : "#008f78",
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.25,
    });
    const crate = new Mesh(new BoxGeometry(3.8, 3.4, 3.8), crateMat);
    spinner.add(crate);

    const band = new Mesh(
      new BoxGeometry(4.05, 0.85, 4.05),
      new MeshStandardMaterial({ color: "#ffd445", emissive: "#f59e0b", emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.2 })
    );
    spinner.add(band);
  } else {
    // Golden glowing crystal matching uploaded mockup
    const rockBase = new Mesh(
      new CylinderGeometry(2.8, 3.6, 1.1, 8),
      new MeshStandardMaterial({ color: "#587052", roughness: 0.9 })
    );
    rockBase.position.y = -3.9;
    group.add(rockBase);

    const crystalMat = new MeshStandardMaterial({
      color: "#ffdf5e",
      emissive: "#f59e0b",
      emissiveIntensity: 0.85,
      roughness: 0.12,
      metalness: 0.3,
    });
    const mainShard = new Mesh(new OctahedronGeometry(2.1, 0), crystalMat);
    mainShard.scale.set(0.85, 1.7, 0.85);
    spinner.add(mainShard);

    const sideShard = new Mesh(new OctahedronGeometry(1.15, 0), crystalMat);
    sideShard.position.set(1.4, -0.9, 0.45);
    sideShard.rotation.z = -0.38;
    sideShard.scale.set(0.75, 1.35, 0.75);
    spinner.add(sideShard);

    const sideShard2 = new Mesh(new OctahedronGeometry(1.0, 0), crystalMat);
    sideShard2.position.set(-1.3, -1.0, -0.4);
    sideShard2.rotation.z = 0.42;
    sideShard2.scale.set(0.75, 1.25, 0.75);
    spinner.add(sideShard2);
  }

  group.add(spinner);
  return { group, spinner };
}

type GreensFeature = {
  geometry: { coordinates: [number, number][][] | [number, number][][][] };
  properties?: { kind?: string };
};

let cachedParkTreesPromise: Promise<[number, number][]> | null = null;
function loadPilotParkTreePointsOnce(): Promise<[number, number][]> {
  if (!cachedParkTreesPromise && typeof window !== "undefined") {
    cachedParkTreesPromise = fetch("/data/melbourne-pilot-greens-water.geojson")
      .then(res => (res.ok ? res.json() : { features: [] }))
      .then((fc: { features?: GreensFeature[] }) => {
        const features = Array.isArray(fc?.features) ? fc.features : [];
        const pts: [number, number][] = [];
        for (const f of features) {
          const kind = (f.properties?.kind ?? "").toLowerCase();
          if (kind.includes("water") || kind.includes("river") || kind.includes("bay")) continue;
          const coords = Array.isArray(f.geometry?.coordinates?.[0]?.[0])
            ? (f.geometry.coordinates[0] as unknown as [number, number][])
            : [];
          if (!coords.length) continue;
          const step = Math.max(1, Math.floor(coords.length / 2));
          for (let i = 0; i < coords.length && pts.length < 24; i += step) {
            const p = coords[i];
            if (Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number") {
              pts.push([p[0], p[1]]);
            }
          }
          if (pts.length >= 24) break;
        }
        return pts;
      })
      .catch(() => []);
  }
  return cachedParkTreesPromise ?? Promise.resolve([]);
}

function disposeThreeObject(obj: Object3D) {
  obj.traverse(child => {
    const mesh = child as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else if (mat) mat.dispose();
  });
}

export function createGameWorldObjectLayer(
  objects: readonly GameWorldObject[],
  initialScene?: Partial<GameWorldSceneData>
): CustomLayerInterface {
  let mapRef: MapLibreMap | null = null;
  let renderer: WebGLRenderer | null = null;
  const scene = new Scene();
  const camera = new PerspectiveCamera();

  const worldRoot = new Group();
  scene.add(worldRoot);

  const cityBlocksGroup = new Group();
  const venuesGroup = new Group();
  const lootsGroup = new Group();
  const trailGroup = new Group();
  const playerGroup = new Group();
  const playerHaloGroup = new Group();

  worldRoot.add(cityBlocksGroup);
  worldRoot.add(venuesGroup);
  worldRoot.add(lootsGroup);
  worldRoot.add(trailGroup);
  worldRoot.add(playerGroup);
  playerGroup.add(playerHaloGroup);

  const ambient = new AmbientLight("#fff9eb", 1.35);
  const hemi = new HemisphereLight("#e6fffa", "#8dc873", 1.15);
  const sun = new DirectionalLight("#fff4d6", 1.65);
  sun.position.set(180, 340, 220);
  scene.add(ambient, hemi, sun);

  // Build glowing concentric cyan ring under explorer matching Pokemon GO style
  const outerRing = new Mesh(
    new RingGeometry(2.1, 2.65, 36),
    new MeshBasicMaterial({ color: "#00f0ff", side: DoubleSide, transparent: true, opacity: 0.94 })
  );
  outerRing.rotation.x = -Math.PI / 2;
  outerRing.position.y = 0.25;
  playerHaloGroup.add(outerRing);

  const midRing = new Mesh(
    new RingGeometry(1.1, 1.48, 32),
    new MeshBasicMaterial({ color: "#2cf6d8", side: DoubleSide, transparent: true, opacity: 0.62 })
  );
  midRing.rotation.x = -Math.PI / 2;
  midRing.position.y = 0.22;
  playerHaloGroup.add(midRing);

  // Fallback sculpted explorer figure until GLB completes
  const fallbackPlayer = new Group();
  const legMat = new MeshStandardMaterial({ color: "#28363a", roughness: 0.7 });
  const topMat = new MeshStandardMaterial({ color: "#008f78", roughness: 0.55 });
  const skinMat = new MeshStandardMaterial({ color: "#eab68d", roughness: 0.65 });
  const packMat = new MeshStandardMaterial({ color: "#103b33", roughness: 0.6 });
  const legs = new Mesh(new CylinderGeometry(0.9, 1.0, 3.6, 10), legMat);
  legs.position.y = 1.8;
  const torso = new Mesh(new CylinderGeometry(1.1, 0.95, 3.2, 12), topMat);
  torso.position.y = 5.1;
  const pack = new Mesh(new BoxGeometry(1.7, 2.3, 0.95), packMat);
  pack.position.set(0, 5.2, -1.1);
  const head = new Mesh(new SphereGeometry(0.95, 14, 14), skinMat);
  head.position.y = 7.6;
  fallbackPlayer.add(legs, torso, pack, head);
  playerGroup.add(fallbackPlayer);

  // Real animated Pathfinder GLB rig
  let avatarMixer: AnimationMixer | null = null;
  let avatarRoot: Object3D | null = null;
  let activeClip: string = "idle";
  const avatarActions: Record<string, AnimationAction> = {};
  let currentPlayer: GameWorldPlayerState | undefined = initialScene?.player;

  const mysteryTex = makeMysteryQuestionTexture();
  const footprintTex = makeFootprintTexture();

  let currentObjects = objects;
  let currentLoots: readonly WorldLoot[] = initialScene?.loots ?? [];
  let currentMalls: readonly LiveMall[] = initialScene?.malls ?? [];
  let currentAppearances = initialScene?.appearances ?? {};
  let currentTrail = initialScene?.trailCoords ?? [];
  let reducedMotion = initialScene?.reducedMotion ?? false;

  const lootSpinners: Object3D[] = [];
  let abortAssets = new AbortController();
  let abortTrees = new AbortController();
  let lastVenuesKey = "";
  let lastFrameMs = 0;
  let parkTreesBuilt = false;
  let cachedTreePoints: [number, number][] = [];
  let disposed = false;

  const syncAvatarMaterials = (avatarId: AvatarId) => {
    const palette = AVATAR_TINTS[avatarId] ?? AVATAR_TINTS.foodie;
    topMat.color.set(palette.jacket);
    packMat.color.set(palette.pack);
    if (!avatarRoot) return;
    avatarRoot.traverse(obj => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const name = obj.name.toLowerCase();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          if (name.includes("jacket") || name.includes("hoodie") || name.includes("shirt") || name.includes("torso")) {
            mat.color.lerp(new Color(palette.jacket), 0.35);
          } else if (name.includes("pack") || name.includes("bag")) {
            mat.color.lerp(new Color(palette.pack), 0.35);
          }
        }
      }
    });
  };

  const setAvatarAnimation = (clipName: string) => {
    if (!avatarMixer || activeClip === clipName || !avatarActions[clipName]) return;
    const prev = avatarActions[activeClip];
    const next = avatarActions[clipName];
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (prev && prev !== next) {
      prev.crossFadeTo(next, 0.22, true);
    }
    activeClip = clipName;
  };

  const rebuildVenuesAndMalls = () => {
    const objKey = currentObjects
      .filter(o => o.kind !== "lamp" && o.kind !== "bench" && o.kind !== "building" && o.kind !== "park" && o.kind !== "tree" && o.kind !== "roof")
      .map(o => `${o.id}:${o.kind}:${o.preset ?? currentAppearances[o.id]?.buildingPreset ?? ""}:${o.longitude.toFixed(5)},${o.latitude.toFixed(5)}`)
      .join("|");
    const mallKey = currentMalls.map(m => `${m.id}:${m.coordinates.longitude.toFixed(5)},${m.coordinates.latitude.toFixed(5)}`).join("|");
    const nextKey = `${objKey}#${mallKey}`;
    if (nextKey === lastVenuesKey) return;
    lastVenuesKey = nextKey;

    abortAssets.abort();
    abortAssets = new AbortController();
    disposeThreeObject(venuesGroup);
    venuesGroup.clear();

    const targets: WorldModelTarget[] = [];
    const mallIdsSeen = new Set<string>();

    for (const item of currentObjects) {
      if (item.kind === "lamp" || item.kind === "bench" || item.kind === "building" || item.kind === "park" || item.kind === "tree" || item.kind === "roof") {
        continue;
      }
      if (item.kind === "mall") mallIdsSeen.add(item.id);
      const { x, z } = projectLocalMeters(item.longitude, item.latitude);
      const app = currentAppearances[item.id];
      const preset = item.preset ?? app?.buildingPreset;
      const accent = item.accentColour ?? app?.buildingAccentColour ?? "#00c49a";
      const fallback = createStyledVenueFallback(item.kind, accent);
      fallback.visible = false;
      fallback.position.set(x, 0, z);
      venuesGroup.add(fallback);

      if (item.kind !== "mall") {
        const asset = venueAssetForKind(item.kind, preset);
        targets.push({
          id: item.id,
          fallback,
          x,
          z,
          asset,
          width: item.width ?? 22,
          height: item.height ?? 16,
          rotation: ((item.id.charCodeAt(0) % 4) * Math.PI) / 2,
        });
      } else {
        targets.push({
          id: `mall-obj-${item.id}`,
          fallback,
          x,
          z,
          asset: "kyotoRestaurant",
          width: 26,
          height: 18,
          rotation: 0,
        });
      }
    }

    // Add published Melbourne Malls using real 3D GLB complex models (never flat untextured cubes)
    for (const mall of currentMalls) {
      if (mallIdsSeen.has(mall.id)) continue;
      const { x, z } = projectLocalMeters(mall.coordinates.longitude, mall.coordinates.latitude);
      const mallFallback = createStyledVenueFallback("mall", "#0c6e5d");
      mallFallback.visible = false;
      mallFallback.position.set(x, 0, z);
      const crown = new Mesh(
        new ConeGeometry(2.6, 3.4, 6),
        new MeshStandardMaterial({ color: "#ffd445", emissive: "#f59e0b", emissiveIntensity: 0.72 })
      );
      crown.position.y = 20.5;
      mallFallback.add(crown);
      venuesGroup.add(mallFallback);
      targets.push({
        id: `mall-${mall.id}`,
        fallback: mallFallback,
        x,
        z,
        asset: "kyotoRestaurant",
        width: 24,
        height: 17,
        rotation: 0,
      });
    }

    if (targets.length > 0 && typeof window !== "undefined") {
      const localSignal = abortAssets.signal;
      void attachWorldModels(
        venuesGroup,
        targets,
        () => !disposed && !localSignal.aborted,
        () => mapRef?.triggerRepaint()
      );
    }
  };

  const rebuildLoots = () => {
    disposeThreeObject(lootsGroup);
    lootsGroup.clear();
    lootSpinners.length = 0;
    for (const loot of currentLoots) {
      const { x, z } = projectLocalMeters(loot.coordinates.longitude, loot.coordinates.latitude);
      const { group, spinner } = createLootVisualGroup(loot, mysteryTex);
      group.position.set(x, 0, z);
      lootsGroup.add(group);
      lootSpinners.push(spinner);
    }
  };

  const rebuildTrail = () => {
    disposeThreeObject(trailGroup);
    trailGroup.clear();
    if (!currentTrail || currentTrail.length < 2) return;

    const footprintMat = new MeshBasicMaterial({
      map: footprintTex,
      transparent: true,
      opacity: 0.92,
      side: DoubleSide,
      depthWrite: false,
    });
    const dotMat = new MeshBasicMaterial({ color: "#2cf6d8", transparent: true, opacity: 0.72, side: DoubleSide });

    let accum = 0;
    const stepSpacing = 7.5;
    for (let i = 0; i < currentTrail.length - 1; i++) {
      const a = projectLocalMeters(currentTrail[i][0], currentTrail[i][1]);
      const b = projectLocalMeters(currentTrail[i + 1][0], currentTrail[i + 1][1]);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 0.5) continue;
      const yaw = Math.atan2(dx, dz);
      let d = stepSpacing - (accum % stepSpacing);
      while (d < segLen && trailGroup.children.length < 180) {
        const t = d / segLen;
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const decal = new Mesh(new PlaneGeometry(3.2, 3.2), footprintMat);
        decal.position.set(px, 0.24, pz);
        decal.rotation.set(-Math.PI / 2, 0, -yaw);
        trailGroup.add(decal);

        const glow = new Mesh(new RingGeometry(0.35, 0.85, 16), dotMat);
        glow.position.set(px, 0.2, pz);
        glow.rotation.x = -Math.PI / 2;
        trailGroup.add(glow);

        d += stepSpacing;
      }
      accum += segLen;
    }
  };

  const rebuildCityBlocks = () => {
    // Populate 3D greenery once in its own group without tearing down venue/mall buildings
    if (!cachedTreePoints.length || parkTreesBuilt) return;
    parkTreesBuilt = true;
    abortTrees.abort();
    abortTrees = new AbortController();
    disposeThreeObject(cityBlocksGroup);
    cityBlocksGroup.clear();

    const treeTargets: WorldModelTarget[] = cachedTreePoints.map(([lng, lat], i) => {
      const { x, z } = projectLocalMeters(lng, lat);
      const stub = new Group();
      stub.visible = false;
      stub.position.set(x, 0, z);
      cityBlocksGroup.add(stub);
      return {
        id: `park-tree-${i}`,
        fallback: stub,
        x,
        z,
        asset: "parkTree" as const,
        width: 7,
        height: 8.5,
        rotation: (i * 1.1) % (Math.PI * 2),
      };
    });

    if (treeTargets.length > 0 && typeof window !== "undefined") {
      const treeSignal = abortTrees.signal;
      void attachWorldModels(
        cityBlocksGroup,
        treeTargets,
        () => !disposed && !treeSignal.aborted,
        () => mapRef?.triggerRepaint()
      );
    }
  };

  if (typeof window !== "undefined") {
    void loadPilotParkTreePointsOnce().then(points => {
      if (disposed) return;
      cachedTreePoints = points;
      rebuildCityBlocks();
      mapRef?.triggerRepaint();
    });

    const explorerAsset = AVATAR_ASSET_CATALOGUE.explorer;
    if (explorerAsset) {
      const loader = new GLTFLoader();
      loader.load(
        explorerAsset.path,
        gltf => {
        if (disposed) return;
        const cloned = SkeletonUtils.clone(gltf.scene);
        const box = new Box3().setFromObject(cloned);
        const size = box.getSize(new Vector3());
        const scale = size.y > 0.01 ? 10.5 / size.y : 5.5;
        cloned.scale.setScalar(scale);
        cloned.updateMatrixWorld();
        const scaledBox = new Box3().setFromObject(cloned);
        cloned.position.y -= scaledBox.min.y;

        avatarRoot = cloned;
        fallbackPlayer.visible = false;
        playerGroup.add(cloned);

        const mixer = new AnimationMixer(cloned);
        avatarMixer = mixer;
        for (const clip of gltf.animations) {
          avatarActions[clip.name] = mixer.clipAction(clip);
        }
        avatarActions.idle?.play();
        if (currentPlayer) syncAvatarMaterials(currentPlayer.avatarId);
        mapRef?.triggerRepaint();
      },
      undefined,
        () => {
          // Fallback sculpted figure remains visible cleanly
        }
      );
    }
  }

  rebuildVenuesAndMalls();
  rebuildLoots();
  rebuildTrail();

  return {
    id: GAME_WORLD_OBJECT_LAYER,
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      mapRef = map;
      renderer = new WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    onRemove() {
      disposed = true;
      abortAssets.abort();
      abortTrees.abort();
      avatarMixer?.stopAllAction();
      disposeThreeObject(worldRoot);
      mysteryTex.dispose();
      footprintTex.dispose();
      renderer = null;
      mapRef = null;
    },
    render(_gl, options) {
      if (!renderer || !mapRef) return;
      const now = performance.now();
      const delta = lastFrameMs ? Math.min(0.1, (now - lastFrameMs) / 1000) : 0.016;
      lastFrameMs = now;

      // Update player position, facing, zoom-compensated readability scale, halo & animation clip
      if (currentPlayer) {
        const { x, z } = projectLocalMeters(currentPlayer.longitude, currentPlayer.latitude);
        playerGroup.position.set(x, 0, z);
        const currentZoom = mapRef.getZoom();
        const zoomScale = currentZoom < 19.0 ? Math.min(4.2, Math.pow(2, (19.0 - currentZoom) * 0.54)) : 1;
        playerGroup.scale.setScalar(zoomScale);
        const rad = (currentPlayer.heading * Math.PI) / 180;
        if (avatarRoot) avatarRoot.rotation.y = Math.PI - rad;
        fallbackPlayer.rotation.y = Math.PI - rad;

        const hideAvatarMesh = Boolean(currentPlayer.hiddenInFirstPerson);
        if (avatarRoot) avatarRoot.visible = !hideAvatarMesh;
        fallbackPlayer.visible = !hideAvatarMesh && !avatarRoot;
        playerHaloGroup.visible = !hideAvatarMesh;

        const nextClip = currentPlayer.celebrating
          ? "celebrate"
          : currentPlayer.walking
          ? currentPlayer.speedMode === "jog"
            ? "jog"
            : "walk"
          : "idle";
        setAvatarAnimation(nextClip);
        avatarMixer?.update(reducedMotion ? 0 : delta);

        if (!reducedMotion) {
          const pulse = 1 + Math.sin(now * 0.004) * 0.07;
          playerHaloGroup.scale.set(pulse, 1, pulse);
        }
      }

      // Spin 3D reward crystals and mystery beacons
      if (!reducedMotion && lootSpinners.length) {
        for (let i = 0; i < lootSpinners.length; i++) {
          lootSpinners[i].rotation.y = now * 0.0014 + i * 0.7;
          lootSpinners[i].position.y = 4.6 + Math.sin(now * 0.003 + i) * 0.65;
        }
      }

      const originMerc = MercatorCoordinate.fromLngLat([ORIGIN_LNG, ORIGIN_LAT], 0);
      const meterScale = originMerc.meterInMercatorCoordinateUnits();
      const rawMatrix = (options as unknown as { defaultProjectionData?: { mainMatrix?: number[] } }).defaultProjectionData?.mainMatrix
        ?? (options as unknown as number[]);
      const proj = new Matrix4().fromArray(rawMatrix as number[]);
      const worldMatrix = new Matrix4()
        .makeTranslation(originMerc.x, originMerc.y, originMerc.z ?? 0)
        .scale(new Vector3(meterScale, -meterScale, meterScale))
        .multiply(new Matrix4().makeRotationX(Math.PI / 2));

      camera.projectionMatrix = proj.multiply(worldMatrix);
      renderer.resetState();
      renderer.render(scene, camera);

      if (!reducedMotion && (currentPlayer?.walking || lootSpinners.length > 0 || avatarMixer)) {
        mapRef.triggerRepaint();
      }
    },
    ...(Object.create(null) as Record<string, never>),
    updateScene(next: Partial<GameWorldSceneData>) {
      if (next.objects) currentObjects = next.objects;
      if (next.malls) currentMalls = next.malls;
      if (next.appearances) currentAppearances = next.appearances;
      if (next.objects || next.malls || next.appearances) {
        rebuildVenuesAndMalls();
      }
      if (next.loots) {
        currentLoots = next.loots;
        rebuildLoots();
      }
      if (next.trailCoords) {
        currentTrail = next.trailCoords;
        rebuildTrail();
      }
      if (next.player) {
        const changedAvatar = currentPlayer?.avatarId !== next.player.avatarId;
        currentPlayer = next.player;
        if (changedAvatar) syncAvatarMaterials(next.player.avatarId);
      }
      if (typeof next.reducedMotion === "boolean") {
        reducedMotion = next.reducedMotion;
      }
      mapRef?.triggerRepaint();
    },
  } as CustomLayerInterface & { updateScene(next: Partial<GameWorldSceneData>): void };
}
