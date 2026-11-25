import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { AVATARS, type AvatarId } from "@food-go/domain/avatar";
import { avatarDistanceAt, avatarLegPose, avatarMapYaw, AVATAR_STRIDE_METRES, retargetAvatarDistance, shortestAvatarTurn, type AvatarDistanceTransition } from "@/lib/avatar-motion";
import { AVATAR_ASSET_CATALOGUE, avatarAnimationForMotion } from "@/lib/avatar-assets";
import type { LoadedAvatarModel } from "./avatar-model-loader";

export type AvatarAction = "idle" | "wave" | "cheer" | "look";
export type AvatarMotion = { animate: boolean; walking: boolean; action: AvatarAction; actionToken: number; reduced?: boolean;
  heading?: number; mapBearing?: number; distanceMetres?: number; distanceTransitionMs?: number };

/** Original expedition outfits, built locally from a shared, articulated rig. */
function character(avatarId: AvatarId) {
  const avatar = AVATARS.find((item) => item.id === avatarId) || AVATARS[0];
  const p = avatar.palette;
  const anime = avatar.style === "anime";
  const root = new THREE.Group();
  const sphere = new THREE.SphereGeometry(1, 18, 14);
  const rounded = new RoundedBoxGeometry(1, 1, 1, 2, .16);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const cone = new THREE.ConeGeometry(1, 1, 6);
  const capsules = new Map<string, THREE.CapsuleGeometry>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (colour: string) => {
    if (!materials.has(colour)) materials.set(colour, new THREE.MeshStandardMaterial({ color: colour, roughness: .82, metalness: 0 }));
    return materials.get(colour)!;
  };
  function mesh(parent: THREE.Group, geometry: THREE.BufferGeometry, colour: string, size: [number, number, number], at: [number, number, number]) {
    const item = new THREE.Mesh(geometry, material(colour));
    item.scale.set(...size); item.position.set(...at); parent.add(item); return item;
  }
  function ball(parent: THREE.Group, colour: string, size: [number, number, number], at: [number, number, number]) {
    return mesh(parent, sphere, colour, size, at);
  }
  function box(parent: THREE.Group, colour: string, size: [number, number, number], at: [number, number, number]) {
    return mesh(parent, rounded, colour, size, at);
  }
  function capsule(parent: THREE.Group, colour: string, radius: number, length: number, at: [number, number, number]) {
    const key = `${radius}:${length}`;
    if (!capsules.has(key)) capsules.set(key, new THREE.CapsuleGeometry(radius, length, 4, 10));
    return mesh(parent, capsules.get(key)!, colour, [1, 1, 1], at);
  }
  function lock(colour: string, from: [number, number, number], tip: [number, number, number], width: number, depth: number) {
    const direction = new THREE.Vector3(...tip).sub(new THREE.Vector3(...from));
    const item = mesh(head, cone, colour, [width, direction.length(), depth], new THREE.Vector3(...from).addScaledVector(direction, .5).toArray() as [number, number, number]);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return item;
  }
  const body = new THREE.Group(); root.add(body);
  const torso = new THREE.Group(); torso.position.y = 1.1; body.add(torso);
  const jacket = new THREE.LatheGeometry([
    new THREE.Vector2(0, -.30), new THREE.Vector2(.17, -.30), new THREE.Vector2(.205, -.24),
    new THREE.Vector2(.225, .13), new THREE.Vector2(.21, .24), new THREE.Vector2(.105, .29), new THREE.Vector2(0, .29),
  ], 18);
  mesh(torso, jacket, p.shirt, [1, 1, .64], [0, 0, 0]);
  ball(body, p.trousers, [.19, .105, .125], [0, .79, 0]);
  capsule(body, p.skin, .066, .09, [0, 1.435, 0]);
  // A cream undershirt, open collar, stitched pockets and front zip read at map scale.
  box(torso, "#fff6e5", [.105, .32, .018], [0, .075, .144]);
  box(torso, "#fff6e5", [.015, .45, .016], [0, -.04, .15]);
  for (const side of [-1, 1]) {
    const collar = box(torso, p.shirt, [.092, .13, .035], [side * .076, .205, .134]);
    collar.rotation.z = side * -.42;
    box(torso, p.accent, [.078, .016, .02], [side * .117, -.10, .143]);
  }
  box(torso, "#f3eee0", [.042, .045, .014], [-.128, .11, .148]);
  box(torso, p.accent, [.022, .025, .018], [-.128, .11, .157]);
  box(torso, p.trousers, [.35, .035, .235], [0, -.28, 0]);
  box(torso, p.accent, [.047, .035, .024], [0, -.28, .126]);

  const backpack = new THREE.Group(); backpack.position.set(0, 1.11, -.18); body.add(backpack);
  box(backpack, p.accent, [.34, .43, .16], [0, -.015, -.035]);
  box(backpack, p.shirt, [.25, .15, .055], [0, -.115, -.125]);
  box(backpack, "#fff2d5", [.21, .022, .018], [0, -.045, -.158]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.052, .012, 5, 12, Math.PI), material(p.trousers));
  handle.position.set(0, .21, -.02); backpack.add(handle);
  for (const side of [-1, 1]) {
    const strap = box(torso, p.trousers, [.032, .43, .025], [side * .16, .035, .132]); strap.rotation.z = side * .11;
    box(torso, "#fff2d5", [.038, .039, .014], [side * .166, -.05, .151]);
    box(backpack, p.trousers, [.025, .24, .028], [side * .13, -.02, -.125]);
  }
  mesh(backpack, cylinder, "#d5eee9", [.034, .16, .034], [.20, -.075, -.015]);
  mesh(backpack, cylinder, p.trousers, [.025, .025, .025], [.20, .017, -.015]);

  const knees: THREE.Group[] = [], feet: THREE.Group[] = [];
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group(); leg.position.set(side * .115, .79, 0); body.add(leg);
    capsule(leg, p.trousers, .078, .19, [0, -.175, 0]);
    box(leg, p.shirt, [.06, .11, .024], [side * .067, -.18, .016]);
    const knee = new THREE.Group(); knee.position.y = -.35; leg.add(knee); knees.push(knee);
    ball(knee, p.trousers, [.068, .073, .068], [0, 0, 0]);
    capsule(knee, p.trousers, .066, .21, [0, -.175, 0]);
    box(knee, p.accent, [.095, .025, .092], [0, -.275, .007]);
    const foot = new THREE.Group(); foot.position.y = -.35; knee.add(foot); feet.push(foot);
    box(foot, p.shoes, [.155, .12, .27], [0, .014, .05]);
    box(foot, "#23394a", [.161, .035, .285], [0, -.065, .053]);
    box(foot, "#f7edda", [.16, .02, .278], [0, -.041, .053]);
    box(foot, p.accent, [.07, .045, .13], [0, .077, .057]);
    for (const z of [.07, .105]) box(foot, "#fff7e9", [.085, .013, .014], [0, .097, z]);
    return leg;
  });
  const elbows: THREE.Group[] = [], hands: THREE.Group[] = [];
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group(); arm.position.set(side * .255, 1.355, 0); body.add(arm);
    capsule(arm, p.shirt, .081, .11, [0, -.115, 0]);
    box(arm, p.accent, [.13, .036, .137], [0, -.205, 0]);
    const elbow = new THREE.Group(); elbow.position.y = -.25; arm.add(elbow); elbows.push(elbow);
    const sleeve = avatarId === "foodie" ? p.skin : p.shirt;
    ball(elbow, sleeve, [.061, .066, .061], [0, 0, 0]);
    capsule(elbow, sleeve, .059, .12, [0, -.105, 0]);
    box(elbow, p.trousers, [.114, .038, .112], [0, -.19, 0]);
    if (side < 0) box(elbow, p.accent, [.06, .045, .021], [0, -.189, .061]);
    const hand = new THREE.Group(); hand.position.set(0, -.235, 0); elbow.add(hand); hands.push(hand);
    ball(hand, p.skin, [.058, .072, .038], [0, -.024, .005]);
    ball(hand, p.skin, [.025, .041, .029], [-side * .047, -.014, .023]);
    return arm;
  });
  const headHeight = 1.695;
  const head = new THREE.Group(); head.position.set(0, headHeight, .005); root.add(head);
  ball(head, p.hair, [.231, .274, .208], [0, .025, -.026]);
  ball(head, p.skin, [.211, .252, .197], [0, -.005, .018]);
  for (const side of [-1, 1]) {
    ball(head, p.skin, [.037, .059, .039], [side * .214, -.015, .012]);
    ball(head, "#c48770", [.016, .031, .012], [side * .23, -.015, .04]);
  }
  // Both eyes are independent rigs so blinking does not alter the face geometry.
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Group(); eye.position.set(side * .081, .016, .199); head.add(eye);
    ball(eye, "#fffdf8", [anime ? .049 : .040, anime ? .063 : .047, .018], [0, 0, 0]);
    ball(eye, anime ? (avatarId === "anime-sky" ? "#286088" : "#58438a") : "#35585a", [anime ? .027 : .024, anime ? .045 : .032, .011], [.002, -.003, .016]);
    ball(eye, "#182b3a", [.012, anime ? .030 : .025, .007], [.003, -.004, .024]);
    ball(eye, "#ffffff", [.009, .012, .006], [-.006, .013, .030]);
    const brow = capsule(head, p.hair, .009, anime ? .065 : .055, [side * .081, .099, .184]);
    brow.rotation.z = Math.PI / 2 + side * -.10;
    return eye;
  });
  ball(head, p.skin, [.023, .031, .032], [0, -.055, .214]);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.041, .0065, 5, 16, Math.PI), material("#74473b"));
  smile.rotation.z = Math.PI; smile.position.set(0, -.119, .187); head.add(smile);
  for (const side of [-1, 1]) ball(head, "#df9987", [.033, .013, .007], [side * .137, -.073, .17]);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .52), material(p.hair));
  cap.scale.set(.232, .282, .215); cap.position.set(0, .018, -.024); head.add(cap);
  if (avatarId === "trailblazer") {
    const hat = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(p.accent));
    hat.scale.set(.253, .18, .232); hat.position.set(0, .184, -.012); head.add(hat);
    ball(head, p.accent, [.226, .023, .167], [.018, .183, .188]);
    box(head, "#f7ebcc", [.074, .063, .018], [0, .27, .201]);
    box(head, p.shirt, [.036, .036, .012], [0, .27, .215]);
    box(head, p.trousers, [.11, .022, .023], [0, .186, -.232]);
  } else if (avatarId === "foodie") {
    for (let i = 0; i < 7; i++) {
      const curl = ball(head, p.hair, [.085, .085, .077], [(i % 4 - 1.5) * .091, .24 + Math.floor(i / 4) * .045, i < 4 ? .13 : -.035]);
      curl.rotation.z = (i - 3) * .21;
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(.252, .018, 6, 24, Math.PI), material(p.accent));
    band.position.set(0, .027, -.024); head.add(band);
    for (const side of [-1, 1]) {
      ball(head, p.trousers, [.037, .07, .058], [side * .241, -.006, .014]);
      box(head, p.accent, [.031, .108, .086], [side * .264, -.006, .014]);
      box(head, "#fff2d5", [.012, .04, .035], [side * .283, -.006, .014]);
    }
  } else {
    // Original anime silhouettes, with swept locks and a layered, asymmetrical bob.
    for (let i = 0; i < 6; i++) {
      lock(p.hair, [(i - 2.5) * .064, .225, .135], [(i - 2.5) * .059 - .015, .076 + Math.abs(i - 2) * .012, .205], .061, .041);
    }
    if (avatarId === "anime-sky") {
      for (let i = 0; i < 5; i++) {
        lock(p.hair, [(i - 2) * .064, .205, -.005], [(i - 2) * .106 + .045, .37 - Math.abs(i - 2) * .035, -.065], .091, .075);
      }
    } else {
      for (const side of [-1, 1]) {
        const strand = capsule(head, p.hair, .065, .20, [side * .201, -.032, -.045]);
        strand.rotation.z = side * .12;
        lock(p.hair, [side * .198, -.055, .038], [side * .20, -.225, .065], .058, .038);
      }
      for (const side of [-1, 1]) {
        const bow = box(head, p.accent, [.082, .05, .032], [.178 + side * .032, .202, .144]); bow.rotation.z = side * .28;
      }
      ball(head, p.accent, [.024, .025, .025], [.178, .202, .16]);
    }
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(.085, .025, 6, 18), material(p.accent));
    scarf.rotation.x = Math.PI / 2; scarf.position.set(0, 1.445, 0); body.add(scarf);
    const scarfTail = box(torso, p.accent, [.075, .19, .022], [.075, .23, .17]); scarfTail.rotation.z = -.23;
  }
  return { root, body, torso, head, headHeight, arms, elbows, hands, legs, knees, feet, eyes, backpack };
}

