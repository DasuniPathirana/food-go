"use client";
import { useEffect, useState } from "react";

/** Store only non-sensitive demo preferences. No tokens, profiles or location history. */
export function useSavedVenues() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem("food-go:demo-saved:v1") || "[]",
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
  }, []);
  function toggle(id: string) {
    setSaved((current) => {
      const next = current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id].slice(0, 100);
      try {
        localStorage.setItem("food-go:demo-saved:v1", JSON.stringify(next));
      } catch {
        /* Session state remains available. */
      }
      return next;
    });
  }
  return { saved, toggle };
}
