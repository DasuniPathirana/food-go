"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { encounterCommandSchema, encounterPublicSchema, encounterSnapshotSchema, encounterVenueSchema,
  type EncounterAction, type EncounterCommand, type EncounterInput, type EncounterPublic, type EncounterSnapshot } from "./encounters";

export class EncounterRequestError extends Error {
  constructor(public readonly kind: "account" | "invalid" | "changed" | "limit" | "unavailable", public readonly uncertain = false) {
    super(kind === "account" ? "Sign in with a verified account to continue."
      : kind === "changed" ? "This record has changed. Refresh it before trying again."
        : kind === "limit" ? "The encounter activity limit has been reached. Try again later."
          : kind === "invalid" ? "Check the encounter details and try again."
            : "The encounter service could not confirm the result. Check your connection and try again.");
    this.name = "EncounterRequestError";
  }
}

async function readBounded(response: Response, signal: AbortSignal, maximum: number): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > maximum)) throw new EncounterRequestError("unavailable", true);
  const reader = response.body?.getReader();
  if (!reader) throw new EncounterRequestError("unavailable", true);
  const chunks: Uint8Array[] = []; let total = 0;
  let aborted: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    aborted = () => { void reader.cancel().catch(() => {}); reject(new EncounterRequestError("unavailable", true)); };
    if (signal.aborted) aborted(); else signal.addEventListener("abort", aborted, { once: true });
  });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), cancelled]);
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximum) { await reader.cancel(); throw new EncounterRequestError("unavailable", true); }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) { throw error instanceof EncounterRequestError ? error : new EncounterRequestError("unavailable", true); }
  finally { if (aborted) signal.removeEventListener("abort", aborted); reader.releaseLock(); }
}

