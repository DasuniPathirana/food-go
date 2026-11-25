import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAREligibility,
  determineARCapability,
  arClaimSubmissionSchema,
  type ARCollectibleItem,
} from "./ar-rewards";

const sampleCollectible: ARCollectibleItem = {
  id: "e0000000-0000-4000-8000-000000000001",
  venueId: "b0000000-0000-4000-8000-000000000002",
  venueName: "Degraves Espresso Bar",
  name: "Vintage Golden Portafilter",
  description: "An iconic coffee collectible hovering above the laneway entrance.",
  rarity: "rare",
  icon: "coffee-portafilter",
  coordinates: { longitude: 144.9658, latitude: -37.8170 },
  rewardXp: 120,
  cooldownHours: 24,
  requiresStaffVerification: false,
};

test("validateAREligibility grants access when player is in close proximity", () => {
  // ~8 metres away with good 5m accuracy
  const result = validateAREligibility(sampleCollectible, {
    longitude: 144.96585,
    latitude: -37.81705,
    accuracyMetres: 5,
  });
  assert.equal(result.eligible, true);
  assert.ok(result.distanceMetres <= 25);
});

test("validateAREligibility rejects player when too far away", () => {
  // ~120 metres away
  const result = validateAREligibility(sampleCollectible, {
    longitude: 144.9670,
    latitude: -37.8180,
    accuracyMetres: 10,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reason?.includes("Move closer"));
});

test("validateAREligibility rejects inaccurate GPS fix (>50m)", () => {
  const result = validateAREligibility(sampleCollectible, {
    longitude: 144.9658,
    latitude: -37.8170,
    accuracyMetres: 65,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reason?.includes("accuracy is too low"));
});

test("determineARCapability accurately identifies platform capability tier", () => {
  // Native iOS with camera
  assert.equal(
    determineARCapability({ isNativeApp: true, platform: "ios", hasCameraPermission: true }),
    "spatial_native_arkit"
  );

  // Native Android with camera
  assert.equal(
    determineARCapability({ isNativeApp: true, platform: "android", hasCameraPermission: true }),
    "spatial_native_arcore"
  );

  // Browser with WebXR hit-test
  assert.equal(
    determineARCapability({ hasWebXRHitTest: true }),
    "webxr_hit_test"
  );

  // Mobile browser with camera & orientation
  assert.equal(
    determineARCapability({ hasCameraPermission: true, hasDeviceOrientation: true }),
    "camera_overlay_sensor"
  );

  // Unsupported or camera-denied desktop
  assert.equal(
    determineARCapability({ hasCameraPermission: false }),
    "fallback_direct_claim"
  );
});

test("arClaimSubmissionSchema validates realistic human interaction duration", () => {
  const validSubmission = {
    collectibleId: "e0000000-0000-4000-8000-000000000001",
    venueId: "b0000000-0000-4000-8000-000000000002",
    playerCoordinates: { longitude: 144.9658, latitude: -37.8170, accuracyMetres: 8 },
    capability: "camera_overlay_sensor" as const,
    interactionDurationMs: 4200,
  };
  const parsed = arClaimSubmissionSchema.parse(validSubmission);
  assert.equal(parsed.interactionDurationMs, 4200);

  // Reject bot/instant interaction (< 200ms)
  assert.throws(() => {
    arClaimSubmissionSchema.parse({
      ...validSubmission,
      interactionDurationMs: 50,
    });
  });
});
