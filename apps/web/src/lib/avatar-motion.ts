const circle = Math.PI * 2;
const legLength = 0.35;
export const AVATAR_STRIDE_METRES = 1.45;
export const AVATAR_CAMERA_YAW = Math.atan2(2.9, 6);

export type AvatarDistanceTransition = { from: number; target: number; startedAt: number; durationMs: number };

/** Match the marker's linear travel; the same target never restarts its clock. */
export function retargetAvatarDistance(previous: AvatarDistanceTransition | null, target: number, now: number, milliseconds = 80): AvatarDistanceTransition {
  const distance = Number.isFinite(target) ? Math.max(0, target) : previous?.target ?? 0;
  if (previous?.target === distance) return previous;
  const durationMs = Number.isFinite(milliseconds) ? Math.min(1200, Math.max(0, milliseconds)) : 0;
  if (!previous || distance < previous.target || !durationMs) return { from: distance, target: distance, startedAt: now, durationMs: 0 };
  return { from: avatarDistanceAt(previous, now), target: distance, startedAt: now, durationMs };
}

export function avatarDistanceAt(transition: AvatarDistanceTransition, now: number) {
  const progress = transition.durationMs ? Math.min(1, Math.max(0, (now - transition.startedAt) / transition.durationMs)) : 1;
  return transition.from + (transition.target - transition.from) * progress;
}

/** Turn through the short arc, including north and the antimeridian. */
export function shortestAvatarTurn(from: number, to: number) {
  return ((to - from + Math.PI) % circle + circle) % circle - Math.PI;
}

/** The model looks along +Z; camera-facing is south on the map. */
export function avatarMapYaw(heading?: number, mapBearing = 0) {
  if (!Number.isFinite(heading)) return -0.13;
  const bearing = Number.isFinite(mapBearing) ? mapBearing : 0;
  return AVATAR_CAMERA_YAW + Math.PI - (heading! - bearing) * Math.PI / 180;
}

/** Stance stays grounded; swing bends the knee and lifts the foot clear. */
export function avatarLegPose(distanceMetres: number, side: 0 | 1, bodyBob = 0) {
  const distance = Number.isFinite(distanceMetres) ? Math.max(0, distanceMetres) : 0;
  const cycle = ((distance / AVATAR_STRIDE_METRES + side * 0.5) % 1 + 1) % 1;
  const grounded = cycle < 0.6;
  const swing = grounded ? 0 : (cycle - 0.6) / 0.4;
  const ease = swing * swing * (3 - 2 * swing);
  const forward = grounded ? 0.2 - 0.4 * cycle / 0.6 : -0.2 + 0.4 * ease;
  const lift = grounded ? 0 : Math.sin(swing * Math.PI) * 0.12;
  const down = 0.65 + (Number.isFinite(bodyBob) ? bodyBob : 0) - lift;
  const radiusSquared = down * down + forward * forward;
  const knee = Math.acos(Math.max(-1, Math.min(1, (radiusSquared - 2 * legLength ** 2) / (2 * legLength ** 2))));
  const hip = -Math.atan2(forward, down) - Math.atan2(legLength * Math.sin(knee), legLength * (1 + Math.cos(knee)));
  const toe = grounded ? cycle < 0.1 ? -0.12 * (1 - cycle / 0.1) : cycle > 0.48 ? (cycle - 0.48) / 0.12 * 0.16 : 0 : -Math.sin(swing * Math.PI) * 0.08;
  return { hip, knee, foot: -hip - knee + toe, grounded, lift, forward };
}
