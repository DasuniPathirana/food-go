"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import type { ExplorerLocationFix } from "@/lib/explorer-location-motion";
import { requestVenueEncounters } from "@/lib/encounter-client";
import { encounterLandmarkSignals, nearbyEncounterCandidates } from "@/lib/encounter-landmarks";
import { EncounterLandmarkLoader } from "@/lib/encounter-landmark-loader";

/** Foreground cosmetic hints. Send bounded public venue IDs, never GPS fixes. */
export function useEncounterLandmarks({ enabled, mode, fix, venues }: {
  enabled: boolean; mode: "manual" | "live"; fix: ExplorerLocationFix | null; venues: readonly CatalogueVenue[];
}) {
  const [now, setNow] = useState(() => Date.now()), [visible, setVisible] = useState(true);
  const ref = useRef<EncounterLandmarkLoader | null>(null);
  if (!ref.current) ref.current = new EncounterLandmarkLoader({ request: requestVenueEncounters });
  const loader = ref.current, records = useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getServerSnapshot);
  const live = enabled && mode === "live" && visible;
  useEffect(() => {
    loader.activate();
    const visibility = () => {
      const shown = document.visibilityState !== "hidden"; setVisible(shown); setNow(Date.now());
      if (!shown) loader.configure(false, [], true);
    };
    visibility(); document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); loader.deactivate(); };
  }, [loader]);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [live]);
  const candidates = live ? nearbyEncounterCandidates(venues, fix, Date.now()) : [];
  const key = candidates.map(item => item.venueId).sort().join(",");
  useEffect(() => {
    // configure is idempotent for the same key: a 5s expiry tick cannot abort a
    // valid public response that is still within its 12s transport deadline.
    loader.configure(live && document.visibilityState !== "hidden", key ? key.split(",") : []);
  }, [loader, live, key, now]);
  return useMemo(() => live ? encounterLandmarkSignals(records.filter(record => key.split(",").includes(record.venueId)), fix, Date.now())
    : { signals: {}, nearby: [] }, [live, key, records, now, fix]);
}
