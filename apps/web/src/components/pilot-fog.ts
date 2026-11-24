import { isInsideMelbournePilot, melbournePilotBoundaryFeature } from "@food-go/domain";

type Pixel = { x: number; y: number };
type GeographicPoint = { longitude: number; latitude: number };
type FogCamera = {
  project: (longitude: number, latitude: number) => Pixel;
  unproject: (x: number, y: number) => GeographicPoint;
  subscribe: (refresh: () => void) => () => void;
};

/** A CSS even-odd polygon cuts the real pilot ring out of a viewport rectangle.
 * This is a rendering effect only; never use it as authorization for claims. */
export function pilotFogClip(width: number, height: number, ring: readonly Pixel[]): string | null {
  if (!(width > 0 && height > 0) || ring.length < 4 ||
    ring.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const point = (p: Pixel) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`;
  return `polygon(evenodd, 0px 0px, ${width}px 0px, ${width}px ${height}px, 0px ${height}px, 0px 0px, ${ring.map(point).join(", ")}, ${point(ring[0])}, 0px 0px)`;
}

/** Test a projected ring using the same even-odd rule as CSS clipping. */
export function projectedPilotContains(ring: readonly Pixel[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Non-interactive veil between map imagery and UI; updates with the live camera.
 * The geographic MapLibre mask remains a fallback for unsupported CSS. */
export function attachPilotFog(host: HTMLElement, camera: FogCamera, canvas?: HTMLElement): () => void {
  const veil = document.createElement("div");
  veil.dataset.foodgoPilotFog = "true";
  veil.setAttribute("aria-hidden", "true");
  Object.assign(veil.style, { position: "absolute", inset: "0", pointerEvents: "none",
    background: "rgba(215, 229, 226, .42)", zIndex: canvas ? "0" : "480",
    display: "none" });
  veil.style.setProperty("backdrop-filter", "blur(7px) saturate(.38)");
  veil.style.setProperty("-webkit-backdrop-filter", "blur(7px) saturate(.38)");
  if (canvas) canvas.insertAdjacentElement("afterend", veil); else host.append(veil);
  const label = document.createElement("div");
  label.textContent = "COMING SOON";
  label.setAttribute("aria-hidden", "true");
  Object.assign(label.style, { position: "absolute", pointerEvents: "none", zIndex: canvas ? "1" : "490",
    color: "#365b59", background: "#edf4efed", border: "1px solid #a3bdb9", borderRadius: "20px",
    padding: "8px 12px", font: "700 11px/1.3 system-ui, sans-serif", letterSpacing: ".12em",
    transform: "translate(-50%, -50%)", whiteSpace: "nowrap", display: "none" });
  host.append(label);
  const ring = melbournePilotBoundaryFeature().geometry.coordinates[0];
  let frame = 0;
  const refresh = () => {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    const points = ring.map(([longitude, latitude]) => camera.project(longitude, latitude));
    const clip = pilotFogClip(width, height, points);
    // A very pitched camera can project distant vertices behind its horizon.
    // Do not let that screen-space approximation blur a playable street. The
    // map-native geographic mask still provides the future-area tint.
    const matchesGeography = clip && [.06,.25,.5,.75,.94].every(fx => [.06,.25,.5,.75,.94].every(fy => {
      const x = width * fx, y = height * fy;
      const location = camera.unproject(x,y);
      return projectedPilotContains(points,x,y) === isInsideMelbournePilot(location);
    }));
    const supports = matchesGeography && CSS.supports("clip-path", clip!);
    if (supports) { veil.style.clipPath = clip!; veil.style.display = "block"; }
    else veil.style.display = "none";
    // Position the lock message only on an actually unavailable region, with
    // enough space around it to avoid straddling the playable boundary.
    label.style.display = "none";
    for (const [fx, fy] of [[.5,.48],[.25,.58],[.73,.58],[.5,.73],[.5,.3]]) {
      const x = width * fx, y = height * fy;
      if (x < 85 || x > width - 85) continue;
      const samples = [[x,y],[x-75,y-18],[x+75,y-18],[x-75,y+18],[x+75,y+18]];
      if (samples.every(([sx,sy]) => !isInsideMelbournePilot(camera.unproject(sx,sy)))) {
        label.style.left = `${x}px`; label.style.top = `${y}px`; label.style.display = "block"; break;
      }
    }
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh); };
  const unsubscribe = camera.subscribe(schedule);
  schedule();
  return () => { cancelAnimationFrame(frame); unsubscribe(); veil.remove(); label.remove(); };
}
