import { z } from "zod";
import { EXPLORATION_MAX_LATITUDE, EXPLORATION_MAX_STORED_CELLS, explorationCellIdSchema, revealExplorationCells, type ExplorationCellId, type ExplorationPoint } from "@food-go/domain/exploration";
import type { ExplorerLocationFix } from "./explorer-location-motion";

export const DISCOVERY_MIN_ATTEMPT_MS = 6000;
export const DISCOVERY_FIX_MAX_AGE_MS = 15000;
const cells = z.custom<unknown[]>(value => Array.isArray(value) && value.length <= EXPLORATION_MAX_STORED_CELLS)
  .pipe(z.array(explorationCellIdSchema).max(EXPLORATION_MAX_STORED_CELLS))
  .refine(value => new Set(value).size === value.length);
export const explorationObservationResultSchema = z.strictObject({
  accepted: z.boolean(), reason: z.enum(["accuracy", "stale", "rapid", "travel", "capacity"]).nullable(),
}).refine(value => value.accepted === (value.reason === null));
export const geographicDiscoveryResponseSchema = z.strictObject({
  ok: z.literal(true), version: z.literal(1), enabled: z.boolean(), consented: z.boolean(), recordingId: z.uuid().nullable(), cells,
  observation: explorationObservationResultSchema.nullable(), rewardEligible: z.literal(false),
});
export type GeographicDiscoveryResponse = z.infer<typeof geographicDiscoveryResponseSchema>;
export const geographicObservationSchema = z.strictObject({
  action: z.literal("observe"), requestId: z.uuid(), recordingId: z.uuid(), longitude: z.number().min(-180).max(180), latitude: z.number().min(-EXPLORATION_MAX_LATITUDE).max(EXPLORATION_MAX_LATITUDE),
  accuracy: z.number().min(0).max(100000), timestamp: z.int().min(1).max(4102444800000),
});
export const geographicDiscoveryCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("consent"), version: z.literal(1), enabled: z.boolean() }),
  z.strictObject({ action: z.literal("clear") }), geographicObservationSchema,
]);
export type GeographicDiscoveryCommand = z.infer<typeof geographicDiscoveryCommandSchema>;
export const geographicDiscoveryActionSchema = geographicDiscoveryCommandSchema;
export const geographicDiscoverySchema = geographicDiscoveryResponseSchema;
type Observation = z.infer<typeof geographicObservationSchema>;
type Fix = Pick<ExplorerLocationFix, "longitude" | "latitude" | "accuracy" | "timestamp">;
type Operation = "load" | "consent-on" | "consent-off" | "clear" | "observe";
export type DiscoveryRequester = (method: "GET" | "POST", body: GeographicDiscoveryCommand | undefined, signal: AbortSignal) => Promise<GeographicDiscoveryResponse>;

export class GeographicDiscoveryError extends Error {
  constructor(public readonly code: "network" | "response" | "account") { super(`Exploration ${code}.`); this.name = "GeographicDiscoveryError"; }
}

/** Coordinates occur only in POST JSON. No raw fix is stored in browser
 * persistence, query strings, error messages or application logs.
 */
export async function requestGeographicDiscovery(method: "GET" | "POST", value: GeographicDiscoveryCommand | undefined, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<GeographicDiscoveryResponse> {
  const command = method === "POST" ? geographicDiscoveryCommandSchema.safeParse(value) : null;
  if (method === "POST" && !command?.success) throw new GeographicDiscoveryError("response");
  try {
    const response = await fetcher("/api/exploration", { method, credentials: "same-origin", cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      ...(command?.success ? { headers: { "content-type": "application/json" }, body: JSON.stringify(command.data) } : {}),
    });
    if (!response.ok) throw new GeographicDiscoveryError(response.status === 401 || response.status === 403 ? "account" : "network");
    const maximum = 128 * 1024, length = response.headers.get("content-length");
    if (length && (!/^\d+$/u.test(length) || Number(length) > maximum)) throw new GeographicDiscoveryError("response");
    const reader = response.body?.getReader();
    if (!reader) throw new GeographicDiscoveryError("response");
    const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > maximum) { await reader.cancel(); throw new GeographicDiscoveryError("response"); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let data: unknown;
    try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new GeographicDiscoveryError("response"); }
    const parsed = geographicDiscoveryResponseSchema.safeParse(data);
    if (!parsed.success) throw new GeographicDiscoveryError("response");
    return parsed.data;
  } catch (error) { throw error instanceof GeographicDiscoveryError ? error : new GeographicDiscoveryError("network"); }
}

