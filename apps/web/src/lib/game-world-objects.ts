/**
 * Experimental georeferenced Food Go world objects.
 * Uses MapLibre's own depth buffer and camera; no secondary map or GPS state.
 * Visual-only: objects never authorize restaurant visits, rewards or inventory.
 */
import { MercatorCoordinate, type CustomLayerInterface } from "maplibre-gl";
import {
  AmbientLight, BoxGeometry, Camera, CircleGeometry, Color, ConeGeometry,
  CylinderGeometry, DirectionalLight, DodecahedronGeometry, Group, HemisphereLight,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, OctahedronGeometry, Scene, TorusGeometry, Vector3, WebGLRenderer,
  type BufferGeometry, type Material,
} from "three";

export const GAME_WORLD_OBJECT_LAYER = "food-go-game-world-objects";

export type GameWorldObject = {
  id: string;
  longitude: number;
  latitude: number;
  kind: "restaurant" | "cafe" | "market" | "building" | "waypoint" | "tree";
};

const hues = {
  restaurant: { main: 0xe7aa31, trim: 0x08796d },
  cafe: { main: 0x65b6c1, trim: 0x075e62 },
  market: { main: 0xef8d6b, trim: 0x0b7771 },
  building: { main: 0xbecfb7, trim: 0x0b6a60 },
  waypoint: { main: 0x7bd1d2, trim: 0x145b70 },
  tree: { main: 0x5f9576, trim: 0x285945 },
} as const;

type TreePosition = { x: number; z: number; seed: number };

/**
 * Many dimensional trees with a handful of instanced meshes, rather than
 * an individual draw call for every leaf. Three species diversify the map.
 * These are artistic additions to mapped parkland, not surveyed tree positions.
 */
function addParkForest(scene: Scene, positions: readonly TreePosition[]): void {
  if (!positions.length) return;
  const trunkMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const leafMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
  const pineMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
  const shrubMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.91 });
  const shadeMaterial = new MeshBasicMaterial({
    color: 0x295c4b, transparent: true, opacity: 0.13, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  });
  const trunks = new InstancedMesh(new CylinderGeometry(0.27, 0.42, 3.2, 8), trunkMaterial, positions.length);
  const broadleaf = new InstancedMesh(new DodecahedronGeometry(1, 0), leafMaterial, positions.length * 3);
  const conifers = new InstancedMesh(new ConeGeometry(1, 1, 8), pineMaterial, positions.length * 3);
  const bushes = new InstancedMesh(new DodecahedronGeometry(1, 0), shrubMaterial, positions.length * 2);
  const shadowGeo = new CircleGeometry(1, 14);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadows = new InstancedMesh(shadowGeo, shadeMaterial, positions.length);
  for (const mesh of [trunks, broadleaf, conifers, bushes, shadows]) {
    mesh.frustumCulled = true;
    scene.add(mesh);
  }
  const dummy = new Object3D();
  let broadleafCount = 0, coneCount = 0, bushCount = 0;
  const forestPalette = [0x49846c, 0x5b9d76, 0x7fae7e, 0x4c8c79, 0x92b783, 0x668f70];
  const pinePalette = [0x376c60, 0x417865, 0x52846b, 0x688d73];
  const shrubPalette = [0x7aa77d, 0x8da978, 0x6a9981, 0xa1b688];

  function put(mesh: InstancedMesh, index: number, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, rotation = 0, color?: number): void {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rotation, 0);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (color !== undefined) mesh.setColorAt(index, new Color(color));
  }

  positions.forEach((tree, index) => {
    const n = tree.seed;
    const tall = 0.92 + ((n >>> 3) % 9) * 0.065;
    const spread = 0.9 + ((n >>> 7) % 8) * 0.075;
    const angle = ((n % 47) / 47) * Math.PI * 2;
    const pine = n % 5 === 0;
    const bark = [0x997965, 0x8f7761, 0xa18567][n % 3];
    put(trunks, index, tree.x, 1.65 * tall, tree.z, tall, tall, tall, angle, bark);
    put(shadows, index, tree.x, 0.075, tree.z, spread * 3.1, spread * 3.1, spread * 3.1);
    if (pine) {
      for (let layer = 0; layer < 3; layer++) {
        const width = (layer === 0 ? 1.9 : layer === 1 ? 1.48 : 1.1) * spread;
        const height = (layer === 0 ? 3.55 : layer === 1 ? 3.12 : 2.5) * tall;
        put(conifers, coneCount++, tree.x, (3.05 + layer * 1.37) * tall, tree.z,
          width, height, width, angle + layer * 0.26, pinePalette[(n + layer) % pinePalette.length]);
      }
    } else {
      const crown = 2.35 * spread;
      put(broadleaf, broadleafCount++, tree.x, 4.45 * tall, tree.z,
        crown, 2.12 * tall, crown * 0.96, angle, forestPalette[n % forestPalette.length]);
      put(broadleaf, broadleafCount++, tree.x + 0.93 * spread, 5.28 * tall, tree.z - 0.54 * spread,
        crown * 0.75, 1.7 * tall, crown * 0.72, angle + 0.6, forestPalette[(n + 2) % forestPalette.length]);
      put(broadleaf, broadleafCount++, tree.x - 1.02 * spread, 5.0 * tall, tree.z + 0.47 * spread,
        crown * 0.67, 1.57 * tall, crown * 0.65, angle + 0.9, forestPalette[(n + 3) % forestPalette.length]);
    }
    if (n % 3 !== 0) for (let bush = 0; bush < 2; bush++) {
      const offset = angle + bush * 2.4;
      const distance = 2.1 + (n % 4) * 0.18;
      const radius = bush ? 0.72 : 0.94;
      put(bushes, bushCount++, tree.x + Math.cos(offset) * distance,
        radius * 0.56, tree.z + Math.sin(offset) * distance,
        radius, radius * 0.62, radius * 0.9, offset,
        shrubPalette[(n + bush) % shrubPalette.length]);
    }
  });
  broadleaf.count = broadleafCount;
  conifers.count = coneCount;
  bushes.count = bushCount;
  for (const mesh of [trunks, broadleaf, conifers, bushes, shadows]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}

