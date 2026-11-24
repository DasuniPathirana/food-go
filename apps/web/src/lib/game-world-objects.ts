/**
 * Experimental georeferenced Food Go world objects.
 * Uses MapLibre's own depth buffer and camera; no secondary map or GPS state.
 * Visual-only: objects never authorize restaurant visits, rewards or inventory.
 */
import { MercatorCoordinate, type CustomLayerInterface } from "maplibre-gl";
import { addFacadeDressing } from "./game-world-facade-render";
import type { FacadeObject } from "./game-world-facades";
import { attachWorldModels, disposeWorldResources, type WorldModelTarget } from "./world-model-assets";
import {
  AmbientLight, BoxGeometry, Camera, CanvasTexture, CircleGeometry, Color, ConeGeometry,
  CylinderGeometry, DirectionalLight, DodecahedronGeometry, Group, HemisphereLight,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, OctahedronGeometry, Scene, SphereGeometry, TorusGeometry, Vector3, WebGLRenderer,
  type BufferGeometry, type Material,
} from "three";

export const GAME_WORLD_OBJECT_LAYER = "food-go-game-world-objects";

export type GameWorldObject = {
  id: string;
  longitude: number;
  latitude: number;
  kind: "restaurant" | "cafe" | "market" | "building" | "waypoint" | "tree" | "roof" | "treasure" | "facade" | "lamp" | "mystery";
  /** Decorative building footprint dimensions/roof altitude, in metres. */
  width?: number;
  depth?: number;
  height?: number;
  variant?: number;
  base?: number;
  ring?: readonly (readonly number[])[];
  name?: string;
};

const hues = {
  restaurant: { main: 0xe7aa31, trim: 0x08796d },
  cafe: { main: 0x65b6c1, trim: 0x075e62 },
  market: { main: 0xef8d6b, trim: 0x0b7771 },
  building: { main: 0xbecfb7, trim: 0x0b6a60 },
  waypoint: { main: 0x7bd1d2, trim: 0x145b70 },
  tree: { main: 0x5f9576, trim: 0x285945 },
  roof: { main: 0x7a9e9c, trim: 0x305b5c },
  treasure: { main: 0xffd15f, trim: 0x076f71 },
  facade: { main: 0xd9cdb8, trim: 0x40736d },
  lamp: { main: 0xf8dc98, trim: 0x174949 },
  mystery: { main: 0xffd54f, trim: 0x9c7200 },
} as const;

type TreePosition = { x: number; z: number; seed: number };

/**
 * Many dimensional trees with a handful of instanced meshes, rather than
 * an individual draw call for every leaf. Three species diversify the map.
 * These are artistic additions to mapped parkland, not surveyed tree positions.
 */
