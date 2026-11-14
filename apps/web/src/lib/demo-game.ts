"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createDemoGame, DEMO_GAME_KEY, demoProgress, parseDemoGame, reduceDemoGame, type DemoGameAction, type DemoGameState, type DemoSocialEvent } from "@food-go/domain/demo-game";
import { PREVIEW_FEED_KEY } from "./feed-preview";
export * from "@food-go/domain/demo-game";

type Snapshot = { state: DemoGameState; ready: boolean; notice: string; persistent: boolean };
const initial: Snapshot = { state: createDemoGame(), ready: false, notice: "", persistent: true };
let snapshot = initial;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function hydrate() {
  if (snapshot.ready) return;
  try { snapshot = { ...initial, ready: true, state: parseDemoGame(JSON.parse(localStorage.getItem(DEMO_GAME_KEY) || "null")) }; }
  catch { snapshot = { ...initial, ready: true, persistent: false }; }
  emit();
}
export function dispatchDemoGame(action: DemoGameAction) {
  hydrate();
  const before = snapshot.state;
  const state = reduceDemoGame(before, action);
  const gained = demoProgress(state).xp - demoProgress(before).xp;
  let notice = gained > 0 ? `+${gained} example XP. Your demo passport is up to date.` : "";
  if (action.type === "route") notice = "Example route started. Use the walking controls, then mark your arrival below the map.";
  if (action.type === "arrive") notice = "You have arrived in the illustration. Continue with the simulated QR check-in.";
  if (action.type === "name") notice = "Your demo explorer name has been saved.";
  if (action.type === "save-venue" || action.type === "save-dish") notice = "Your demo collection has been updated.";
  if (action.type === "start-quest") notice = "Food trail started. Your next example stop is ready on Explore.";
  if (action.type === "leave-quest") notice = "Food trail removed from your plan. Collected progress stays in your passport.";
  if (action.type === "cancel-route") notice = "Example route cancelled.";
  if (action.type === "social" && !gained) notice = action.event.kind === "remove-post" ? "Story removed. Its example publishing XP has been removed too." : "Demo feed updated. Repeat actions and daily caps do not award extra XP.";
  if (action.type === "reset") notice = "Demo reset. Your next adventure starts here.";
  let persistent = true;
  try { localStorage.setItem(DEMO_GAME_KEY, JSON.stringify(state)); } catch { persistent = false; }
  snapshot = { state, ready: true, notice, persistent };
  emit();
  if (noticeTimer) clearTimeout(noticeTimer);
  if (notice) noticeTimer = setTimeout(() => {
    snapshot = { ...snapshot, notice: "" };
    emit();
  }, 5000);
  if (action.type === "reset") {
    try { localStorage.removeItem(PREVIEW_FEED_KEY); } catch { /* The in-memory sample feed still resets. */ }
    window.dispatchEvent(new CustomEvent("food-go:demo-reset"));
  }
  return state;
}
/** One local namespace across all demo screens. No account, GPS or server writes. */
export function useDemoGame() {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => initial);
  useEffect(() => {
    hydrate();
    const social = (event: Event) => {
      const detail = (event as CustomEvent<DemoSocialEvent>).detail;
      if (detail && ["post", "like", "comment", "share", "remove-post"].includes(detail.kind)) dispatchDemoGame({ type: "social", event: detail });
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== DEMO_GAME_KEY) return;
      try { snapshot = { ...snapshot, state: parseDemoGame(JSON.parse(event.newValue || "null")), notice: "Demo progress updated from another tab." }; emit(); } catch { /* Ignore malformed external events. */ }
    };
    window.addEventListener("food-go:demo-social", social);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("food-go:demo-social", social); window.removeEventListener("storage", storage); };
  }, []);
  return { ...value, dispatch: dispatchDemoGame, progress: demoProgress(value.state) };
}
