import type { EncounterPublic } from "./encounters";
import type { EncounterLandmarkRecord } from "./encounter-landmarks";

const emptyRecords: readonly EncounterLandmarkRecord[] = Object.freeze([]);
type Requester = (venueId: string, signal: AbortSignal) => Promise<EncounterPublic>;
type Options = {
  request: Requester;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => unknown;
  cancel?: (timer: unknown) => void;
};

/** Public venue hints only. A polling tick never cancels a same-key request.
 * No device coordinates, account data or confirmation codes are retained here.
 */
export class EncounterLandmarkLoader {
  private readonly request: Requester;
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delay: number) => unknown;
  private readonly cancel: (timer: unknown) => void;
  private readonly listeners = new Set<() => void>();
  private readonly cache = new Map<string, EncounterLandmarkRecord>();
  private snapshot = emptyRecords;
  private mounted = false;
  private enabled = false;
  private key = "";
  private ids: readonly string[] = [];
  private generation = 0;
  private nextRequestAt = 0;
  private timer: unknown = null;
  private inFlight: { controller: AbortController; generation: number } | null = null;

  constructor(options: Options) {
    this.request = options.request;
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.cancel = options.cancel ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>));
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => emptyRecords;
  activate() { this.mounted = true; }
  deactivate() {
    this.mounted = false; this.enabled = false; this.key = ""; this.ids = [];
    this.invalidate(); this.clearCache();
  }
  private publish() { this.snapshot = [...this.cache.values()]; this.listeners.forEach(listener => listener()); }
  private clearCache() { if (this.cache.size) { this.cache.clear(); this.publish(); } }
  private invalidate() {
    this.generation++; this.inFlight?.controller.abort(); this.inFlight = null;
    if (this.timer !== null) this.cancel(this.timer); this.timer = null;
  }
  configure(enabled: boolean, ids: readonly string[], clearCache = false) {
    if (!this.mounted) return;
    const nextIds = [...new Set(ids.slice(0, 3))].sort(), nextKey = nextIds.join(",");
    if (enabled !== this.enabled || nextKey !== this.key) {
      this.invalidate(); this.enabled = enabled; this.ids = nextIds; this.key = nextKey;
    }
    if (clearCache) this.clearCache();
    this.pump();
  }
  private canLoad() { return this.mounted && this.enabled && !!this.key; }
  private current(token: NonNullable<EncounterLandmarkLoader["inFlight"]>) {
    return this.canLoad() && this.inFlight === token && token.generation === this.generation && !token.controller.signal.aborted;
  }
  private save(record: EncounterLandmarkRecord) {
    this.cache.delete(record.venueId); this.cache.set(record.venueId, record);
    while (this.cache.size > 50) this.cache.delete(this.cache.keys().next().value!);
    this.publish();
  }
  private pump() {
    if (!this.canLoad() || this.inFlight) return;
    const missing = this.ids.filter(id => (this.cache.get(id)?.expiresAt ?? 0) <= this.now());
    if (!missing.length) return;
    const remaining = this.nextRequestAt - this.now();
    if (remaining > 0) {
      if (this.timer === null) this.timer = this.schedule(() => { this.timer = null; this.pump(); }, remaining);
      return;
    }
    if (this.timer !== null) this.cancel(this.timer); this.timer = null;
    this.nextRequestAt = this.now() + 6000;
    const token = { controller: new AbortController(), generation: this.generation };
    this.inFlight = token;
    void Promise.allSettled(missing.map(async venueId => {
      try {
        const response = await this.request(venueId, token.controller.signal);
        if (!this.current(token)) return;
        const loadedAt = this.now(), remaining = response.encounters.length
          ? Math.min(...response.encounters.map(campaign => Date.parse(campaign.endsAt) - Date.parse(response.serverTime))) : 60000;
        this.save({ venueId, loadedAt, expiresAt: loadedAt + Math.max(0, Math.min(60000, remaining)), campaigns: response.encounters });
      } catch {
        if (this.current(token)) this.save({ venueId, loadedAt: this.now(), expiresAt: this.now() + 15000, campaigns: [] });
      }
    })).then(() => {
      if (!this.current(token)) return;
      this.inFlight = null; this.pump();
    });
  }
}