function addParkForest(scene: Scene | Group, positions: readonly TreePosition[]): void {
  if (!positions.length) return;
  const trunkMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const leafMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
  const pineMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 });
  const shrubMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.91 });
  // A 64px one-time procedural alpha mask gives soft canopy shade rather
  // than the conspicuous flat circles from the original park prototype.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext("2d");
  if (ctx) {
    const glow = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
    glow.addColorStop(0, "rgba(28,68,50,0.38)");
    glow.addColorStop(.45, "rgba(30,70,51,0.23)");
    glow.addColorStop(1, "rgba(30,70,51,0)");
    ctx.fillStyle = glow; ctx.fillRect(0,0,64,64);
  }
  const shadowTexture = new CanvasTexture(shadowCanvas);
  const shadeMaterial = new MeshBasicMaterial({
    map: shadowTexture, transparent: true, opacity: .68, depthWrite: false,
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

type WorldPosition = { x: number; z: number; seed: number };

/** Three instanced draw calls provide depth and warm urban night ambience. */
function addStreetLights(scene: Scene, positions: readonly WorldPosition[]): void {
  if (!positions.length)return;
  const metal=new MeshStandardMaterial({color:0x315a59,metalness:.52,roughness:.39});
  const glow=new MeshStandardMaterial({
    color:0xffe8ab,emissive:0xffd27e,emissiveIntensity:1.25,
    metalness:0,roughness:.32,
  });
  const posts=new InstancedMesh(new CylinderGeometry(.075,.12,4.1,7),metal,positions.length);
  const heads=new InstancedMesh(new SphereGeometry(.42,9,7),glow,positions.length);
  const caps=new InstancedMesh(new ConeGeometry(.58,.4,8),metal,positions.length);
  const dummy=new Object3D();
  for(let i=0;i<positions.length;i++){
    const p=positions[i];const varied=0.91+((p.seed>>4)%8)*.025;
    dummy.position.set(p.x,2.05*varied,p.z);dummy.rotation.set(0,0,0);
    dummy.scale.set(varied,varied,varied);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);
    dummy.position.set(p.x,4.31*varied,p.z);dummy.scale.setScalar(varied);
    dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);
    dummy.position.set(p.x,4.67*varied,p.z);dummy.updateMatrix();caps.setMatrixAt(i,dummy.matrix);
  }
  for(const mesh of [posts,heads,caps]){
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
}

function seedFromId(id: string): number {
  let n = 19;
  for (const letter of id) n = (n * 31 + letter.charCodeAt(0)) >>> 0;
  return n;
}

function createStripedAwningTexture(colorA: string, colorB: string, stripeCount = 8): CanvasTexture {
  if (typeof document === "undefined") {
    return new CanvasTexture({} as HTMLCanvasElement);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const w = 128 / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
      ctx.fillRect(i * w, 0, w, 128);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createPinIconTexture(type: "restaurant" | "bakery" | "cafe"): CanvasTexture {
  if (typeof document === "undefined") {
    return new CanvasTexture({} as HTMLCanvasElement);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, "#ffe57f");
    grad.addColorStop(0.7, "#f59e0b");
    grad.addColorStop(1, "#b45309");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (type === "bakery") {
      ctx.beginPath();
      ctx.arc(64, 64, 28, 0.35 * Math.PI, 1.65 * Math.PI, false);
      ctx.arc(64, 64, 16, 1.65 * Math.PI, 0.35 * Math.PI, true);
      ctx.closePath();
      ctx.fill();
    } else if (type === "cafe") {
      ctx.beginPath();
      ctx.roundRect(42, 46, 40, 32, [0, 0, 10, 10]);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(82, 58, 10, -Math.PI / 2, Math.PI / 2, false);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(48, 36); ctx.lineTo(48, 52);
      ctx.moveTo(42, 36); ctx.lineTo(42, 48); ctx.lineTo(54, 48); ctx.lineTo(54, 36);
      ctx.moveTo(48, 52); ctx.lineTo(48, 92);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(76, 36);
      ctx.quadraticCurveTo(86, 48, 76, 62);
      ctx.lineTo(76, 92);
      ctx.stroke();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeGlowingPin(type: "restaurant" | "bakery" | "cafe"): Group {
  const pin = new Group();
  const goldMetal = new MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.6 });
  const haloMat = new MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.45, depthWrite: false });
  const beamMat = new MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.2, depthWrite: false });

  const ring = new Mesh(new TorusGeometry(1.4, 0.14, 12, 32), goldMetal);
  pin.add(ring);

  const halo = new Mesh(new TorusGeometry(1.58, 0.28, 8, 32), haloMat);
  pin.add(halo);

  const iconTex = createPinIconTexture(type);
  const faceMat = new MeshBasicMaterial({ map: iconTex, transparent: true });
  const discGeo = new CylinderGeometry(1.3, 1.3, 0.16, 28);
  discGeo.rotateX(Math.PI / 2);
  const disc = new Mesh(discGeo, faceMat);
  pin.add(disc);

  const beam = new Mesh(new ConeGeometry(1.6, 5.2, 16, 1, true), beamMat);
  beam.rotation.x = Math.PI;
  beam.position.y = -2.6;
  pin.add(beam);

  return pin;
}

