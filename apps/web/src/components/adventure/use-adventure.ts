"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adventureStateSchema, type AdventureAction, type AdventureState } from "@/lib/adventure-contracts";

type ActionInput<T = AdventureAction> = T extends { requestId: string } ? Omit<T, "requestId"> : never;
export function useAdventure(signedIn: boolean) {
  const [data, setData] = useState<AdventureState | null>(null);
  const [loading, setLoading] = useState(signedIn);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [needsAccount, setNeedsAccount] = useState(!signedIn);
  const active = useRef(true), pending = useRef(false);
  const request = useRef<AbortController | null>(null);
  const retry = useRef<{ key: string; requestId: string } | null>(null);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true);
    try {
      // A writable session check can recover a browser session refreshed after
      // the server render. It never replaces the adventure API's auth checks.
      if (!signedIn) {
        const session = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]) });
        const account = await session.json();
        if (!session.ok || !account.user?.id) { if (active.current && !controller.signal.aborted) { setNeedsAccount(true); setData(null); } return; }
        if (active.current && !controller.signal.aborted) setNeedsAccount(false);
      }
      const response = await fetch("/api/adventure", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const body = await response.json();
      if (response.status === 401) { if (active.current) { setNeedsAccount(true); setData(null); } return; }
      const parsed = adventureStateSchema.safeParse(body);
      if (!response.ok || !parsed.success) throw new Error(typeof body.error === "string" ? body.error : "Your adventure could not load. Please try again.");
      if (!controller.signal.aborted && active.current) { setData(parsed.data); setNeedsAccount(false); setError(""); }
    } catch (failure) {
      if (!controller.signal.aborted && active.current) setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Your adventure could not load. Check your connection and try again.");
    } finally { if (!controller.signal.aborted && active.current) setLoading(false); }
  }, [signedIn]);
  useEffect(() => {
    active.current = true; void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { active.current = false; request.current?.abort(); window.removeEventListener("focus", focus); };
  }, [refresh]);
  async function act(input: ActionInput) {
    if (pending.current || needsAccount) return null;
    pending.current = true; request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const key = JSON.stringify(input);
    const requestId = retry.current?.key === key ? retry.current.requestId : crypto.randomUUID();
    retry.current = { key, requestId };
    setBusy(input.action); setError(""); setLoading(false);
    try {
      const response = await fetch("/api/adventure", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, requestId }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500) retry.current = null;
        if (response.status === 401 && active.current) setNeedsAccount(true);
        throw new Error(typeof body.error === "string" ? body.error : "That change could not be saved. Refresh your adventure before trying again.");
      }
      const parsed = adventureStateSchema.safeParse(body.state);
      if (!parsed.success) throw new Error("The server response could not be read. Refresh your adventure to check your change.");
      retry.current = null;
      if (active.current && !controller.signal.aborted) {
        setData(parsed.data); window.dispatchEvent(new Event("food-go:progress"));
      }
      return { state: parsed.data, code: typeof body.code === "string" ? body.code : undefined, expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined };
    } catch (failure) {
      if (active.current && !controller.signal.aborted) setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Your change could not be confirmed. Refresh to check your adventure before trying again.");
      return null;
    } finally { pending.current = false; if (active.current) setBusy(""); }
  }
  return { data, loading, error, busy, needsAccount, refresh, act };
}

/** Countdown presentation uses the returned server clock; rewards remain server-validated. */
export function useAdventureClock(serverNow?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const start = performance.now(), server = serverNow ? Date.parse(serverNow) : Date.now();
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => setNow(server + performance.now() - start);
    const visibility = () => {
      clearInterval(timer); timer = undefined; update();
      if (document.visibilityState !== "hidden") timer = setInterval(update, 1000);
    };
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [serverNow]);
  return now;
}
export function timeRemaining(readyAt: string | null, now: number) {
  const seconds = Math.max(0, Math.ceil(((readyAt ? Date.parse(readyAt) : now) - now) / 1000));
  return seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`
    : seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}
