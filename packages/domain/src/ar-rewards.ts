import { z } from "zod";

export const AR_DISCOVERY_RADIUS_METRES = 100;
export const AR_INTERACTION_RADIUS_METRES = 25;

export const AR_DEVICE_CAPABILITIES = [
  "spatial_native_arkit",     // Native iOS with ARKit surface tracking
  "spatial_native_arcore",    // Native Android with ARCore surface tracking
  "webxr_hit_test",           // Browser with WebXR Device API and hit-test support
  "camera_overlay_sensor",    // Mobile browser/device with camera feed and device orientation/gyroscope
  "fallback_direct_claim",    // Desktop or camera-denied browser with verified location/staff flow
] as const;
export type ARDeviceCapability = typeof AR_DEVICE_CAPABILITIES[number];

export const AR_CLAIM_STAGES = [
  "discovered",      // Marked on player's map
  "in_proximity",   // Within AR interaction radius (< 25m)
  "camera_opened",  // Camera feed active and surface/sensor ready
  "target_locked",  // Virtual collectible visible & targeted
  "interacted",     // Player tapped/interacted with the collectible
  "verifying",      // Server validating claim authenticity and single-use constraints
  "claimed",        // Confirmed by backend, added to player inventory
  "failed",         // Verification failed (out of range, expired, cooldown)
] as const;
export type ARClaimStage = typeof AR_CLAIM_STAGES[number];

export const arCollectibleItemSchema = z.strictObject({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  venueName: z.string().min(2).max(120),
  name: z.string().min(2).max(80),
  description: z.string().min(5).max(300),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
  icon: z.string().min(2).max(64),
  coordinates: z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  rewardXp: z.number().int().min(10).max(1000),
  cooldownHours: z.number().int().min(1).max(168).default(24),
  requiresStaffVerification: z.boolean().default(false),
});
export type ARCollectibleItem = z.infer<typeof arCollectibleItemSchema>;

export const arClaimSubmissionSchema = z.strictObject({
  collectibleId: z.string().uuid(),
  venueId: z.string().uuid(),
  playerCoordinates: z.strictObject({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMetres: z.number().min(0).max(100),
  }),
  capability: z.enum(AR_DEVICE_CAPABILITIES),
  interactionDurationMs: z.number().int().min(200).max(300000), // Real human interaction
  staffCode: z.string().regex(/^[0-9]{4,6}$/).optional(),
});
export type ARClaimSubmission = z.infer<typeof arClaimSubmissionSchema>;

export const arClaimResultSchema = z.strictObject({
  success: z.boolean(),
  stage: z.enum(AR_CLAIM_STAGES),
  itemId: z.string().uuid().optional(),
  name: z.string().optional(),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]).optional(),
  rewardXp: z.number().int().optional(),
  error: z.string().optional(),
  claimedAt: z.string().datetime().optional(),
});
export type ARClaimResult = z.infer<typeof arClaimResultSchema>;

function haversineMetres(c1: { longitude: number; latitude: number }, c2: { longitude: number; latitude: number }) {
  const R = 6371000;
  const dLat = (c2.latitude - c1.latitude) * Math.PI / 180;
  const dLon = (c2.longitude - c1.longitude) * Math.PI / 180;
  const lat1 = c1.latitude * Math.PI / 180;
  const lat2 = c2.latitude * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Validates player eligibility for an AR collectible claim based on server-verified distance.
 */
export function validateAREligibility(
  collectible: ARCollectibleItem,
  playerLocation: { longitude: number; latitude: number; accuracyMetres: number }
): { eligible: boolean; distanceMetres: number; reason?: string } {
  const distance = haversineMetres(collectible.coordinates, playerLocation);
  
  // Reject GPS fixes with poor accuracy (> 50m)
  if (playerLocation.accuracyMetres > 50) {
    return {
      eligible: false,
      distanceMetres: Math.round(distance),
      reason: "GPS location accuracy is too low. Move to an open area with a clearer signal.",
    };
  }

  // Must be within interaction radius + GPS accuracy margin
  const maxAllowedDistance = AR_INTERACTION_RADIUS_METRES + Math.min(playerLocation.accuracyMetres, 15);
  if (distance > maxAllowedDistance) {
    return {
      eligible: false,
      distanceMetres: Math.round(distance),
      reason: `You are ${Math.round(distance)}m away. Move closer (within ${AR_INTERACTION_RADIUS_METRES}m) to interact.`,
    };
  }

  return {
    eligible: true,
    distanceMetres: Math.round(distance),
  };
}

/**
 * Determines device AR capability level from browser/client environment flags.
 */
export function determineARCapability(options: {
  isNativeApp?: boolean;
  platform?: "ios" | "android" | "web";
  hasCameraPermission?: boolean;
  hasDeviceOrientation?: boolean;
  hasWebXRHitTest?: boolean;
}): ARDeviceCapability {
  if (options.isNativeApp) {
    if (options.platform === "ios" && options.hasCameraPermission) {
      return "spatial_native_arkit";
    }
    if (options.platform === "android" && options.hasCameraPermission) {
      return "spatial_native_arcore";
    }
  }

  if (options.hasWebXRHitTest) {
    return "webxr_hit_test";
  }

  if (options.hasCameraPermission && options.hasDeviceOrientation) {
    return "camera_overlay_sensor";
  }

  return "fallback_direct_claim";
}