function makeOvenhouseBuilding(): Group {
  const root = new Group();
  const stucco = new MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.75, metalness: 0.05 });
  const stoneBase = new MeshStandardMaterial({ color: 0x8a7b6c, roughness: 0.88, metalness: 0.1 });
  const terracottaRoof = new MeshStandardMaterial({ color: 0xc2503a, roughness: 0.82, metalness: 0.05 });
  const brickChimney = new MeshStandardMaterial({ color: 0x9c3c2b, roughness: 0.85 });
  const woodTrim = new MeshStandardMaterial({ color: 0x4a3525, roughness: 0.7 });
  const creamTrim = new MeshStandardMaterial({ color: 0xfaf8f2, roughness: 0.6 });
  const windowGlow = new MeshStandardMaterial({ color: 0xffe89f, emissive: 0xffc44d, emissiveIntensity: 1.1, roughness: 0.2 });
  const umbrellaCanvas = new MeshStandardMaterial({ color: 0xf8f3e6, roughness: 0.9 });
  const umbrellaPole = new MeshStandardMaterial({ color: 0x634731, roughness: 0.6 });

  const plinth = new Mesh(new BoxGeometry(9.4, 0.35, 8.4), stoneBase);
  plinth.position.y = 0.17;
  root.add(plinth);

  const body = new Mesh(new BoxGeometry(7.6, 4.4, 6.4), stucco);
  body.position.set(-0.3, 2.4, -0.4);
  root.add(body);

  const frontWindow = new Mesh(new BoxGeometry(3.6, 2.2, 0.2), windowGlow);
  frontWindow.position.set(-0.3, 2.4, 2.85);
  root.add(frontWindow);

  const cornerWindow = new Mesh(new BoxGeometry(0.2, 2.2, 2.8), windowGlow);
  cornerWindow.position.set(3.55, 2.4, -0.4);
  root.add(cornerWindow);

  const windowFrame = new Mesh(new BoxGeometry(3.8, 2.4, 0.1), woodTrim);
  windowFrame.position.set(-0.3, 2.4, 2.8);
  root.add(windowFrame);

  const roofBase = new Mesh(new BoxGeometry(8.2, 0.4, 7.0), creamTrim);
  roofBase.position.set(-0.3, 4.7, -0.4);
  root.add(roofBase);

  const roofHip = new Mesh(new ConeGeometry(5.4, 2.4, 4), terracottaRoof);
  roofHip.position.set(-0.3, 6.0, -0.4);
  roofHip.rotation.y = Math.PI / 4;
  root.add(roofHip);

  const chimney = new Mesh(new BoxGeometry(0.9, 2.2, 0.9), brickChimney);
  chimney.position.set(-2.4, 6.4, -1.8);
  root.add(chimney);
  const chimneyPot = new Mesh(new CylinderGeometry(0.35, 0.4, 0.4, 8), creamTrim);
  chimneyPot.position.set(-2.4, 7.6, -1.8);
  root.add(chimneyPot);

  const greenStripeTex = createStripedAwningTexture("#1e7e5a", "#fcf8f0", 8);
  const awningMat = new MeshStandardMaterial({ map: greenStripeTex, roughness: 0.7 });
  const awning = new Mesh(new BoxGeometry(4.4, 0.12, 1.8), awningMat);
  awning.position.set(-0.3, 3.8, 3.6);
  awning.rotation.x = 0.28;
  root.add(awning);

  const patioGround = new Mesh(new BoxGeometry(4.8, 0.08, 3.6), stoneBase);
  patioGround.position.set(2.0, 0.38, 3.2);
  root.add(patioGround);

  const pole = new Mesh(new CylinderGeometry(0.06, 0.06, 2.8, 8), umbrellaPole);
  pole.position.set(2.8, 1.7, 3.2);
  root.add(pole);
  const canopy = new Mesh(new ConeGeometry(1.6, 0.65, 8), umbrellaCanvas);
  canopy.position.set(2.8, 3.1, 3.2);
  root.add(canopy);

  const table = new Mesh(new CylinderGeometry(0.55, 0.55, 0.8, 12), woodTrim);
  table.position.set(1.5, 0.78, 3.2);
  root.add(table);
  for (let c = 0; c < 3; c++) {
    const chair = new Mesh(new BoxGeometry(0.4, 0.5, 0.4), woodTrim);
    const angle = (c * 2 * Math.PI) / 3;
    chair.position.set(1.5 + Math.cos(angle) * 0.9, 0.65, 3.2 + Math.sin(angle) * 0.9);
    root.add(chair);
  }

  const pin = makeGlowingPin("restaurant");
  pin.position.set(-0.3, 11.2, -0.4);
  root.add(pin);

  return root;
}

