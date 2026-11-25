export type FirstPersonLook = { yawOffset: number; pitch: number; fieldOfView: number };
export const DEFAULT_EYE_FIELD_OF_VIEW = 36.86989764584402;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const angle = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;
export function createFirstPersonLook(fieldOfView = DEFAULT_EYE_FIELD_OF_VIEW): FirstPersonLook {
  return { yawOffset: 0, pitch: 84, fieldOfView: Number.isFinite(fieldOfView) ? clamp(fieldOfView, 28, 68) : DEFAULT_EYE_FIELD_OF_VIEW };
}
export function turnFirstPersonLook(state: FirstPersonLook, yaw: number, pitch: number): FirstPersonLook {
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return state;
  return { ...state, yawOffset: angle(state.yawOffset + yaw), pitch: clamp(state.pitch + pitch, 45, 85) };
}
/** Optical zoom changes the view angle, never the geographic eye or player. */
export function zoomFirstPersonLook(state: FirstPersonLook, scale: number): FirstPersonLook {
  if (!Number.isFinite(scale) || scale <= 0) return state;
  return { ...state, fieldOfView: clamp(2 * Math.atan(Math.tan(state.fieldOfView * Math.PI / 360) / scale) * 180 / Math.PI, 28, 68) };
}