export type GeographicDiscoveryInput = {
  signedIn: boolean; available: boolean; accountKey?: string; mode: "manual" | "live"; fix: ExplorerLocationFix | null; liveReady: boolean;
  previewPoint?: ExplorationPoint | null;
};
type Context = Pick<GeographicDiscoveryInput, "signedIn" | "available" | "accountKey" | "mode" | "liveReady">;
export type GeographicDiscoverySnapshot = {
  enabled: boolean; visibleCells: readonly ExplorationCellId[]; requested: boolean; recording: boolean; saving: boolean;
  error: string | null; message: string; recordedCount: number; sessionCount: number;
};
const initial: GeographicDiscoverySnapshot = Object.freeze({ enabled: false, visibleCells: Object.freeze([]), requested: false, recording: false, saving: false,
  error: null, message: "Discovery preview is off.", recordedCount: 0, sessionCount: 0 });
const reasonMessage = {
  accuracy: "The GPS signal is too uncertain to save this area.", stale: "That location fix expired. Waiting for a fresh fix.",
  rapid: "Waiting a moment before saving another area.", travel: "The movement could not be accepted. Waiting for a steadier signal.",
  capacity: "Saved exploration is full. Clear saved areas before recording more.",
} as const;

export function freshDiscoveryFix(value: ExplorerLocationFix | null, now: number): Fix | null {
  if (!value || !Number.isFinite(now)) return null;
  const parsed = geographicObservationSchema.omit({ action: true, requestId: true, recordingId: true }).safeParse({
    longitude: value.longitude, latitude: value.latitude, accuracy: value.accuracy, timestamp: value.timestamp,
  });
  return parsed.success && parsed.data.accuracy <= 35 && now - parsed.data.timestamp <= DISCOVERY_FIX_MAX_AGE_MS
    && parsed.data.timestamp - now <= 3000 ? parsed.data : null;
}

type SessionOptions = {
  request?: DiscoveryRequester; now?: () => number; requestId?: () => string;
  schedule?: (callback: () => void, delay: number) => unknown; cancel?: (timer: unknown) => void;
};

/** In-memory lifecycle, independently testable without a browser or account.
 * The only precise data retained is one pending envelope plus the latest fix.
 * Saved settings can load cell IDs, but can never activate local recording.
 */
export class GeographicDiscoverySession {
  private readonly request: DiscoveryRequester;
  private readonly now: () => number;
  private readonly makeId: () => string;
  private readonly schedule: (callback: () => void, delay: number) => unknown;
  private readonly cancel: (timer: unknown) => void;
  private readonly listeners = new Set<() => void>();
  private snapshot = initial;
  private context: Context = { signedIn: false, available: false, mode: "manual", liveReady: false };
  private active = false;
  private visible = true;
  private online = true;
  private enabled = false;
  private optedIn = false;
  private acknowledged = false;
  private recordingId: string | null = null;
  private recordingAfter = Infinity;
  private saving = false;
  private error: string | null = null;
  private message = initial.message;
  private recorded = new Set<ExplorationCellId>();
  private manual = new Set<ExplorationCellId>();
  private device = new Set<ExplorationCellId>();
  private previewKey = "";
  private latest: Fix | null = null;
  private pending: Observation | null = null;
  private handledTimestamp = -Infinity;
  private lastSeenTimestamp = -Infinity;
  private lastAttempt = -Infinity;
  private retryOperation: Operation | null = null;
  private epoch = 0;
  private timer: unknown = null;
  private expiryTimer: unknown = null;
  private inFlight: { controller: AbortController; operation: Operation; epoch: number } | null = null;