function makeRiversideBakeryBuilding(): Group {
  const root = new Group();
  const brick = new MeshStandardMaterial({ color: 0x9b3e2b, roughness: 0.82 });
  const stone = new MeshStandardMaterial({ color: 0xdfd8c5, roughness: 0.78 });
  const darkWood = new MeshStandardMaterial({ color: 0x3d2719, roughness: 0.65 });
  const windowGlow = new MeshStandardMaterial({ color: 0xffe89f, emissive: 0xffb84d, emissiveIntensity: 1.1, roughness: 0.2 });
  const leafMat = new MeshStandardMaterial({ color: 0x3e7e55, roughness: 0.8 });
  const potMat = new MeshStandardMaterial({ color: 0xb35c3b, roughness: 0.85 });

  const plinth = new Mesh(new BoxGeometry(8.6, 0.35, 7.6), stone);
  plinth.position.y = 0.17;
  root.add(plinth);

  const body = new Mesh(new BoxGeometry(7.4, 4.6, 6.2), brick);
  body.position.set(0, 2.5, 0);
  root.add(body);

  for (const x of [-3.7, 3.7]) {
    const quoin = new Mesh(new BoxGeometry(0.3, 4.6, 0.3), stone);
    quoin.position.set(x, 2.5, 3.1);
    root.add(quoin);
  }

  const bakeryWindow = new Mesh(new BoxGeometry(4.2, 2.2, 0.2), windowGlow);
  bakeryWindow.position.set(0, 2.3, 3.15);
  root.add(bakeryWindow);

  const signBoard = new Mesh(new BoxGeometry(5.2, 0.65, 0.2), darkWood);
  signBoard.position.set(0, 3.9, 3.2);
  root.add(signBoard);

  const redStripeTex = createStripedAwningTexture("#c83228", "#fcf8f0", 8);
  const awningMat = new MeshStandardMaterial({ map: redStripeTex, roughness: 0.7 });
  const awning = new Mesh(new BoxGeometry(4.8, 0.12, 1.8), awningMat);
  awning.position.set(0, 3.4, 3.8);
  awning.rotation.x = 0.28;
  root.add(awning);

  const cornice = new Mesh(new BoxGeometry(7.8, 0.5, 6.6), stone);
  cornice.position.set(0, 4.9, 0);
  root.add(cornice);

  for (const x of [-2.8, 2.8]) {
    const pot = new Mesh(new CylinderGeometry(0.35, 0.28, 0.6, 10), potMat);
    pot.position.set(x, 0.65, 3.5);
    root.add(pot);
    const topiary = new Mesh(new SphereGeometry(0.55, 8, 8), leafMat);
    topiary.position.set(x, 1.3, 3.5);
    root.add(topiary);
  }

  const table = new Mesh(new CylinderGeometry(0.5, 0.5, 0.75, 12), darkWood);
  table.position.set(-1.6, 0.72, 4.2);
  root.add(table);
  for (let c = 0; c < 2; c++) {
    const chair = new Mesh(new BoxGeometry(0.35, 0.45, 0.35), darkWood);
    chair.position.set(-1.6 + (c === 0 ? -0.7 : 0.7), 0.6, 4.2);
    root.add(chair);
  }

  const pin = makeGlowingPin("bakery");
  pin.position.set(0, 10.8, 0);
  root.add(pin);

  return root;
}

