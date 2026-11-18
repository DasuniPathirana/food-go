import type { CameraOptions, Map as GeographicMap } from "maplibre-gl";
import type { FirstPersonLook } from "./first-person-look";
import { mapDistance } from "./map-game";

export type ExplorerPerspective = "overhead" | "third" | "close" | "first";
type Point = { longitude: number; latitude: number };
type CameraCalculator = Pick<GeographicMap, "calculateCameraOptionsFromCameraLngLatAltRotation">;
export const FIRST_PERSON_EYE_HEIGHT = 1.7;
export const FIRST_PERSON_PITCH = 84;
export const EXPLORER_CAMERA_TRANSITION_MS = 650;
export const EXPLORER_VIEWS = ["overhead", "third", "close", "first"] as const;
export type ExplorerCameraPose = { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };

export function explorerCameraPose(camera: CameraOptions, fallback: ExplorerCameraPose): ExplorerCameraPose {
  const centre = camera.center;
  return { longitude: !centre ? fallback.longitude : Array.isArray(centre) ? centre[0] : "lng" in centre ? centre.lng : centre.lon,
    latitude: !centre ? fallback.latitude : Array.isArray(centre) ? centre[1] : centre.lat,
    zoom: camera.zoom ?? fallback.zoom, pitch: camera.pitch ?? fallback.pitch, bearing: camera.bearing ?? fallback.bearing };
}

export function isExplorerPerspective(value: unknown): value is ExplorerPerspective {
  return typeof value === "string" && EXPLORER_VIEWS.includes(value as ExplorerPerspective);
}

export function explorerCameraLimits(perspective: ExplorerPerspective, threeD: boolean) {
  // Common limits avoid a visible clamp before the first-person exit transition.
  return { maxPitch: perspective === "first" || threeD ? 85 : 0, maxZoom: 24 };
}

/** Continuous camera blend; geographic longitude and heading use the short arc. */
export function blendExplorerCamera(from: ExplorerCameraPose, to: ExplorerCameraPose, progress: number): CameraOptions {
  const bounded = Math.min(1, Math.max(0, progress));
  const t = bounded * bounded * (3 - 2 * bounded);
  const delta = ((to.longitude - from.longitude + 540) % 360) - 180;
  return { center: [((from.longitude + delta * t + 540) % 360) - 180, from.latitude + (to.latitude - from.latitude) * t],
    zoom: from.zoom + (to.zoom - from.zoom) * t, pitch: from.pitch + (to.pitch - from.pitch) * t,
    bearing: interpolateCameraBearing(from.bearing, to.bearing, t), roll: 0 };
}

function behind(point: Point, heading: number, metres: number): [number, number] {
  const angle = heading * Math.PI / 180;
  return [point.longitude - Math.sin(angle) * metres / (111320 * Math.max(.01, Math.cos(point.latitude * Math.PI / 180))),
    Math.min(85.051128, Math.max(-85.051128, point.latitude - Math.cos(angle) * metres / 111320))];
}
export function explorerCameraPosition(point: Point, heading: number, perspective: "third" | "close", groundElevation = 0) {
  const [longitude, latitude] = behind(point, heading, perspective === "close" ? 8 : 14);
  return { longitude, latitude, altitude: groundElevation + (perspective === "close" ? 3.2 : 4.8) };
}
export function interpolateCameraBearing(from: number, to: number, fraction: number) {
  const start = Number.isFinite(from) ? from : 0, end = Number.isFinite(to) ? to : start;
  const delta = ((end - start + 540) % 360 + 360) % 360 - 180;
  return ((start + delta * Math.min(1, Math.max(0, fraction))) % 360 + 360) % 360;
}

/** The calculator owns the geographic look-ahead and zoom, not a high-zoom imitation. */
export function explorerCameraOptions(calculator: CameraCalculator, input: {
  perspective: ExplorerPerspective; point: Point; heading: number; follow: boolean;
  threeD: boolean; refocus?: boolean; groundElevation?: number; look?: Pick<FirstPersonLook, "yawOffset" | "pitch">;
  cameraPosition?: Point & { altitude: number };
}): CameraOptions | null {
  const { point } = input;
  if (!input.follow || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180
    || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90) return null;
  if (input.perspective === "overhead" || (!input.threeD && input.perspective !== "first")) return {
    center: [point.longitude, point.latitude], pitch: input.threeD ? 44 : 0, roll: 0,
    ...(input.refocus ? { zoom: 16.5 } : {}),
  };
  const ground = Number.isFinite(input.groundElevation) ? input.groundElevation! : 0;
  const heading = interpolateCameraBearing(input.heading, input.heading, 1);
  if (input.perspective === "third" || input.perspective === "close") {
    const close = input.perspective === "close";
    const eye = input.cameraPosition;
    const pitch = eye ? Math.min(85, Math.max(45, Math.atan2(mapDistance(point, eye), Math.max(.1, eye.altitude - ground)) * 180 / Math.PI + 7)) : 78;
    return calculator.calculateCameraOptionsFromCameraLngLatAltRotation(
      eye ? [eye.longitude, eye.latitude] : behind(point, heading, close ? 8 : 14), eye?.altitude ?? ground + (close ? 3.2 : 4.8), heading, pitch, 0,
    );
  }
  return calculator.calculateCameraOptionsFromCameraLngLatAltRotation(
    [point.longitude, Math.min(85.051128, Math.max(-85.051128, point.latitude))],
    ground + FIRST_PERSON_EYE_HEIGHT,
    interpolateCameraBearing(heading + (input.look?.yawOffset ?? 0), heading + (input.look?.yawOffset ?? 0), 1),
    input.look ? Math.min(85, Math.max(45, input.look.pitch)) : FIRST_PERSON_PITCH, 0,
  );
}
