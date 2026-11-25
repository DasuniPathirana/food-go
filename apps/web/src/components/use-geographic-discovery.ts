"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { GeographicDiscoverySession, type GeographicDiscoveryInput } from "@/lib/geographic-discovery";

/** Caller must pass the original device fix/timestamp and a stable accountKey
 * (or remount on identity changes). Manual previewPoint is never uploaded.
 */
export function useGeographicDiscovery(input: GeographicDiscoveryInput) {
  const ref = useRef<GeographicDiscoverySession | null>(null);
  if (!ref.current) ref.current = new GeographicDiscoverySession();
  const session = ref.current;
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  useEffect(() => {
    session.activate();
    const visibility = () => session.setVisible(document.visibilityState !== "hidden");
    const connectivity = () => session.setOnline(navigator.onLine);
    visibility(); connectivity();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("online", connectivity); window.addEventListener("offline", connectivity);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("online", connectivity); window.removeEventListener("offline", connectivity);
      session.deactivate();
    };
  }, [session]);
  useEffect(() => { session.configure(input); }, [session, state.enabled, input.signedIn, input.available, input.accountKey, input.mode, input.liveReady,
    input.fix?.longitude, input.fix?.latitude, input.fix?.accuracy, input.fix?.timestamp, input.previewPoint?.longitude, input.previewPoint?.latitude]);
  return { ...state, toggle: session.toggle, setRecording: session.setRecording, clearSaved: session.clearSaved, clearPreview: session.clearPreview, retry: session.retry };
}