function makeLanewayCafeBuilding(): Group {
  const root = new Group();
  const stone = new MeshStandardMaterial({ color: 0x475156, roughness: 0.85 });
  const timber = new MeshStandardMaterial({ color: 0x5a3f2a, roughness: 0.7 });
  const windowGlow = new MeshStandardMaterial({ color: 0xffe89f, emissive: 0xffb84d, emissiveIntensity: 1.1, roughness: 0.2 });

  const body = new Mesh(new BoxGeometry(6.4, 4.0, 5.6), stone);
  body.position.set(0, 2.0, 0);
  root.add(body);

  const counter = new Mesh(new BoxGeometry(3.6, 1.2, 0.8), timber);
  counter.position.set(0, 0.6, 2.8);
  root.add(counter);

  const cafeWindow = new Mesh(new BoxGeometry(3.6, 1.8, 0.2), windowGlow);
  cafeWindow.position.set(0, 2.2, 2.85);
  root.add(cafeWindow);

  const blackStripeTex = createStripedAwningTexture("#22282a", "#f5ecd8", 6);
  const awningMat = new MeshStandardMaterial({ map: blackStripeTex, roughness: 0.7 });
  const awning = new Mesh(new BoxGeometry(4.2, 0.12, 1.6), awningMat);
  awning.position.set(0, 3.2, 3.4);
  awning.rotation.x = 0.28;
  root.add(awning);

  const pin = makeGlowingPin("cafe");
  pin.position.set(0, 9.8, 0);
  root.add(pin);

  return root;
}

function makeModernBistroBuilding(): Group {
  const root = new Group();
  const glassMat = new MeshStandardMaterial({ color: 0x2d4f54, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.85 });
  const frameMat = new MeshStandardMaterial({ color: 0x262422, roughness: 0.5, metalness: 0.7 });
  const woodMat = new MeshStandardMaterial({ color: 0x8a6240, roughness: 0.7 });
  const windowGlow = new MeshStandardMaterial({ color: 0xffe89f, emissive: 0xffb84d, emissiveIntensity: 0.9, roughness: 0.2 });

  const base = new Mesh(new BoxGeometry(7.2, 4.2, 6.0), glassMat);
  base.position.set(0, 2.1, 0);
  root.add(base);

  const interior = new Mesh(new BoxGeometry(6.4, 3.6, 5.2), windowGlow);
  interior.position.set(0, 2.1, 0);
  root.add(interior);

  for (const x of [-3.6, 3.6]) {
    const pillar = new Mesh(new BoxGeometry(0.4, 4.4, 0.4), frameMat);
    pillar.position.set(x, 2.2, 3.0);
    root.add(pillar);
  }

  const pergola = new Mesh(new BoxGeometry(6.8, 0.18, 5.6), woodMat);
  pergola.position.set(0, 4.4, 0);
  root.add(pergola);

  const pin = makeGlowingPin("restaurant");
  pin.position.set(0, 10.2, 0);
  root.add(pin);

  return root;
}

