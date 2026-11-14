"use client";
import { useEffect, useState } from "react";
import type { CatalogueState } from "./catalogue-contracts";

/** Resolve saved public IDs independently of the discovery page's first 50 rows. */
export function useSavedCatalogue(source: CatalogueState, ids: string[], kind: "venue" | "dish") {
  const [result, setResult] = useState<CatalogueState>({ ...source, venues: [], hasMore: false });
  const [loading, setLoading] = useState(false);
  const serialized = ids.join(",");
  useEffect(() => {
    const saved = serialized ? serialized.split(",") : [];
    if (source.mode === "demo") {
      setResult({ ...source, hasMore: false, venues: source.venues.filter((venue) => kind === "venue" ? saved.includes(venue.id) : venue.dishes.some((dish) => saved.includes(dish.id))) });
      return;
    }
    if (!saved.length) {
      setResult({ mode: source.mode, status: source.status, venues: [], hasMore: false }); setLoading(false); return;
    }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    const batches = [saved.slice(0, 50), saved.slice(50, 100)].filter((batch) => batch.length);
    Promise.all(batches.map(async (batch) => {
      const params = new URLSearchParams({ kind, ids: batch.join(",") });
      const response = await fetch(`/api/collections?${params}`, { cache: "no-store", signal: controller.signal });
      const body: CatalogueState = await response.json();
      if (!response.ok || body.status !== "ready" || body.mode !== "supabase" || !Array.isArray(body.venues)) throw new Error("unavailable");
      return body;
    })).then((results) => {
      if (!active) return;
      const venues = [...new Map(results.flatMap((item) => item.venues).map((venue) => [venue.id, venue])).values()];
      // A venue may hold saved dishes from both request batches. Preserve both sets.
      venues.forEach((venue) => { venue.dishes = [...new Map(results.flatMap((item) => item.venues).filter((item) => item.id === venue.id).flatMap((item) => item.dishes).map((dish) => [dish.id, dish])).values()]; });
      setResult({ mode: "supabase", status: "ready", venues, hasMore: false });
    }).catch(() => {
      if (active) setResult({ mode: "supabase", status: "unavailable", venues: [], hasMore: false });
    }).finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [source, serialized, kind]);
  return { catalogue: result, loading };
}