export function createAvatarScene(canvas: HTMLCanvasElement, avatarId: AvatarId, onFailure: () => void, onAssetChange: (loaded: boolean) => void = () => {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  const scene = new THREE.Scene();
  const halfHeight = 1.22;
  const camera = new THREE.OrthographicCamera(-1.05, 1.05, halfHeight, -halfHeight, .1, 20);
  camera.position.set(2.9, 2.3, 6); camera.lookAt(0, 1.06, 0);
  scene.add(new THREE.HemisphereLight(0xfff9ed, 0x667b8e, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2.7); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2c4, 1); rim.position.set(3, 2, -2); scene.add(rim);
  const rig = character(avatarId); scene.add(rig.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.36, 24), new THREE.MeshBasicMaterial({ color: 0x20344d, transparent: true, opacity: .13, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.y = .65; shadow.position.y = .01; scene.add(shadow);
  let motion: AvatarMotion = { animate: false, walking: false, action: "idle", actionToken: 0 };
  let disposed = false, failed = false, frame = 0, time = 0, previous = 0, gestureTime = -100;
  let facing = -.13, targetFacing = -.13, facingKnown = false, walkBlend = 0, walkDistance = 0;
  let distanceTransition: AvatarDistanceTransition | null = null;
  let model: LoadedAvatarModel | null = null;
  const assetRequest = new AbortController(), asset = AVATAR_ASSET_CATALOGUE[avatarId];
  if (asset) void import("./avatar-model-loader").then(({ loadAvatarModel }) => loadAvatarModel(asset, { signal: assetRequest.signal })).then(loaded => {
    if (disposed || failed) { loaded.dispose(); return; }
    model = loaded; rig.root.visible = false; scene.add(loaded.root);
    loaded.setState(avatarAnimationForMotion(motion), { immediate: !motion.animate || motion.reduced });
    onAssetChange(true); draw();
  }).catch(() => { if (!disposed) onAssetChange(false); });
  function pose() {
    if (model) { model.root.rotation.y = facing; return; }
    const moving = motion.animate && !motion.reduced;
    const phase = time - gestureTime;
    const gesture = motion.action !== "idle" && phase >= 0 && phase < 2.4;
    const smooth = (value: number) => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    const envelope = gesture ? smooth(phase / .4) * smooth((2.4 - phase) / .5) : 0;
    const stride = walkDistance / AVATAR_STRIDE_METRES * Math.PI * 2;
    const walking = moving ? walkBlend : 0;
    const bodyBob = walking * (Math.cos(stride * 2) * .015);
    // Lower the hips into the walk so a bent supporting leg keeps its sole on
    // the same ground plane as the straight-legged idle pose.
    rig.root.position.y = bodyBob - .05 * walking + (moving ? Math.sin(time * 2.2) * .007 * (1 - walking) : 0);
    rig.root.rotation.y = facing + (moving ? Math.sin(time * .65) * .025 * (1 - walking) : 0);
    rig.body.rotation.set(.035 * walking, Math.sin(stride) * .035 * walking, Math.cos(stride) * .018 * walking);
    rig.torso.scale.y = 1 + (moving ? Math.sin(time * 2.2) * .009 * (1 - walking) : 0);
    rig.backpack.rotation.set(-.035 * walking, -Math.sin(stride) * .025 * walking, Math.cos(stride - .3) * .018 * walking);
    rig.head.position.y = rig.headHeight + (moving ? Math.sin(time * 2.2) * .005 * (1 - walking) : 0);
    rig.head.rotation.set(-.025 * walking, moving ? Math.sin(time * .43) * .09 * (1 - walking) : 0, -Math.cos(stride) * .012 * walking);
    rig.legs.forEach((leg, i) => {
      const step = avatarLegPose(walkDistance, i as 0 | 1, bodyBob);
      leg.rotation.x = step.hip * walking;
      rig.knees[i].rotation.x = step.knee * walking;
      rig.feet[i].rotation.x = step.foot * walking;
    });
    rig.arms.forEach((arm, i) => {
      const swing = Math.sin(stride) * (i ? 1 : -1);
      arm.rotation.set(swing * .38 * walking, 0, i ? .075 : -.075);
      rig.elbows[i].rotation.set(-.16 - Math.max(0, -swing) * .28 * walking, 0, 0);
      rig.hands[i].rotation.set(0, 0, 0);
    });
    const blink = moving ? time % 5.2 : 0;
    const eyeScale = blink > 4.98 ? 1 - .94 * Math.sin((blink - 4.98) / .22 * Math.PI) : 1;
    rig.eyes.forEach((eye) => { eye.scale.y = eyeScale; });
    if (gesture && moving) {
      if (motion.action === "wave") {
        rig.arms[1].rotation.x *= 1 - envelope;
        rig.arms[1].rotation.z += 1.8 * envelope;
        rig.elbows[1].rotation.set(-.08, 0, (.7 + Math.sin(phase * 12) * .18) * envelope);
        rig.hands[1].rotation.z = Math.sin(phase * 12 - .25) * .20 * envelope;
        rig.head.rotation.z = -.055 * envelope;
      }
      if (motion.action === "cheer") {
        rig.arms[0].rotation.z = -2.4 * envelope; rig.arms[1].rotation.z = 2.4 * envelope;
        rig.elbows.forEach((elbow) => elbow.rotation.x = -.25 * envelope);
        const hop = Math.max(0, Math.sin((phase - .4) * Math.PI * 2)) * .065 * envelope;
        rig.root.position.y += hop;
        rig.head.rotation.x = -.08 * envelope;
      }
      if (motion.action === "look") {
        rig.head.rotation.y = Math.sin(phase / 2.4 * Math.PI * 2) * .58 * envelope;
        rig.body.rotation.y += rig.head.rotation.y * .18;
      }
    } else if (motion.reduced && gesture) {
      // A static acknowledgement replaces spatial movement under reduced motion.
      if (motion.action === "wave") { rig.arms[1].rotation.z = 1.8; rig.elbows[1].rotation.z = .7; }
      if (motion.action === "cheer") { rig.arms[0].rotation.z = -2.1; rig.arms[1].rotation.z = 2.1; }
      if (motion.action === "look") rig.head.rotation.y = .25;
    }
  }
  function draw() {
    if (disposed || failed) return;
    try { pose(); renderer.render(scene, camera); } catch { failed = true; cancelAnimationFrame(frame); onFailure(); }
  }
  function tick(timestamp: number) {
    frame = 0;
    if (disposed || failed || !motion.animate || motion.reduced) return;
    const elapsed = previous ? Math.min((timestamp - previous) / 1000, .05) : 0; previous = timestamp;
    time += elapsed;
    facing += shortestAvatarTurn(facing, targetFacing) * (1 - Math.exp(-elapsed * 12));
    const before = walkDistance;
    if (Number.isFinite(motion.distanceMetres) && distanceTransition) walkDistance = avatarDistanceAt(distanceTransition, timestamp);
    else if (motion.walking) walkDistance += elapsed * 1.4;
    // GPS status can remain "walking" between fixes. Only visible travel drives
    // the gait, so settled distance returns naturally to the standing pose.
    const stepping = walkDistance - before > 0.00001;
    walkBlend += ((stepping ? 1 : 0) - walkBlend) * (1 - Math.exp(-elapsed * 14));
    if (model) {
      if (motion.action === "idle") {
        const speed = elapsed > 0 ? Math.max(0, (walkDistance - before) / elapsed) : 0;
        const state = walkBlend > .1 ? speed > 2.2 ? "jog" : "walk" : "idle";
        model.setState(state);
        if (state === "walk" || state === "jog") {
          const action = model.actions[state], cycle = state === "walk" ? model.manifest.metrics.walkCycleMetres : model.manifest.metrics.jogCycleMetres;
          action.setEffectiveTimeScale(Math.min(4, speed * action.getClip().duration / cycle));
        }
      }
      model.update(elapsed);
    }
    draw();
    if (!disposed && !failed && motion.animate && !motion.reduced) frame = requestAnimationFrame(tick);
  }
  const contextLost = (event: Event) => { event.preventDefault(); failed = true; cancelAnimationFrame(frame); onFailure(); };
  canvas.addEventListener("webglcontextlost", contextLost);
  return {
    resize(width: number, height: number) {
      if (disposed || width < 1 || height < 1) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height, false);
      const halfWidth = halfHeight * width / height;
      camera.left = -halfWidth; camera.right = halfWidth; camera.updateProjectionMatrix(); draw();
    },
    setMotion(next: AvatarMotion) {
      const newAction = next.actionToken !== motion.actionToken || next.action !== motion.action;
      if (newAction) gestureTime = time;
      if (model && (newAction || !next.animate || next.reduced)) model.setState(avatarAnimationForMotion(next), { restart: newAction, immediate: !next.animate || next.reduced });
      targetFacing = avatarMapYaw(next.heading, next.mapBearing);
      if (!facingKnown || !next.animate || next.reduced) { facing = targetFacing; facingKnown = true; }
      if (Number.isFinite(next.distanceMetres)) {
        const reset = !Number.isFinite(motion.distanceMetres) || !next.animate || next.reduced
          || next.distanceTransitionMs !== motion.distanceTransitionMs;
        distanceTransition = retargetAvatarDistance(reset ? null : distanceTransition, next.distanceMetres!, performance.now(), next.distanceTransitionMs ?? 80);
        if (reset || !distanceTransition.durationMs) walkDistance = distanceTransition.target;
      } else distanceTransition = null;
      motion = next;
      if (!motion.animate || motion.reduced) {
        cancelAnimationFrame(frame); frame = 0; previous = 0; walkBlend = 0; draw();
      } else if (!frame && !disposed && !failed) {
        previous = 0; draw(); frame = requestAnimationFrame(tick);
      }
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); canvas.removeEventListener("webglcontextlost", contextLost);
      assetRequest.abort(); model?.dispose(); model = null;
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach((item) => materials.add(item)); }
      });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose());
      renderer.dispose(); scene.clear();
    },
  };
}