function makeBeacon(kind: GameWorldObject["kind"], object?: GameWorldObject): Group {
  const name = (object?.name ?? "").toLowerCase();
  if (kind === "restaurant" || kind === "cafe" || kind === "market" || kind === "building") {
    if (name.includes("oven") || name.includes("house") || object?.variant === 0) {
      return makeOvenhouseBuilding();
    }
    if (name.includes("bakery") || name.includes("riverside") || name.includes("bread") || object?.variant === 1) {
      return makeRiversideBakeryBuilding();
    }
    if (name.includes("cafe") || name.includes("coffee") || name.includes("espresso") || kind === "cafe" || object?.variant === 2) {
      return makeLanewayCafeBuilding();
    }
    return makeModernBistroBuilding();
  }

  const tone = hues[kind] ?? hues.building;
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

/**
 * Small roof modules help break the monotonous extruded skyline. They sit on
 * mapped roofs, never invent extra building footprints or usable entrances.
 */
function makeRoof(point: GameWorldObject): Group {
  const root = new Group();
  const sizeX = Math.max(1.5, Math.min(7, point.width ?? 4));
  const sizeZ = Math.max(1.5, Math.min(7, point.depth ?? 4));
  const top = Math.max(4, Math.min(200, point.height ?? 12));
  const seed = seedFromId(point.id);
  const dark = new MeshStandardMaterial({ color: 0x375c60, roughness: 0.77, metalness: 0.2 });
  const light = new MeshStandardMaterial({ color: 0xb8c7b6, roughness: 0.86, metalness: 0.09 });
  const solar = new MeshStandardMaterial({ color: 0x3a6875, roughness: 0.25, metalness: 0.38 });
  const terracotta = new MeshStandardMaterial({ color: 0xbc846c, roughness: 0.87 });
  const foliage = new MeshStandardMaterial({ color: 0x658e68, roughness: 0.88 });
  const lip = new Mesh(new BoxGeometry(sizeX, 0.18, sizeZ), dark);
  lip.position.y = top + 0.15;
  root.add(lip);
  if (seed % 4 === 0) {
    // Bounded pavilion canopy and a slender dark support.
    const body = new Mesh(new CylinderGeometry(1.02, 1.25, 1.25, 8), light);
    body.position.y = top + 0.85; root.add(body);
    const canopy = new Mesh(new ConeGeometry(1.7, 0.8, 8), terracotta);
    canopy.position.y = top + 1.95; root.add(canopy);
  } else if (seed % 4 === 1) {
    // Two compact solar arrays (decorative, not a claimed real solar installation).
    for (const offset of [-1, 1]) {
      const panel = new Mesh(new BoxGeometry(Math.min(2, sizeX * .43), 0.12, Math.min(2.2, sizeZ * .65)), solar);
      panel.position.set(offset * sizeX * .22, top + .57, 0);
      panel.rotation.x = -.22; root.add(panel);
    }
  } else if (seed % 4 === 2) {
    // Skylight, with reflective glazing and a lighter surround.
    const frame = new Mesh(new BoxGeometry(sizeX * .52, .42, sizeZ * .53), light);
    frame.position.y = top + .41; root.add(frame);
    const glass = new Mesh(new BoxGeometry(sizeX * .44, .06, sizeZ * .45), solar);
    glass.position.y = top + .67; root.add(glass);
  } else {
    // An artistic roof garden cluster with raised containers.
    for (let i = 0; i < 3; i++) {
      const planter = new Mesh(new BoxGeometry(.9, .4, 1.1), terracotta);
      planter.position.set((i-1) * Math.min(1.45, sizeX * .24), top + .45, 0);
      root.add(planter);
      const shrub = new Mesh(new DodecahedronGeometry(.58, 0), foliage);
      shrub.position.set(planter.position.x, top + 1.08, 0); root.add(shrub);
    }
  }
  return root;
}

function makeTreasure(): Group {
  // A glowing faceted golden crystal on mossy stones with ground ring and floating sparkles
  const root = new Group();
  const stoneMat = new MeshStandardMaterial({ color: 0x6e736e, roughness: 0.9 });
  const mossMat = new MeshStandardMaterial({ color: 0x4e8544, roughness: 0.85 });
  const goldCrystal = new MeshStandardMaterial({
    color: 0xffd54f,
    emissive: 0xff9800,
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.6,
  });
  const haloMat = new MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.6, depthWrite: false });
  const sparkleMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });

  // 1. Mossy stone base
  const mound = new Mesh(new CylinderGeometry(2.4, 2.8, 0.3, 16), mossMat);
  mound.position.y = 0.15;
  root.add(mound);

  // Clusters of small rocks around the base
  for (let i = 0; i < 7; i++) {
    const angle = (i * 2 * Math.PI) / 7;
    const stone = new Mesh(new DodecahedronGeometry(0.45 + (i % 3) * 0.1, 0), stoneMat);
    stone.position.set(Math.cos(angle) * 1.8, 0.35, Math.sin(angle) * 1.8);
    root.add(stone);
  }

  // 2. Glowing Golden Ground Ring
  const groundRing = new Mesh(new TorusGeometry(2.6, 0.12, 8, 32), haloMat);
  groundRing.rotation.x = Math.PI / 2;
  groundRing.position.y = 0.32;
  root.add(groundRing);

  // 3. Central Faceted Golden Crystal
  const crystalGeo = new OctahedronGeometry(1.6, 0);
  crystalGeo.scale(0.85, 2.2, 0.85);
  const mainCrystal = new Mesh(crystalGeo, goldCrystal);
  mainCrystal.position.y = 2.4;
  root.add(mainCrystal);

  // Flanking smaller crystals
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + 0.3;
    const subGeo = new OctahedronGeometry(0.9, 0);
    subGeo.scale(0.65, 1.4, 0.65);
    const subCrystal = new Mesh(subGeo, goldCrystal);
    subCrystal.position.set(Math.cos(angle) * 0.9, 1.2, Math.sin(angle) * 0.9);
    subCrystal.rotation.z = Math.cos(angle) * 0.25;
    subCrystal.rotation.x = Math.sin(angle) * 0.25;
    root.add(subCrystal);
  }

  // 4. Floating Sparkle Particles
  for (let i = 0; i < 6; i++) {
    const sparkle = new Mesh(new OctahedronGeometry(0.18 + (i % 2) * 0.08, 0), sparkleMat);
    const angle = i * 1.1;
    sparkle.position.set(Math.cos(angle) * 1.4, 2.0 + (i % 4) * 0.6, Math.sin(angle) * 1.4);
    root.add(sparkle);
  }

  return root;
}