  constructor(options: SessionOptions = {}) {
    this.request = options.request ?? requestGeographicDiscovery;
    this.now = options.now ?? Date.now;
    this.makeId = options.requestId ?? (() => crypto.randomUUID());
    this.schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.cancel = options.cancel ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>));
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => initial;
  activate() { this.active = true; }
  deactivate() {
    this.active = false; this.invalidate(); this.optedIn = false; this.acknowledged = false; this.recordingId = null; this.enabled = false;
    this.recorded.clear(); this.manual.clear(); this.device.clear(); this.previewKey = ""; this.retryOperation = null;
    this.context = { signedIn: false, available: false, mode: "manual", liveReady: false };
    this.error = null; this.message = initial.message; this.handledTimestamp = -Infinity; this.lastSeenTimestamp = -Infinity; this.lastAttempt = -Infinity; this.recordingAfter = Infinity; this.publish();
  }
  private canRead() { return this.active && this.visible && this.context.signedIn && this.context.available; }
  private canObserve() { return this.canRead() && this.online && this.enabled && this.optedIn && this.acknowledged && this.recordingId !== null && this.context.mode === "live" && this.context.liveReady; }
  private clearTimer() { if (this.timer !== null) this.cancel(this.timer); this.timer = null; }
  private invalidate() {
    this.epoch++; this.inFlight?.controller.abort(); this.inFlight = null; this.saving = false;
    this.clearTimer(); this.pending = null; this.latest = null;
    if (this.expiryTimer !== null) this.cancel(this.expiryTimer); this.expiryTimer = null;
  }
  private scheduleExpiry() {
    if (this.expiryTimer !== null) this.cancel(this.expiryTimer); this.expiryTimer = null;
    const stamps = [this.latest?.timestamp, this.pending?.timestamp].filter((value): value is number => value !== undefined);
    if (!stamps.length) return;
    this.expiryTimer = this.schedule(() => {
      this.expiryTimer = null;
      if (this.latest && !freshDiscoveryFix(this.latest, this.now())) this.latest = null;
      if (this.pending && !this.freshPending()) { this.pending = null; this.message = "That location fix expired. Waiting for a fresh fix."; }
      this.scheduleExpiry(); this.publish();
    }, Math.max(1, Math.min(...stamps) + DISCOVERY_FIX_MAX_AGE_MS + 1 - this.now()));
  }
  private publish() {
    const session = new Set([...this.manual, ...this.device]);
    const union = this.enabled ? [...new Set([...this.recorded, ...session])].slice(0, EXPLORATION_MAX_STORED_CELLS) : [];
    const next: GeographicDiscoverySnapshot = { enabled: this.enabled, visibleCells: union, requested: this.optedIn, recording: this.optedIn && this.acknowledged,
      saving: this.saving, error: this.error, message: this.message, recordedCount: this.recorded.size, sessionCount: session.size };
    const old = this.snapshot;
    if (old.enabled === next.enabled && old.requested === next.requested && old.recording === next.recording && old.saving === next.saving && old.error === next.error && old.message === next.message
      && old.recordedCount === next.recordedCount && old.sessionCount === next.sessionCount && old.visibleCells.length === union.length && old.visibleCells.every((id, index) => id === union[index])) return;
    this.snapshot = next; this.listeners.forEach(listener => listener());
  }
  private applyRecorded(ids: readonly ExplorationCellId[]) {
    this.recorded = new Set(ids);
    const budget = new Set(this.recorded);
    for (const bucket of [this.manual, this.device]) for (const id of bucket) {
      if (budget.has(id)) continue;
      if (budget.size >= EXPLORATION_MAX_STORED_CELLS) bucket.delete(id); else budget.add(id);
    }
  }
  private addPreview(source: "manual" | "device", ids: readonly ExplorationCellId[]) {
    const key = `${source}:${ids.join(",")}`;
    if (key === this.previewKey) return;
    this.previewKey = key;
    const bucket = source === "manual" ? this.manual : this.device, all = new Set([...this.recorded, ...this.manual, ...this.device]);
    for (const id of ids) {
      if (!all.has(id) && all.size >= EXPLORATION_MAX_STORED_CELLS) { this.message = "Session preview is full. Clear the preview to explore another area."; continue; }
      bucket.add(id); all.add(id);
    }
  }
  configure(input: GeographicDiscoveryInput) {
    if (!this.active) return;
    const changedAccount = this.context.signedIn !== input.signedIn || this.context.available !== input.available || this.context.accountKey !== input.accountKey;
    this.context = { signedIn: input.signedIn, available: input.available, accountKey: input.accountKey, mode: input.mode, liveReady: input.liveReady };
    if (changedAccount) {
      this.invalidate(); this.optedIn = false; this.acknowledged = false; this.recordingId = null; this.recorded.clear(); this.retryOperation = null; this.error = null;
      this.manual.clear(); this.device.clear(); this.previewKey = ""; this.handledTimestamp = -Infinity; this.lastSeenTimestamp = -Infinity; this.lastAttempt = -Infinity; this.recordingAfter = Infinity;
      this.message = "Saving explored areas is off for this session.";
      if (this.canRead()) this.load();
    }
    const fix = this.visible && input.mode === "live" && input.liveReady ? freshDiscoveryFix(input.fix, this.now()) : null;
    if (!fix) {
      this.latest = null; this.pending = null; this.clearTimer();
      if (this.inFlight?.operation === "observe") { this.epoch++; this.inFlight.controller.abort(); this.inFlight = null; this.saving = false; }
    } else {
      this.lastSeenTimestamp = Math.max(this.lastSeenTimestamp, fix.timestamp);
      if (this.optedIn && (!this.latest || fix.timestamp >= this.latest.timestamp)) this.latest = fix;
      else if (!this.optedIn) this.latest = null;
    }
    if (this.enabled && this.visible) {
      if (input.mode === "manual" && input.previewPoint) this.addPreview("manual", revealExplorationCells({ point: input.previewPoint, accuracyMetres: 0 }));
      else if (fix) this.addPreview("device", revealExplorationCells({ point: { longitude: fix.longitude, latitude: fix.latitude }, accuracyMetres: fix.accuracy }));
    }
    this.scheduleExpiry(); this.pump(); this.publish();
  }
  setVisible(value: boolean) {
    if (this.visible === value) return;
    this.visible = value;
    if (!value) {
      const outstanding = this.retryOperation ?? this.inFlight?.operation;
      const keep = outstanding === "consent-off" || outstanding === "clear" ? outstanding : null;
      this.invalidate(); this.optedIn = false; this.acknowledged = false; this.recordingId = null; this.recordingAfter = Infinity; this.lastSeenTimestamp = -Infinity; this.retryOperation = keep;
      this.message = "Saving paused while this page was hidden. Turn it on again to resume.";
      if (keep) this.error = keep === "clear" ? "Deletion has not been confirmed. Retry when ready." : "Your account choice has not been confirmed. Saving is stopped on this page.";
    } else if (this.canRead() && !this.retryOperation) this.load();
    this.publish();
  }
  setOnline(value: boolean) {
    if (this.online === value) return;
    this.online = value;
    if (!value) {
      const operation = this.inFlight?.operation ?? (this.optedIn && this.acknowledged ? "observe" : null);
      this.epoch++; this.inFlight?.controller.abort(); this.inFlight = null; this.saving = false; this.clearTimer();
      if (operation) { this.retryOperation = operation; this.error = "You are offline. Retry when the connection returns."; this.message = "Saving is paused. No location backlog is stored."; }
    } else if (this.retryOperation) this.message = "Connection restored. Retry to continue.";
    this.publish();
  }
  toggle = () => {
    if (!this.active) return;
    if (this.enabled) {
      this.enabled = false;
      if (this.optedIn || this.acknowledged) this.setRecording(false);
      else { this.latest = null; this.pending = null; this.clearTimer(); this.message = "Discovery preview is off."; }
    } else { this.enabled = true; this.previewKey = ""; this.message = "Discovery preview is on. Session exploration stays on this page."; }
    this.publish();
  };
  setRecording = (value: boolean) => {
    if (!this.active) return;
    this.invalidate(); this.retryOperation = null; this.error = null; this.optedIn = value; this.acknowledged = false; this.recordingId = null;
    this.recordingAfter = value ? Math.max(this.now(), this.lastSeenTimestamp) : Infinity;
    if (value) this.enabled = true;
    if (!this.canRead()) {
      this.optedIn = false; this.error = "Sign in to an available account service to save explored areas."; this.message = "Your session preview remains separate from saved exploration."; this.publish(); return;
    }
    this.message = value ? "Confirming your exploration saving choice…" : "Saving is off on this page. Updating your account choice…";
    this.perform(value ? "consent-on" : "consent-off", { action: "consent", version: 1, enabled: value });
    this.publish();
  };
  clearSaved = () => {
    if (!this.active) return;
    this.invalidate(); this.optedIn = false; this.acknowledged = false; this.recordingId = null; this.recordingAfter = Infinity; this.lastSeenTimestamp = -Infinity;
    this.recorded.clear(); this.retryOperation = null; this.error = null;
    this.message = "Clearing saved areas. Session preview stays separate.";
    if (!this.canRead()) { this.error = "Saved exploration is unavailable. Deletion has not been confirmed."; this.publish(); return; }
    this.perform("clear", { action: "clear" }); this.publish();
  };
  clearPreview = () => {
    this.manual.clear(); this.device.clear(); this.message = "Session preview cleared. Saved areas are unchanged."; this.publish();
  };
  retry = () => {
    if (!this.active || !this.visible || !this.online || !this.retryOperation) return;
    const operation = this.retryOperation; this.retryOperation = null; this.error = null;
    if (operation === "observe") {
      if (this.pending && !this.freshPending()) { this.pending = null; this.latest = null; this.message = "That location fix expired. Waiting for a fresh fix."; this.publish(); return; }
      this.pump();
    } else if (operation === "consent-on") { if (this.optedIn) this.perform(operation, { action: "consent", version: 1, enabled: true }); }
    else if (operation === "consent-off") this.perform(operation, { action: "consent", version: 1, enabled: false });
    else if (operation === "clear") this.perform(operation, { action: "clear" });
    else this.load();
    this.publish();
  };
  private freshPending() { return this.pending !== null && freshDiscoveryFix(this.pending, this.now()) !== null; }
  private load() { this.message = "Loading saved exploration…"; this.perform("load", undefined); }
  private pump() {
    if (!this.canObserve() || this.inFlight || this.retryOperation) return;
    if (this.pending && !this.freshPending()) { this.pending = null; this.message = "That location fix expired. Waiting for a fresh fix."; }
    if (!this.pending) {
      const fix = this.latest && freshDiscoveryFix(this.latest, this.now());
      if (!fix || fix.timestamp <= this.handledTimestamp || fix.timestamp <= this.recordingAfter) return;
      this.pending = { action: "observe", requestId: this.makeId(), recordingId: this.recordingId!, ...fix }; this.scheduleExpiry();
    }
    const remaining = DISCOVERY_MIN_ATTEMPT_MS - (this.now() - this.lastAttempt);
    if (remaining > 0) {
      if (this.timer === null) this.timer = this.schedule(() => { this.timer = null; this.pump(); this.publish(); }, remaining);
      return;
    }
    this.lastAttempt = this.now(); this.perform("observe", this.pending);
  }
  private perform(operation: Operation, body: GeographicDiscoveryCommand | undefined) {
    if (!this.canRead()) return;
    if (!this.online) { this.retryOperation = operation; this.error = "You are offline. Retry when the connection returns."; this.message = operation === "consent-off" ? "Saving is off on this page. Your account choice has not been confirmed." : "No location backlog is stored."; return; }
    if (this.inFlight) { this.epoch++; this.inFlight.controller.abort(); }
    const token = { controller: new AbortController(), operation, epoch: this.epoch };
    this.inFlight = token; this.saving = true; this.error = null;
    void this.request(operation === "load" ? "GET" : "POST", body, token.controller.signal).then(value => {
      if (!this.active || !this.visible || this.epoch !== token.epoch || this.inFlight !== token) return;
      const parsed = geographicDiscoveryResponseSchema.safeParse(value);
      if (!parsed.success || (operation === "observe" && !parsed.data.observation)
        || (operation === "consent-on" && (!parsed.data.enabled || !parsed.data.consented || !parsed.data.recordingId))
        || (operation === "consent-off" && (parsed.data.enabled || parsed.data.recordingId !== null)) || (operation === "clear" && (parsed.data.enabled || parsed.data.recordingId !== null || parsed.data.cells.length))) throw new GeographicDiscoveryError("response");
      this.inFlight = null; this.saving = false; this.retryOperation = null; this.applyRecorded(parsed.data.cells);
      if (operation === "consent-on") {
        this.acknowledged = this.optedIn; this.recordingId = parsed.data.recordingId; this.recordingAfter = Math.max(this.now(), this.lastSeenTimestamp); this.latest = null;
        this.message = "Saving is on for this session. Waiting for a new live location fix.";
      }
      else if (operation === "consent-off") this.message = "Saving is off on this page and in your account settings.";
      else if (operation === "clear") this.message = "Saved areas cleared. Session preview is unchanged.";
      else if (operation === "load") this.message = "Saved areas loaded. Saving is off until you turn it on for this session.";
      else {
        const outcome = parsed.data.observation!;
        this.handledTimestamp = Math.max(this.handledTimestamp, this.pending?.timestamp ?? -Infinity); this.pending = null;
        this.message = outcome.accepted ? "Explored area saved. This does not verify a visit or earn rewards." : reasonMessage[outcome.reason!];
        if (!parsed.data.enabled || !parsed.data.consented || parsed.data.recordingId !== this.recordingId || outcome.reason === "capacity") {
          this.optedIn = false; this.acknowledged = false; this.recordingId = null; this.latest = null; this.clearTimer();
        }
      }
      this.scheduleExpiry(); this.pump(); this.publish();
    }).catch(error => {
      if (!this.active || !this.visible || this.epoch !== token.epoch || this.inFlight !== token) return;
      this.inFlight = null; this.saving = false; this.retryOperation = operation;
      if (error instanceof GeographicDiscoveryError && error.code === "account") {
        this.optedIn = false; this.acknowledged = false; this.recordingId = null; this.pending = null; this.latest = null; this.recordingAfter = Infinity;
        this.clearTimer(); this.scheduleExpiry();
        if (operation === "observe" || operation === "consent-on") this.retryOperation = "load";
        this.error = "The saving session changed. Sign in again if needed, then turn saving on again.";
        this.message = operation === "clear" ? "Deletion has not been confirmed. Saving is stopped on this page."
          : operation === "consent-off" ? "Saving is off on this page. Your account choice has not been confirmed."
            : "Saving stopped. The old location observation will not be retried.";
        this.publish(); return;
      }
      this.error = "Saved exploration could not be updated. Retry when ready.";
      this.message = operation === "clear" ? "Deletion has not been confirmed. Saving is stopped on this page."
        : operation === "consent-off" ? "Saving is off on this page. Your account choice has not been confirmed."
          : "No location backlog is stored. A retry can use only the current fresh observation.";
      this.publish();
    });
  }
}
