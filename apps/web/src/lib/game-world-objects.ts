/**
 * Experimental georeferenced Food Go world objects.
 * Uses MapLibre's own depth buffer and camera; no secondary map or GPS state.
 * Visual-only: objects never authorize restaurant visits, rewards or inventory.
 */
import { MercatorCoordinate, type CustomLayerInterface } from "maplibre-gl";
import {
  AmbientLight, BoxGeometry, Camera, CylinderGeometry, DirectionalLight, DodecahedronGeometry,
  Group, Matrix4, Mesh, MeshStandardMaterial, OctahedronGeometry,
  Scene, TorusGeometry, Vector3, WebGLRenderer,
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

function makeTree(seed: number): Group {
  const group = new Group();
  const wood = new MeshStandardMaterial({ color: 0x755a43, roughness: 0.9 });
  const evergreen = new MeshStandardMaterial({ color: seed % 2 ? 0x4b9271 : 0x5a9c73, roughness: 0.88 });
  const highlights = new MeshStandardMaterial({ color: seed % 3 ? 0x76ab7b : 0x80ae8a, roughness: 0.84 });
  const trunk = new Mesh(new CylinderGeometry(0.27, 0.38, 2.9, 7), wood);
  trunk.position.y = 1.45;
  group.add(trunk);
  const crown = new Mesh(new DodecahedronGeometry(1.95, 0), evergreen);
  crown.position.set(0, 3.25, 0);
  group.add(crown);
  const upper = new Mesh(new DodecahedronGeometry(1.58, 0), highlights);
  upper.position.set(0.28, 4.25, -0.24);
  group.add(upper);
  const crownEdge = new Mesh(new DodecahedronGeometry(1.18, 0), evergreen);
  crownEdge.position.set(-0.62, 3.82, 0.55);
  group.add(crownEdge);
  const scale = 0.78 + (seed % 5) * 0.07;
  group.scale.setScalar(scale);
  return group;
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
    for (const point of valid) {
      const position = MercatorCoordinate.fromLngLat({ lng: point.longitude, lat: point.latitude }, 0);
      const dx = (position.x - origin.x) / unit;
      const dz = (position.y - origin.y) / unit;
      // Avoid huge world-coordinate offsets if a venue directory spans regions.
      if (Math.hypot(dx, dz) > 3000) continue;
      const beacon = point.kind === "tree" ? makeTree(seedFromId(point.id)) : makeBeacon(point.kind);
      beacon.position.set(dx, 0, dz);
      beacon.name = point.id;
      scene.add(beacon);
    }
    scene.add(new AmbientLight(0xffffff, 2));
    const sun = new DirectionalLight(0xffedd2, 2.2);
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