function makeMysteryZone(): Group {
  const root = new Group();
  const ringMat = new MeshBasicMaterial({ color: 0xffe57f, transparent: true, opacity: 0.85, depthWrite: false });
  const fillMat = new MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.25, depthWrite: false });
  const markMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });

  // 1. Glowing soft circular ground fill
  const groundFill = new Mesh(new CircleGeometry(3.2, 28), fillMat);
  groundFill.rotation.x = -Math.PI / 2;
  groundFill.position.y = 0.08;
  root.add(groundFill);

  // 2. Dashed Glowing Ring (arc segments)
  const segments = 12;
  for (let i = 0; i < segments; i++) {
    const arc = new Mesh(new TorusGeometry(3.2, 0.12, 6, 8, Math.PI / (segments * 1.3)), ringMat);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = (i * 2 * Math.PI) / segments;
    arc.position.y = 0.12;
    root.add(arc);
  }

  // 3. Hovering 3D Glowing Question Mark "?"
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "bold 88px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffeb3b";
      ctx.shadowBlur = 18;
      ctx.fillText("?", 64, 64);
    }
    const qTex = new CanvasTexture(canvas);
    qTex.needsUpdate = true;
    const qMat = new MeshBasicMaterial({ map: qTex, transparent: true, side: 2 });
    const qDisc = new Mesh(new CircleGeometry(1.6, 20), qMat);
    qDisc.position.y = 2.4;
    root.add(qDisc);
  }

  // Floating sparkle particles
  for (let i = 0; i < 5; i++) {
    const angle = i * 1.3;
    const sparkle = new Mesh(new OctahedronGeometry(0.18, 0), markMat);
    sparkle.position.set(Math.cos(angle) * 1.8, 1.8 + (i % 3) * 0.5, Math.sin(angle) * 1.8);
    root.add(sparkle);
  }

  return root;
}

