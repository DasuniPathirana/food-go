import * as THREE from "three";
import { AVATARS, type AvatarId } from "@food-go/domain/avatar";

export type AvatarAction = "idle" | "wave" | "cheer" | "look";
export type AvatarMotion = { animate: boolean; walking: boolean; action: AvatarAction; actionToken: number; reduced?: boolean };

/** Original, low-poly character rig. No model, texture or external network fetch. */
function character(avatarId: AvatarId) {
  const avatar = AVATARS.find((item) => item.id === avatarId) || AVATARS[0];
  const p = avatar.palette;
  const anime = avatar.style === "anime";
  const root = new THREE.Group();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (colour: string) => {
    if (!materials.has(colour)) materials.set(colour, new THREE.MeshStandardMaterial({ color: colour, roughness: .73, metalness: 0 }));
    return materials.get(colour)!;
  };
  function ball(parent: THREE.Group, colour: string, size: [number, number, number], at: [number, number, number]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material(colour));
    mesh.scale.set(...size); mesh.position.set(...at); parent.add(mesh); return mesh;
  }
  function capsule(parent: THREE.Group, colour: string, radius: number, length: number, at: [number, number, number]) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material(colour));
    mesh.position.set(...at); parent.add(mesh); return mesh;
  }
  const body = new THREE.Group(); root.add(body);
  ball(body, p.shirt, [.29, .39, .205], [0, 1.08, 0]);
  ball(body, p.trousers, [.235, .17, .18], [0, .77, 0]);
  capsule(body, p.skin, .1, .13, [0, 1.49, 0]);
  // Raised pocket, shoulder straps and a small enamel pin make the outfit legible.
  ball(body, p.accent, [.135, .065, .025], [0, 1.09, .202]);
  ball(body, "#fff6df", [.036, .036, .018], [-.13, 1.3, .186]);
  ball(body, p.accent, [.245, .3, .13], [0, 1.09, -.19]);
  for (const x of [-.19, .19]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(.035, .43, .026), material(p.accent));
    strap.position.set(x, 1.18, .17); strap.rotation.z = x * -.27; body.add(strap);
  }
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group(); leg.position.set(side * .14, .79, 0); body.add(leg);
    capsule(leg, p.trousers, .105, .36, [0, -.27, 0]);
    ball(leg, p.shoes, [.132, .09, .205], [0, -.65, .065]);
    ball(leg, "#28394b", [.135, .025, .205], [0, -.708, .065]);
    return leg;
  });
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group(); arm.position.set(side * .30, 1.38, 0); body.add(arm);
    capsule(arm, p.shirt, .112, .13, [0, -.145, 0]);
    capsule(arm, p.skin, .083, .15, [0, -.37, .005]);
    ball(arm, p.skin, [.087, .102, .09], [0, -.51, .01]);
    return arm;
  });
  const head = new THREE.Group(); head.position.set(0, 1.85, 0); root.add(head);
  ball(head, p.hair, [.38, .405, .32], [0, .05, -.06]);
  ball(head, p.skin, [.35, .38, .30], [0, 0, .01]);
  for (const side of [-1, 1]) ball(head, p.skin, [.07, .10, .075], [side * .34, -.015, .01]);
  // Both eyes are independent rigs so blinking does not alter the face geometry.
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Group(); eye.position.set(side * .125, .015, .282); head.add(eye);
    ball(eye, "#fffdf8", [anime ? .079 : .065, anime ? .105 : .079, .034], [0, 0, 0]);
    ball(eye, anime ? (avatarId === "anime-sky" ? "#25537e" : "#58438a") : "#273c4d", [.037, anime ? .067 : .051, .025], [.004, -.005, .027]);
    ball(eye, "#ffffff", [.013, .019, .012], [-.008, .025, .047]);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(.01, .075, 2, 6), material(p.hair));
    brow.rotation.z = Math.PI / 2 + side * -.08; brow.position.set(0, .139, -.015); eye.add(brow);
    return eye;
  });
  ball(head, p.skin, [.045, .047, .047], [0, -.09, .296]);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.063, .010, 5, 18, Math.PI), material("#74473b"));
  smile.rotation.z = Math.PI; smile.position.set(0, -.155, .285); head.add(smile);
  for (const side of [-1, 1]) ball(head, "#e58f7e", [.05, .024, .012], [side * .21, -.105, .255]);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * .52), material(p.hair));
  cap.scale.set(.375, .405, .32); cap.position.set(0, .035, -.045); head.add(cap);
  if (avatarId === "trailblazer") {
    const hat = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(p.accent));
    hat.scale.set(.395, .28, .35); hat.position.set(0, .245, -.015); head.add(hat);
    ball(head, p.accent, [.30, .035, .21], [.035, .24, .29]);
    ball(head, p.shirt, [.05, .06, .015], [0, .345, .29]);
  } else if (avatarId === "foodie") {
    for (let i = 0; i < 5; i++) ball(head, p.hair, [.13, .15, .15], [(i - 2) * .135, .31 + (i % 2) * .04, .03]);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.385, .027, 6, 24, Math.PI), material(p.accent));
    band.position.set(0, .04, -.035); head.add(band);
    for (const side of [-1, 1]) ball(head, p.accent, [.075, .12, .10], [side * .37, .01, .01]);
  } else {
    // Original anime silhouettes: Sky's swept spikes and Violet's rounded bob.
    for (let i = 0; i < 6; i++) {
      const lock = new THREE.Mesh(new THREE.ConeGeometry(.082, .235, 5), material(p.hair));
      lock.position.set((i - 2.5) * .10, .23 + Math.abs(i - 2.5) * .012, .235);
      lock.rotation.z = Math.PI + (i - 2.5) * .13; head.add(lock);
    }
    if (avatarId === "anime-sky") {
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(.115, .29, 5), material(p.hair));
        spike.position.set((i - 2) * .135, .365 + (i % 2) * .045, -.02);
        spike.rotation.z = (i - 2) * -.23; head.add(spike);
      }
    } else {
      for (const side of [-1, 1]) capsule(head, p.hair, .105, .32, [side * .315, -.055, -.035]);
      for (const side of [-1, 1]) ball(head, p.accent, [.095, .055, .04], [.29 + side * .055, .30, .16]);
      ball(head, p.accent, [.035, .04, .045], [.29, .30, .18]);
    }
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(.113, .03, 6, 18), material(p.accent));
    scarf.rotation.x = Math.PI / 2; scarf.position.set(0, 1.49, 0); body.add(scarf);
  }
  return { root, body, head, arms, legs, eyes };
}

