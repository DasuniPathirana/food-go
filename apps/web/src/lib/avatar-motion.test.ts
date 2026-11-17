import assert from "node:assert/strict";
import test from "node:test";
import { avatarDistanceAt, avatarLegPose, avatarMapYaw, AVATAR_STRIDE_METRES, retargetAvatarDistance, shortestAvatarTurn } from "./avatar-motion";

test("GPS gait advances with the marker over its full transition and settles exactly", () => {
  const initial = retargetAvatarDistance(null, 0, 0, 600);
  const travel = retargetAvatarDistance(initial, 3, 1000, 600);
  assert.equal(avatarDistanceAt(travel, 1000), 0);
  assert.equal(avatarDistanceAt(travel, 1150), 0.75);
  assert.equal(avatarDistanceAt(travel, 1300), 1.5);
  assert.equal(avatarDistanceAt(travel, 1600), 3);
  assert.equal(avatarDistanceAt(travel, 5000), 3);
  assert.equal(retargetAvatarDistance(travel, 3, 1200, 600), travel);
});

test("new fixes continue from displayed gait distance and a new session does not walk backwards", () => {
  const start = retargetAvatarDistance(null, 0, 0, 80);
  const first = retargetAvatarDistance(start, 2, 100, 80);
  const continued = retargetAvatarDistance(first, 3, 140, 80);
  assert.equal(avatarDistanceAt(first, 140), avatarDistanceAt(continued, 140));
  assert.equal(avatarDistanceAt(continued, 220), 3);
  const reset = retargetAvatarDistance(continued, 0, 200, 600);
  assert.equal(avatarDistanceAt(reset, 200), 0);
  assert.equal(avatarDistanceAt(reset, 500), 0);
});

test("avatar heading follows the map camera and takes the short turn across north", () => {
  assert.ok(Math.abs(shortestAvatarTurn(avatarMapYaw(359), avatarMapYaw(1))) < 0.04);
  assert.ok(Math.abs(shortestAvatarTurn(avatarMapYaw(90, 45), avatarMapYaw(45, 0))) < 1e-10);
  assert.equal(avatarMapYaw(undefined), -0.13);
  assert.ok(Number.isFinite(avatarMapYaw(30, Number.NaN)));
});

test("walk contacts repeat by travelled distance and the two legs alternate", () => {
  for (let distance = 0; distance < 5; distance += 0.07) {
    const first = avatarLegPose(distance, 0), repeated = avatarLegPose(distance + AVATAR_STRIDE_METRES, 0);
    assert.ok(Math.abs(first.hip - repeated.hip) < 1e-10);
    const opposite = avatarLegPose(distance, 1), shifted = avatarLegPose(distance + AVATAR_STRIDE_METRES / 2, 0);
    assert.ok(Math.abs(opposite.knee - shifted.knee) < 1e-10);
    assert.ok(Object.values(first).every(value => typeof value !== "number" || Number.isFinite(value)));
  }
});

test("stance feet remain planted despite body weight shift, and swing feet clear the ground", () => {
  for (const bob of [-0.015, 0, 0.015]) {
    const stance = avatarLegPose(0.2, 0, bob);
    assert.equal(stance.grounded, true);
    const down = 0.35 * Math.cos(stance.hip) + 0.35 * Math.cos(stance.hip + stance.knee);
    assert.ok(Math.abs(bob - down + 0.65) < 1e-10);
    const swing = avatarLegPose(AVATAR_STRIDE_METRES * 0.8, 0, bob);
    assert.equal(swing.grounded, false);
    assert.ok(swing.lift > 0.11);
  }
  assert.ok(Number.isFinite(avatarLegPose(Number.NaN, 0).hip));
});
