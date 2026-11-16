import { mapBearing, mapDistance, validMapPoint, type MapPoint } from "./map-game";

export type ExplorerLocationFix = MapPoint & {
  accuracy: number;
  timestamp: number;
  heading?: number | null;
  speed?: number | null;
};
export type ExplorerLocationMotion = {
  latest: ExplorerLocationFix | null;
  anchor: ExplorerLocationFix | null;
  heading: number | null;
  distanceMetres: number;
  walkingUntil: number;
};
export const EXPLORER_WALK_IDLE_MS = 4000;
const maximumAccuracy = 35;
const maximumWalkingSpeed = 3.8;

export function createExplorerLocationMotion(): ExplorerLocationMotion {
  return { latest: null, anchor: null, heading: null, distanceMetres: 0, walkingUntil: 0 };
}

/** Approximate cosmetic movement only. Raw fixes remain available to the map.
 * Holding an anchor lets small genuine steps accumulate without adding every
 * stationary GPS wobble to the session distance. No rewards use this estimate.
 */
export function advanceExplorerLocationMotion(previous: ExplorerLocationMotion, fix: ExplorerLocationFix, receivedAt: number): ExplorerLocationMotion {
  if (!validMapPoint(fix) || !Number.isFinite(fix.accuracy) || fix.accuracy < 0
    || !Number.isFinite(fix.timestamp) || !Number.isFinite(receivedAt)
    || (previous.latest && fix.timestamp <= previous.latest.timestamp)) return previous;

  const next = { ...previous, latest: fix };
  const reanchor = (usable = true): ExplorerLocationMotion => ({ ...next, anchor: usable ? fix : null, walkingUntil: 0 });
  if (fix.accuracy > maximumAccuracy) return reanchor(false);
  if (!previous.latest || !previous.anchor) return reanchor();

  const elapsed = (fix.timestamp - previous.latest.timestamp) / 1000;
  const anchorElapsed = (fix.timestamp - previous.anchor.timestamp) / 1000;
  // Do not bridge a tracking gap or accumulate slow drift from an old anchor.
  if (elapsed > 12 || anchorElapsed > 30) return reanchor();

  const step = mapDistance(previous.latest, fix);
  const uncertainty = Math.max(2.5, Math.hypot(previous.anchor.accuracy, fix.accuracy) * 0.35);
  const stepUncertainty = Math.max(3, Math.hypot(previous.latest.accuracy, fix.accuracy) * 0.5);
  const reportedSpeed = typeof fix.speed === "number" && Number.isFinite(fix.speed) && fix.speed >= 0 ? fix.speed : null;
  if ((reportedSpeed !== null && reportedSpeed > maximumWalkingSpeed)
    || step > maximumWalkingSpeed * elapsed + stepUncertainty) return reanchor();

  const distance = mapDistance(previous.anchor, fix);
  if (distance < uncertainty) return next;
  const speed = distance / anchorElapsed;
  if (speed < 0.35 || speed > maximumWalkingSpeed) return reanchor();

  const deviceHeading = typeof fix.heading === "number" && Number.isFinite(fix.heading)
    ? ((fix.heading % 360) + 360) % 360 : null;
  return {
    ...next, anchor: fix,
    heading: deviceHeading ?? mapBearing(previous.anchor, fix),
    distanceMetres: previous.distanceMetres + distance,
    walkingUntil: receivedAt + EXPLORER_WALK_IDLE_MS,
  };
}