function seedFromId(id: string): number {
  let n = 19;
  for (const letter of id) n = (n * 31 + letter.charCodeAt(0)) >>> 0;
  return n;
}

function makeBeacon(kind: GameWorldObject["kind"]): Group {
  const tone = hues[kind];
  const group = new Group();
  const brass = new MeshStandardMaterial({ color: tone.main, metalness: 0.3, roughness: 0.42 });
  const petrol = new MeshStandardMaterial({ color: tone.trim, metalness: 0.18, roughness: 0.65 });
  const cream = new MeshStandardMaterial({ color: 0xfff3d8, emissive: tone.main, emissiveIntensity: 0.22, roughness: 0.4 });
  const pedestal = new Mesh(new CylinderGeometry(1.8, 2.2, 0.42, 10), petrol);
  pedestal.position.y = 0.21;
  group.add(pedestal);
  const plinth = new Mesh(new CylinderGeometry(1.18, 1.42, 1.15, 8), brass);
  plinth.position.y = 0.92;
  group.add(plinth);
  const frame = new Mesh(new TorusGeometry(1.6, 0.12, 8, 32), cream);
  frame.rotation.x = Math.PI / 2;
  frame.position.y = 0.53;
  group.add(frame);
  const upperRing = new Mesh(new TorusGeometry(1.06, 0.12, 8, 32), petrol);
  upperRing.rotation.x = Math.PI / 2;
  upperRing.position.y = 2.1;
  group.add(upperRing);
  const crystal = new Mesh(new OctahedronGeometry(1.1), cream);
  crystal.position.y = 3.05;
  group.add(crystal);
  const beacon = new Mesh(new BoxGeometry(0.16, 3.4, 0.16),
    new MeshStandardMaterial({ color: tone.main, emissive: tone.main, emissiveIntensity: 0.48, transparent: true, opacity: 0.7 }));
  beacon.position.y = 5.5;
  group.add(beacon);
  return group;
}

/** Rendering is intentionally bounded and does not affect geolocation or rewards. */
export function createGameWorldObjectLayer(objects: readonly GameWorldObject[]): CustomLayerInterface {
  const valid = objects.filter(item =>
    Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180 &&
    Number.isFinite(item.latitude) && Math.abs(item.latitude) < 85).slice(0, 64);
  const scene = new Scene();
  const camera = new Camera();
  let renderer: WebGLRenderer | null = null;
  let localToMercator = new Matrix4();
  let enabled = valid.length > 0;

  if (enabled) {
    const origin = MercatorCoordinate.fromLngLat({ lng: valid[0].longitude, lat: valid[0].latitude }, 0);
    const unit = origin.meterInMercatorCoordinateUnits();
    // Three's Y-up metres -> MapLibre's Z-up Mercator map frame.
    localToMercator = new Matrix4().makeTranslation(origin.x, origin.y, origin.z)
      .multiply(new Matrix4().makeScale(unit, -unit, unit))
      .multiply(new Matrix4().makeRotationX(Math.PI / 2));
    const grove: TreePosition[] = [];
    for (const point of valid) {
      const position = MercatorCoordinate.fromLngLat({ lng: point.longitude, lat: point.latitude }, 0);
      const dx = (position.x - origin.x) / unit;
      const dz = (position.y - origin.y) / unit;
      // Avoid huge world-coordinate offsets if a venue directory spans regions.
      if (Math.hypot(dx, dz) > 3000) continue;
      if (point.kind === "tree") { grove.push({ x: dx, z: dz, seed: seedFromId(point.id) }); continue; }
      const beacon = makeBeacon(point.kind);
      beacon.position.set(dx, 0, dz);
      beacon.name = point.id;
      scene.add(beacon);
    }
    addParkForest(scene, grove);
    scene.add(new AmbientLight(0xffffff, 0.78));
    scene.add(new HemisphereLight(0xf3f6e4, 0x507768, 1.55));
    const sun = new DirectionalLight(0xffe9c1, 1.8);
    sun.position.copy(new Vector3(12, 24, 18));
    scene.add(sun);
  }

  return {
    id: GAME_WORLD_OBJECT_LAYER,
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      if (!enabled) return;
      renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: false });
      renderer.autoClear = false;
    },
    render(_gl, args) {
      if (!enabled || !renderer) return;
      camera.projectionMatrix.copy(new Matrix4().fromArray(args.defaultProjectionData.mainMatrix).multiply(localToMercator));
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      // Never forceContextLoss(): the WebGL context belongs to MapLibre.
      scene.traverse(node => {
        const mesh = node as Mesh<BufferGeometry, Material | Material[]>;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      });
      renderer?.dispose();
      renderer = null;
      enabled = false;
      scene.clear();
    },
  };
}
