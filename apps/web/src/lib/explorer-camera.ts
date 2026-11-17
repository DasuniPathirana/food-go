import type { CameraOptions, Map as GeographicMap } from "maplibre-gl";

export type ExplorerPerspective = "first" | "third";
type Point = { longitude: number; latitude: number };
type CameraCalculator = Pick<GeographicMap, "calculateCameraOptionsFromCameraLngLatAltRotation">;
export const FIRST_PERSON_EYE_HEIGHT = 1.7;
export const FIRST_PERSON_PITCH = 84;

export function explorerCameraLimits(perspective: ExplorerPerspective, threeD: boolean) {
  return { maxPitch: perspective === "first" ? 85 : threeD ? 65 : 0, maxZoom: perspective === "first" ? 24 : 20 };
}
export function interpolateCameraBearing(from: number, to: number, fraction: number) {
  const start = Number.isFinite(from) ? from : 0, end = Number.isFinite(to) ? to : start;
  const delta = ((end - start + 540) % 360 + 360) % 360 - 180;
  return ((start + delta * Math.min(1, Math.max(0, fraction))) % 360 + 360) % 360;
}

/** The calculator owns the geographic look-ahead and zoom, not a high-zoom imitation. */
export function explorerCameraOptions(calculator: CameraCalculator, input: {
  perspective: ExplorerPerspective; point: Point; heading: number; follow: boolean;
  threeD: boolean; refocus?: boolean; groundElevation?: number;
}): CameraOptions | null {
  const { point } = input;
  if (!input.follow || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180
    || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90) return null;
  if (input.perspective === "third") return {
    center: [point.longitude, point.latitude], pitch: input.threeD ? 44 : 0, roll: 0,
    ...(input.refocus ? { zoom: 16.5 } : {}),
  };
  const ground = Number.isFinite(input.groundElevation) ? input.groundElevation! : 0;
  return calculator.calculateCameraOptionsFromCameraLngLatAltRotation(
    [point.longitude, Math.min(85.051128, Math.max(-85.051128, point.latitude))],
    ground + FIRST_PERSON_EYE_HEIGHT,
    interpolateCameraBearing(input.heading, input.heading, 1), FIRST_PERSON_PITCH, 0,
  );
}
