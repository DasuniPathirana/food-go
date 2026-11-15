"use client";
import { useEffect, useState } from "react";
import type { CatalogueMode } from "./catalogue-contracts";
import { useJourney } from "@/components/journey-provider";

/** Store only non-sensitive demo preferences. No tokens, profiles or location history. */
function useSavedItems(key: string) {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    setSaved([]);
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(key) || "[]",
      );
      if (Array.isArray(value))
        setSaved(
          value
            .filter(
              (id): id is string => typeof id === "string" && id.length < 80,
            )
            .slice(0, 100),
        );
    } catch {
      /* Browsing works with unavailable or malformed local storage. */
    }
  }, [key]);
  function toggle(id: string) {
    setSaved((current) => {
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id].slice(0, 100);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Session state remains available. */
      }
      return next;
    });
  }
  return { saved, toggle };
}

export function useSavedVenues(mode: CatalogueMode = "supabase") {
  const local = useSavedItems("food-go:demo-saved:v1");
  const journey = useJourney();
  return mode === "demo" ? local : { saved: journey?.data?.savedVenues ?? [], toggle: (id: string) => { void journey?.save("venue", id); } };
}

export function useSavedDishes(mode: CatalogueMode = "supabase") {
  const local = useSavedItems("food-go:demo-saved-dishes:v1");
  const journey = useJourney();
  return mode === "demo" ? local : { saved: journey?.data?.savedDishes ?? [], toggle: (id: string) => { void journey?.save("dish", id); } };
}
