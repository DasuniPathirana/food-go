import { mapDistance, type MapPoint } from "./map-game";

/** Presentation only. Never use interpolated positions as location or XP evidence. */
export function markerTransitionDuration(from: MapPoint | null, to: MapPoint, milliseconds: number, reducedMotion: boolean) {
  if (!from || reducedMotion || mapDistance(from, to) > 250) return 0;
  return Number.isFinite(milliseconds) ? Math.min(1200, Math.max(0, milliseconds)) : 0;
}

/** Follow the short longitude arc, including the world map's date line. */
export function interpolateMarker(from: MapPoint, to: MapPoint, fraction: number): MapPoint {
  const progress = Math.min(1, Math.max(0, fraction));
  const delta = ((to.longitude - from.longitude + 540) % 360) - 180;
  return {
    longitude: ((from.longitude + delta * progress + 540) % 360) - 180,
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
  };
}
