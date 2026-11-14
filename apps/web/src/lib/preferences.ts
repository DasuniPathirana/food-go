"use client";
import { useEffect, useState } from "react";
import type { CatalogueMode } from "./catalogue-contracts";

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

export function useSavedVenues(mode: CatalogueMode = "demo") {
  return useSavedItems(mode === "demo" ? "food-go:demo-saved:v1" : "food-go:supabase-saved-venues:v1");
}

export function useSavedDishes(mode: CatalogueMode = "demo") {
  return useSavedItems(`food-go:${mode}-saved-dishes:v1`);
}