export type EncounterRequester = (command: EncounterCommand | undefined, signal: AbortSignal) => Promise<EncounterSnapshot>;
export async function requestEncounterAccount(command: EncounterCommand | undefined, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<EncounterSnapshot> {
  const parsed = command === undefined ? null : encounterCommandSchema.safeParse(command);
  if (parsed && !parsed.success) throw new EncounterRequestError("invalid");
  const lifetime = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  try {
    const response = await fetcher("/api/encounters", { method: command ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal: lifetime,
      ...(parsed?.success ? { headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) } : {}) });
    if (!response.ok) throw new EncounterRequestError(response.status === 401 || response.status === 403 ? "account"
      : response.status === 409 ? "changed" : response.status === 429 ? "limit" : response.status < 500 ? "invalid" : "unavailable", response.status >= 500);
    const state = encounterSnapshotSchema.safeParse(await readBounded(response, lifetime, 4 * 1024 * 1024));
    if (!state.success) throw new EncounterRequestError("unavailable", !!command);
    return state.data;
  } catch (error) { throw error instanceof EncounterRequestError ? error : new EncounterRequestError("unavailable", !!command); }
}
export async function requestVenueEncounters(venueId: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<EncounterPublic> {
  if (!encounterVenueSchema.shape.id.safeParse(venueId).success) throw new EncounterRequestError("invalid");
  const lifetime = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
  try {
    const response = await fetcher("/api/encounters?" + new URLSearchParams({ venueId }), { credentials: "same-origin", cache: "no-store", signal: lifetime });
    if (!response.ok) throw new EncounterRequestError("unavailable");
    const state = encounterPublicSchema.safeParse(await readBounded(response, lifetime, 256 * 1024));
    if (!state.success || state.data.encounters.some(campaign => campaign.venue.id.toLowerCase() !== venueId.toLowerCase())) throw new EncounterRequestError("unavailable");
    return state.data;
  } catch (error) { throw error instanceof EncounterRequestError ? error : new EncounterRequestError("unavailable"); }
}

type IssuedCode = { code: string; expiresAt: string; action: "issue" | "prepareRedemption" };
export type EncounterClientState = { data: EncounterSnapshot | null; loading: boolean; busy: EncounterAction | null; error: string | null; message: string;
  issued: IssuedCode | null; unconfirmed: boolean; canRetry: boolean; acknowledgedItemId: string | null };
const empty: EncounterClientState = Object.freeze({ data: null, loading: false, busy: null, error: null, message: "", issued: null, unconfirmed: false, canRetry: false, acknowledgedItemId: null });
type Configuration = { signedIn: boolean; enabled: boolean; accountKey?: string; scope?: string };

/** One mounted encounter account session. No code, retry envelope or location
 * is written to browser persistence, URLs or logs. All rewards are server DTOs.
 */
export class EncounterClient {
  private active = false;
  private visible = true;
  private config: Configuration = { signedIn: false, enabled: false };
  private state = empty;
  private generation = 0;
  private request: AbortController | null = null;
  private pending: { signature: string; command: EncounterCommand } | null = null;
  private codeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly requester: EncounterRequester = requestEncounterAccount, private readonly makeId: () => string = () => crypto.randomUUID()) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  getServerSnapshot = () => empty;
  private publish(value: Partial<EncounterClientState>) { this.state = { ...this.state, ...value }; this.listeners.forEach(listener => listener()); }
  private invalidate() {
    this.generation++; this.request?.abort(); this.request = null;
    if (this.codeTimer) clearTimeout(this.codeTimer); this.codeTimer = null;
  }
  private canRead() { return this.active && this.visible && this.config.signedIn && this.config.enabled; }
  activate() { this.active = true; }
  configure(config: Configuration) {
    if (!this.active) return;
    const changed = config.signedIn !== this.config.signedIn || config.enabled !== this.config.enabled || config.accountKey !== this.config.accountKey || config.scope !== this.config.scope;
    this.config = config;
    if (changed) {
      this.invalidate(); this.pending = null; this.state = empty; this.publish({});
      if (this.canRead()) void this.refresh();
    }
  }
  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    if (!visible) {
      const uncertain = this.state.busy !== null || this.pending !== null;
      this.invalidate(); this.pending = null;
      this.publish({ loading: false, busy: null, issued: null, canRetry: false, acknowledgedItemId: null, unconfirmed: uncertain,
        message: uncertain ? "An encounter result is unconfirmed. Refresh your inventory when you return." : "", error: null });
    } else if (this.canRead()) void this.refresh();
  }
  deactivate() { this.active = false; this.invalidate(); this.pending = null; this.config = { signedIn: false, enabled: false }; this.state = empty; this.listeners.forEach(listener => listener()); }
  dismissCode = () => {
    if (this.codeTimer) clearTimeout(this.codeTimer); this.codeTimer = null;
    this.publish({ issued: null });
  };
  refresh = async () => {
    if (!this.canRead() || this.state.busy) return null;
    this.invalidate(); const controller = new AbortController(); this.request = controller; const token = this.generation;
    this.publish({ loading: true, error: null, issued: null });
    try {
      const incoming = encounterSnapshotSchema.parse(await this.requester(undefined, controller.signal));
      if (!this.canRead() || token !== this.generation || controller.signal.aborted) return null;
      const data = { ...incoming, result: null };
      this.publish({ data, loading: false, message: this.pending ? "Inventory refreshed. Retry the original submission to confirm its result." : "Inventory is up to date.",
        unconfirmed: this.pending !== null, canRetry: this.pending !== null }); return data;
    } catch (error) {
      if (token !== this.generation || controller.signal.aborted || !this.active) return null;
      if (error instanceof EncounterRequestError && error.kind === "account") { this.pending = null; this.publish({ data: null, issued: null, canRetry: false }); }
      this.publish({ loading: false, error: error instanceof EncounterRequestError ? error.message : "Your encounters could not load. Try again." }); return null;
    }
  };
  act = async (input: EncounterInput): Promise<EncounterSnapshot | null> => {
    if (!this.canRead() || this.state.busy) return null;
    const candidate = encounterCommandSchema.safeParse({ ...input, requestId: this.pending?.command.requestId ?? this.makeId() });
    if (!candidate.success) { this.publish({ error: "Check the encounter details and try again." }); return null; }
    const { requestId: _id, ...normalised } = candidate.data, signature = JSON.stringify(normalised);
    if (this.pending && this.pending.signature !== signature) {
      this.publish({ error: "The previous result is still unconfirmed. Retry that submission or refresh inventory before starting another." }); return null;
    }
    const command = this.pending?.command ?? candidate.data;
    this.pending = { command, signature };
    this.invalidate(); const controller = new AbortController(); this.request = controller; const token = this.generation;
    this.publish({ loading: false, busy: command.action, error: null, message: "", issued: null, acknowledgedItemId: null, canRetry: false });
    try {
      const incoming = encounterSnapshotSchema.parse(await this.requester(command, controller.signal));
      if (!this.canRead() || token !== this.generation || controller.signal.aborted) return null;
      const result = incoming.result;
      if (!result || result.action !== command.action) throw new EncounterRequestError("unavailable", true);
      if (!result.error) {
        const valid = command.action === "claim" ? result.sessionId === command.sessionId && incoming.inventory.some(item => item.id === result.itemId && item.sessionId === command.sessionId)
          : command.action === "start" ? !!result.sessionId && (result.replayed || incoming.sessions.some(session => session.id === result.sessionId && session.encounterId === command.encounterId))
            : command.action === "issue" || command.action === "cancel" ? result.sessionId === command.sessionId
              : command.action === "prepareRedemption" ? result.itemId === command.itemId
                : command.action === "redeem" ? !!result.itemId : true;
        if (!valid) throw new EncounterRequestError("unavailable", true);
      }
      this.pending = null;
      const issued = !result.error && result.code && result.codeExpiresAt && (command.action === "issue" || command.action === "prepareRedemption")
        ? { code: result.code, expiresAt: result.codeExpiresAt, action: command.action } : null;
      const data = { ...incoming, result: { ...result, code: null } };
      const claimed = !result.error && command.action === "claim" && result.itemId && data.inventory.some(item => item.id === result.itemId) ? result.itemId : null;
      const message = result.error ? "No new item was confirmed." : issued ? "Code ready. Share it only for this confirmation."
        : result.replayed && (command.action === "issue" || command.action === "prepareRedemption") ? "This code was issued previously. Generate a replacement if you did not receive it."
          : command.action === "claim" ? result.replayed ? "This encounter was already confirmed. Your item is in inventory." : "Encounter confirmed. Your item is in inventory."
            : command.action === "redeem" ? "Redemption confirmed by the venue." : command.action === "start" ? result.replayed ? "This start was already processed. Check your current encounters below." : "Encounter started. Ask staff to confirm your visit reference."
              : command.action === "cancel" ? "Encounter cancelled." : "Encounter change saved.";
      this.publish({ data, busy: null, error: result.error?.message ?? null, message, issued, unconfirmed: false, canRetry: false, acknowledgedItemId: claimed });
      if (issued) {
        const duration = Math.max(0, Math.min(120000, Date.parse(issued.expiresAt) - Date.parse(incoming.serverTime)));
        this.codeTimer = setTimeout(() => { this.codeTimer = null; this.publish({ issued: null, message: "That confirmation code has expired. Generate a replacement when ready." }); }, duration);
      }
      return result.error ? null : data;
    } catch (error) {
      if (token !== this.generation || controller.signal.aborted || !this.active) return null;
      const known = error instanceof EncounterRequestError && !error.uncertain;
      if (known) this.pending = null;
      this.publish({ busy: null, error: error instanceof EncounterRequestError ? error.message : "The result could not be confirmed. Retry the same submission or refresh inventory.",
        message: known ? "No new result was confirmed." : "The result is unconfirmed. Retrying uses the same submission reference.", canRetry: !known, unconfirmed: !known,
        ...(error instanceof EncounterRequestError && error.kind === "account" ? { data: null, issued: null } : {}) }); return null;
    }
  };
  retry = async () => {
    if (!this.pending || !this.canRead() || this.state.busy) return null;
    const { requestId: _id, ...input } = this.pending.command;
    return this.act(input as EncounterInput);
  };
}

export function useEncounterAccount(config: Configuration) {
  const ref = useRef<EncounterClient | null>(null);
  if (!ref.current) ref.current = new EncounterClient();
  const client = ref.current, state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot);
  useEffect(() => {
    client.activate(); const visibility = () => client.setVisible(document.visibilityState !== "hidden"); visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); client.deactivate(); };
  }, [client]);
  useEffect(() => { client.configure(config); }, [client, config.accountKey, config.signedIn, config.enabled, config.scope]);
  return { ...state, act: client.act, retry: client.retry, refresh: client.refresh, dismissCode: client.dismissCode };
}
export function useEncounterClock(serverTime?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const at = performance.now(), server = serverTime ? Date.parse(serverTime) : Date.now();
    let interval: ReturnType<typeof setInterval> | undefined;
    const update = () => setNow(server + performance.now() - at);
    const visibility = () => { clearInterval(interval); update(); if (document.visibilityState !== "hidden") interval = setInterval(update, 1000); };
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", visibility); };
  }, [serverTime]);
  return now;
}
export function encounterTimeRemaining(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return seconds > 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