export function createAvatarScene(canvas: HTMLCanvasElement, avatarId: AvatarId, onFailure: () => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.15, 1.15, 1.4, -1.4, .1, 20);
  camera.position.set(2.9, 2.5, 6); camera.lookAt(0, 1.21, 0);
  scene.add(new THREE.HemisphereLight(0xfff9ed, 0x67798c, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.1); key.position.set(-3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd7b5, 1.2); rim.position.set(3, 2, -2); scene.add(rim);
  const rig = character(avatarId); scene.add(rig.root);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(.36, 24), new THREE.MeshBasicMaterial({ color: 0x20344d, transparent: true, opacity: .13, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.y = .65; shadow.position.y = .01; scene.add(shadow);
  let motion: AvatarMotion = { animate: false, walking: false, action: "idle", actionToken: 0 };
  let disposed = false, failed = false, frame = 0, time = 0, previous = 0, gestureTime = -100;
  function pose() {
    const moving = motion.animate && !motion.reduced;
    const phase = time - gestureTime;
    const gesture = motion.action !== "idle" && phase >= 0 && phase < 2.4;
    const envelope = gesture ? Math.sin(Math.PI * phase / 2.4) : 0;
    rig.root.position.y = moving ? Math.sin(time * 2.2) * .009 : 0;
    rig.root.rotation.y = -.13 + (moving ? Math.sin(time * .65) * .035 : 0);
    rig.body.scale.y = 1 + (moving ? Math.sin(time * 2.2) * .012 : 0);
    rig.head.position.y = 1.85 + (moving ? Math.sin(time * 2.2) * .007 : 0);
    rig.head.rotation.set(0, moving ? Math.sin(time * .43) * .12 : 0, 0);
    const walk = moving && motion.walking ? Math.sin(time * 8) * .35 : 0;
    rig.legs.forEach((leg, i) => { leg.rotation.x = walk * (i ? 1 : -1); });
    rig.arms.forEach((arm, i) => { arm.rotation.set(-walk * (i ? 1 : -1) * .7, 0, i ? .08 : -.08); });
    const blink = moving ? time % 5.2 : 0;
    const eyeScale = blink > 4.98 ? 1 - .94 * Math.sin((blink - 4.98) / .22 * Math.PI) : 1;
    rig.eyes.forEach((eye) => { eye.scale.y = eyeScale; });
    if (gesture && moving) {
      if (motion.action === "wave") rig.arms[1].rotation.z = (2.48 + Math.sin(phase * 16) * .19) * envelope;
      if (motion.action === "cheer") {
        rig.arms[0].rotation.z = -2.55 * envelope; rig.arms[1].rotation.z = 2.55 * envelope;
        rig.root.position.y += Math.max(0, Math.sin(phase * Math.PI * 2)) * .11 * envelope;
      }
      if (motion.action === "look") rig.head.rotation.y = Math.sin(phase / 2.4 * Math.PI * 2) * .58 * envelope;
    } else if (motion.reduced && gesture) {
      // A static acknowledgement replaces spatial movement under reduced motion.
      if (motion.action === "wave") rig.arms[1].rotation.z = 2.1;
      if (motion.action === "cheer") { rig.arms[0].rotation.z = -2.1; rig.arms[1].rotation.z = 2.1; }
      if (motion.action === "look") rig.head.rotation.y = .25;
    }
  }
  function draw() {
    if (disposed || failed) return;
    try { pose(); renderer.render(scene, camera); } catch { failed = true; cancelAnimationFrame(frame); onFailure(); }
  }
  function tick(timestamp: number) {
    if (disposed || failed || !motion.animate || motion.reduced) return;
    time += previous ? Math.min((timestamp - previous) / 1000, .05) : 0; previous = timestamp;
    draw(); frame = requestAnimationFrame(tick);
  }
  const contextLost = (event: Event) => { event.preventDefault(); failed = true; cancelAnimationFrame(frame); onFailure(); };
  canvas.addEventListener("webglcontextlost", contextLost);
  return {
    resize(width: number, height: number) {
      if (disposed || width < 1 || height < 1) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(width, height, false);
      const halfWidth = 1.4 * width / height;
      camera.left = -halfWidth; camera.right = halfWidth; camera.updateProjectionMatrix(); draw();
    },
    setMotion(next: AvatarMotion) {
      if (next.actionToken !== motion.actionToken || next.action !== motion.action) gestureTime = time;
      motion = next; cancelAnimationFrame(frame); previous = 0; draw();
      if (motion.animate && !motion.reduced && !disposed && !failed) frame = requestAnimationFrame(tick);
    },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); canvas.removeEventListener("webglcontextlost", contextLost);
      const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach((item) => materials.add(item)); }
      });
      geometries.forEach((item) => item.dispose()); materials.forEach((item) => item.dispose());
      renderer.dispose(); scene.clear();
    },
  };
}
