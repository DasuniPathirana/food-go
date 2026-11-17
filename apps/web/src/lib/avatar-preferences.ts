"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AVATAR_PREFERENCES_KEY, avatarPreferencesSchema, createAvatarPreferences, isAvatarId, type AvatarId, type AvatarPreferences } from "@food-go/domain/avatar";
export * from "@food-go/domain/avatar";

type Snapshot = { preferences: AvatarPreferences; ready: boolean; persistent: boolean };
const freshBrowserPreferences = (): AvatarPreferences => ({ ...createAvatarPreferences(), avatarId: "foodie" });
const initial: Snapshot = { preferences: freshBrowserPreferences(), ready: false, persistent: true };
let snapshot = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function readBrowserAvatarPreferences(value: string | null): AvatarPreferences {
  if (!value || value.length > 512) return freshBrowserPreferences();
  try {
    const parsed = avatarPreferencesSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : freshBrowserPreferences();
  } catch { return freshBrowserPreferences(); }
}
function hydrate() {
  if (snapshot.ready || typeof window === "undefined") return;
  try { snapshot = { preferences: readBrowserAvatarPreferences(window.localStorage.getItem(AVATAR_PREFERENCES_KEY)), ready: true, persistent: true }; }
  catch { snapshot = { ...initial, ready: true, persistent: false }; }
  emit();
}
function storage(event: StorageEvent) {
  if (event.key !== AVATAR_PREFERENCES_KEY && event.key !== null) return;
  try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
  catch { return; }
  snapshot = { preferences: readBrowserAvatarPreferences(event.key === null ? null : event.newValue), ready: true, persistent: true };
  emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", storage);
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener("storage", storage); };
}
function save(preferences: AvatarPreferences, reset = false) {
  hydrate();
  let persistent = true;
  try {
    if (reset) window.localStorage.removeItem(AVATAR_PREFERENCES_KEY);
    else window.localStorage.setItem(AVATAR_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch { persistent = false; }
  snapshot = { preferences, ready: true, persistent };
  emit();
}
function chooseAvatar(id: AvatarId) {
  if (!isAvatarId(id)) return;
  hydrate();
  save({ ...snapshot.preferences, avatarId: id });
}
function setIdleMotion(enabled: boolean) {
  if (typeof enabled !== "boolean") return;
  hydrate();
  save({ ...snapshot.preferences, idleMotion: enabled });
}
function resetAvatar() { save(freshBrowserPreferences(), true); }

/** Shared cosmetic preference only. Renderers must also respect reduced motion. */
export function useAvatarPreferences() {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => initial);
  useEffect(hydrate, []);
  return { ...current, chooseAvatar, setIdleMotion, resetAvatar };
}
