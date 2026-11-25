export type CompassSample = { alpha?: number | null; beta?: number | null; gamma?: number | null; absolute?: boolean; webkitCompassHeading?: number; webkitCompassAccuracy?: number };
export type CompassStatus = "inactive" | "requesting" | "active" | "denied" | "unsupported" | "unavailable" | "paused";
export type CompassState = { status: CompassStatus; heading: number | null; message: string };
const normal = (heading: number) => ((heading % 360) + 360) % 360;

/** W3C back-of-device heading, Z-X'-Y'' orientation. Relative alpha cannot
 * establish north. Flat/invalid samples are ignored rather than invented.
 */
export function deviceCompassHeading(sample: CompassSample): number | null {
  if (typeof sample.webkitCompassHeading === "number" && Number.isFinite(sample.webkitCompassHeading)
    && (sample.webkitCompassAccuracy === undefined || (Number.isFinite(sample.webkitCompassAccuracy) && sample.webkitCompassAccuracy >= 0 && sample.webkitCompassAccuracy <= 30)))
    return normal(sample.webkitCompassHeading);
  if (sample.absolute !== true || ![sample.alpha, sample.beta, sample.gamma].every(value => typeof value === "number" && Number.isFinite(value))) return null;
  const alpha = sample.alpha! * Math.PI / 180, beta = sample.beta! * Math.PI / 180, gamma = sample.gamma! * Math.PI / 180;
  const x = -Math.cos(alpha) * Math.sin(gamma) - Math.sin(alpha) * Math.sin(beta) * Math.cos(gamma);
  const y = -Math.sin(alpha) * Math.sin(gamma) + Math.cos(alpha) * Math.sin(beta) * Math.cos(gamma);
  return Math.hypot(x, y) < .1 ? null : normal(Math.atan2(x, y) * 180 / Math.PI);
}

/** Permission and subscription lifetime; no camera, GPS, storage or reward API. */
export function createDeviceCompass(options: {
  available: boolean; secure: boolean; requestPermission?: () => Promise<string>;
  subscribe: (receive: (sample: CompassSample) => void) => () => void;
  onChange: (state: CompassState) => void; timeoutMs?: number;
}) {
  let revision = 0, unsubscribe: (() => void) | null = null, timer: ReturnType<typeof setTimeout> | null = null, disposed = false;
  let previous: number | null = null, published = 0;
  function clear() { revision++; unsubscribe?.(); unsubscribe = null; if (timer) clearTimeout(timer); timer = null; previous = null; }
  function emit(status: CompassStatus, message: string, heading: number | null = null) { if (!disposed) options.onChange({ status, message, heading }); }
  function stop(status: "inactive" | "paused" = "inactive") {
    clear(); emit(status, status === "paused" ? "Device compass paused while Explore was hidden." : "");
  }
  async function start() {
    clear(); if (disposed) return;
    if (!options.available || !options.secure) { emit("unsupported", "Device compass is unavailable here. Drag the map to look around."); return; }
    const attempt = revision;
    emit("requesting", "Waiting for device compass permission…");
    try {
      // Invoked synchronously from the user's click before the first await.
      const permission = options.requestPermission ? await options.requestPermission() : "granted";
      if (disposed || attempt !== revision) return;
      if (permission !== "granted") { emit("denied", "Device compass permission was declined. Touch look is still available."); return; }
      const expire = () => {
        clear(); emit("unavailable", "No reliable compass signal. Hold your device upright or use touch look.");
      };
      const arm = () => { if (timer) clearTimeout(timer); timer = setTimeout(expire, options.timeoutMs ?? 5000); };
      unsubscribe = options.subscribe(sample => {
        if (disposed || attempt !== revision) return;
        const heading = deviceCompassHeading(sample);
        if (heading === null) return;
        arm();
        const now = Date.now(), change = previous === null ? Infinity : Math.abs(((heading - previous + 540) % 360) - 180);
        if (change < 1 || (previous !== null && now - published < 100)) return;
        previous = heading; published = now; emit("active", "Device compass on. Drag to return to touch look.", heading);
      });
      arm();
    } catch { if (!disposed && attempt === revision) { clear(); emit("denied", "Device compass could not be enabled. Touch look is still available."); } }
  }
  return { start, stop, dispose() { clear(); disposed = true; } };
}
