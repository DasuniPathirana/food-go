import { mapDistance, validMapPoint, type MapPoint } from "./map-game";
import { interpolateMarker } from "./map-marker-motion";
import type { ExplorerLocationFix } from "./explorer-location-motion";

export type LocationQuality = "ready" | "inaccurate" | "stale" | "jump";
export type LocationFilter = {
  anchor: ExplorerLocationFix | null;
  display: MapPoint | null;
  latestTimestamp: number;
  quality: LocationQuality;
};
export const MAX_EXPLORER_ACCURACY = 35;
export function createLocationFilter(): LocationFilter {
  return { anchor: null, display: null, latestTimestamp: -Infinity, quality: "ready" };
}

/** Cosmetic position only. Raw fixes/accuracy stay separate; no reward uses this.
 * Hold within uncertainty, accumulate real steps against the anchor, reject
 * teleports, and let a fresh fix reacquire after a long tracking interruption.
 */
export function filterExplorerLocation(previous: LocationFilter, fix: ExplorerLocationFix, now: number): LocationFilter {
  if (!validMapPoint(fix) || !Number.isFinite(fix.accuracy) || fix.accuracy < 0
    || !Number.isFinite(fix.timestamp) || !Number.isFinite(now) || fix.timestamp <= previous.latestTimestamp) return previous;
  if (now - fix.timestamp > 15000 || fix.timestamp - now > 3000)
    return { ...previous, quality: "stale" };
  const next = { ...previous, latestTimestamp: fix.timestamp };
  if (fix.accuracy > MAX_EXPLORER_ACCURACY) return { ...next, quality: "inaccurate" };
  const anchor = previous.anchor;
  if (!anchor || fix.timestamp - anchor.timestamp > 30000)
    return { ...next, anchor: fix, display: { longitude: fix.longitude, latitude: fix.latitude }, quality: "ready" };
  const seconds = (fix.timestamp - anchor.timestamp) / 1000;
  const distance = mapDistance(anchor, fix);
  const uncertainty = Math.max(3, Math.min(12, Math.hypot(anchor.accuracy, fix.accuracy) * .45));
  if (distance > 12 * seconds + uncertainty)
    return { ...next, quality: "jump" };
  if (distance < uncertainty) return { ...next, quality: "ready" };
  return { ...next, anchor: fix, quality: "ready",
    display: previous.display ? interpolateMarker(previous.display, fix, .72) : { longitude: fix.longitude, latitude: fix.latitude } };
}
