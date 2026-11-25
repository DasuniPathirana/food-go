import assert from "node:assert/strict";
import test from "node:test";
import { createDeviceCompass, deviceCompassHeading, type CompassSample, type CompassState } from "./device-compass";

test("compass accepts absolute orientation and rejects relative, flat and inaccurate signals", () => {
  assert.equal(deviceCompassHeading({ absolute: true, alpha: 0, beta: 90, gamma: 0 }), 0);
  assert.equal(deviceCompassHeading({ absolute: true, alpha: 90, beta: 90, gamma: 0 }), 270);
  assert.equal(deviceCompassHeading({ absolute: false, alpha: 0, beta: 90, gamma: 0 }), null);
  assert.equal(deviceCompassHeading({ absolute: true, alpha: 0, beta: 0, gamma: 0 }), null);
  assert.equal(deviceCompassHeading({ absolute: true, alpha: NaN, beta: 90, gamma: 0 }), null);
  assert.equal(deviceCompassHeading({ webkitCompassHeading: 370, webkitCompassAccuracy: 5 }), 10);
  assert.equal(deviceCompassHeading({ webkitCompassHeading: 20, webkitCompassAccuracy: -1 }), null);
});
test("permission is explicit, denied/unsupported devices never subscribe, and cancelled permission cannot revive sensors", async () => {
  const states: CompassState[] = []; let requests = 0, subscriptions = 0;
  const denied = createDeviceCompass({ available: true, secure: true, requestPermission: async () => { requests++; return "denied"; }, subscribe: () => { subscriptions++; return () => {}; }, onChange: state => states.push(state) });
  assert.equal(requests, 0); await denied.start(); assert.equal(requests, 1); assert.equal(subscriptions, 0); assert.equal(states.at(-1)?.status, "denied"); denied.dispose();
  const unsupported = createDeviceCompass({ available: false, secure: true, subscribe: () => { subscriptions++; return () => {}; }, onChange: state => states.push(state) });
  await unsupported.start(); assert.equal(subscriptions, 0); assert.equal(states.at(-1)?.status, "unsupported"); unsupported.dispose();
  let grant!: (value: string) => void;
  const pending = createDeviceCompass({ available: true, secure: true, requestPermission: () => new Promise(resolve => { grant = resolve; }), subscribe: () => { subscriptions++; return () => {}; }, onChange: state => states.push(state) });
  const started = pending.start(); pending.stop("paused"); grant("granted"); await started;
  assert.equal(states.at(-1)?.status, "paused"); assert.equal(subscriptions, 0); pending.dispose();
});
test("sensor subscriptions stop on timeout/hide and late samples cannot update state", async () => {
  const states: CompassState[] = []; let receive!: (sample: CompassSample) => void, stopped = 0;
  const compass = createDeviceCompass({ available: true, secure: true, timeoutMs: 15,
    subscribe: callback => { receive = callback; return () => { stopped++; }; }, onChange: state => states.push(state) });
  await compass.start(); receive({ absolute: true, alpha: 0, beta: 90, gamma: 0 });
  assert.equal(states.at(-1)?.status, "active");
  compass.stop("paused"); const count = states.length; receive({ absolute: true, alpha: 90, beta: 90, gamma: 0 });
  assert.equal(states.length, count); assert.equal(stopped, 1);
  await compass.start(); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(states.at(-1)?.status, "unavailable"); assert.equal(stopped, 2); compass.dispose();
});