/** Rendering is intentionally bounded and does not affect geolocation or rewards. */
export function createGameWorldObjectLayer(objects: readonly GameWorldObject[]): CustomLayerInterface {
  const valid = objects.filter(item =>
    Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180 &&
    Number.isFinite(item.latitude) && Math.abs(item.latitude) < 85).slice(0, 220);
  const scene = new Scene();
  const camera = new Camera();
  let renderer: WebGLRenderer | null = null;
  let localToMercator = new Matrix4();
  let enabled = valid.length > 0;
  let mapInstance: any = null;
  const modelTargets: WorldModelTarget[] = [];
  let assetCount = 0;

  if (enabled) {
    const origin = MercatorCoordinate.fromLngLat({ lng: valid[0].longitude, lat: valid[0].latitude }, 0);
    const unit = origin.meterInMercatorCoordinateUnits();
    // Three's Y-up metres -> MapLibre's Z-up Mercator map frame.
    localToMercator = new Matrix4().makeTranslation(origin.x, origin.y, origin.z)
      .multiply(new Matrix4().makeScale(unit, -unit, unit))
      .multiply(new Matrix4().makeRotationX(Math.PI / 2));
    const grove: TreePosition[] = [];
    const importedGrove: TreePosition[] = [];
    const groveFallback = new Group();
    const lamps: WorldPosition[] = [];
    for (const point of valid) {
      const position = MercatorCoordinate.fromLngLat({ lng: point.longitude, lat: point.latitude }, 0);
      const dx = (position.x - origin.x) / unit;
      const dz = (position.y - origin.y) / unit;
      // Avoid huge world-coordinate offsets if a venue directory spans regions.
      if (Math.hypot(dx, dz) > 3000) continue;
      if (point.kind === "tree") {
        const tree = { x: dx, z: dz, seed: seedFromId(point.id) };
        if (importedGrove.length < 10) {
          importedGrove.push(tree);
          modelTargets.push({ id: point.id, fallback: groveFallback, x: dx, z: dz, asset: "parkTree", width: 7, height: 6, rotation: tree.seed % 47 / 47 * Math.PI * 2 });
        } else grove.push(tree);
        continue;
      }
      if (point.kind === "facade") continue;
      if (point.kind === "lamp") { lamps.push({ x:dx, z:dz, seed:seedFromId(point.id) }); continue; }
      const beacon = point.kind === "roof" ? makeRoof(point)
        : point.kind === "treasure" ? makeTreasure()
        : point.kind === "mystery" ? makeMysteryZone()
        : makeBeacon(point.kind, point);
      beacon.position.set(dx, 0, dz);
      beacon.name = point.id;
      scene.add(beacon);
      if (point.kind === "restaurant" || point.kind === "cafe" || point.kind === "market") {
        modelTargets.push({ id: point.id, fallback: beacon, x: dx, z: dz, width: 22, height: 16 });
      }
    }
    addParkForest(scene, grove);
    if (importedGrove.length) { addParkForest(groveFallback, importedGrove); scene.add(groveFallback); }
    addStreetLights(scene,lamps);
    // Batched architectural windows change the whole city silhouette at close
    // zoom without replacing road geography or the underlying map footprint.
    const facades=valid.filter((p):p is FacadeObject => p.kind === "facade" && Array.isArray(p.ring));
    addFacadeDressing(scene, facades, origin, unit);
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
      mapInstance = map;
      renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: false });
      renderer.autoClear = false;
      map.getCanvas().dataset.worldModelCount = "0";
      void attachWorldModels(scene, modelTargets, () => enabled, count => {
        if (!enabled) return;
        assetCount = count;
        map.getCanvas().dataset.worldModelCount = String(assetCount);
        map.triggerRepaint();
      });
    },
    render(_gl, args: any) {
      if (!enabled || !renderer) return;
      const matrix = args?.modelViewProjectionMatrix
        ?? args?.defaultProjectionData?.mainMatrix
        ?? (Array.isArray(args) ? args : null);
      if (!matrix) return;
      camera.projectionMatrix.copy(new Matrix4().fromArray(matrix).multiply(localToMercator));
      renderer.resetState();
      renderer.render(scene, camera);
      mapInstance?.triggerRepaint();
    },
    onRemove() {
      // Never forceContextLoss(): the WebGL context belongs to MapLibre.
      enabled = false;
      if (mapInstance) delete mapInstance.getCanvas().dataset.worldModelCount;
      disposeWorldResources(scene);
      renderer?.dispose();
      renderer = null;
      enabled = false;
      scene.clear();
    },
  };
}
