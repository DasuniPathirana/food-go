"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { journeySchema, type Journey } from "@/lib/journey";
import { usePathname } from "next/navigation";

const JourneyContext = createContext<{
  signedIn: boolean;
  data: Journey | null; loading: boolean; error: string; refresh: () => Promise<void>;
  save: (kind: "venue" | "dish", id: string) => Promise<void>; saving: boolean;
} | null>(null);
export function JourneyProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [data, setData] = useState<Journey | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => {
    if (!signedIn) { setData(null); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/journey", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(12000) });
      const parsed = journeySchema.safeParse(await response.json());
      if (!response.ok || !parsed.success) throw new Error();
      setData(parsed.data); setError("");
    } catch { setError("Your collection could not load. Please try again."); }
    finally { setLoading(false); }
  }, [signedIn]);
  useEffect(() => { void refresh(); }, [refresh, pathname]);
  useEffect(() => {
    const update = () => { void refresh(); };
    window.addEventListener("food-go:progress", update);
    window.addEventListener("focus", update);
    return () => { window.removeEventListener("food-go:progress", update); window.removeEventListener("focus", update); };
  }, [refresh]);
  async function save(kind: "venue" | "dish", id: string) {
    if (!signedIn) { window.location.assign("/auth/sign-in"); return; }
    if (!data) { setError("Your collection is still loading. Please try again shortly."); return; }
    if (saving) return;
    setSaving(true);
    try {
      const saved = !(kind === "venue" ? data.savedVenues : data.savedDishes).includes(id);
      const response = await fetch("/api/journey", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", kind, id, saved }) });
      const body = await response.json(), parsed = journeySchema.safeParse(body);
      if (!response.ok || !parsed.success) throw new Error(typeof body.error === "string" ? body.error : "Your change could not be saved.");
      setData(parsed.data); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Your change could not be saved."); }
    finally { setSaving(false); }
  }
  return <JourneyContext.Provider value={{ signedIn, data, loading, error, refresh, save, saving }}>
    {error && <div className="inline-notice" role="alert">{error}<button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {children}
  </JourneyContext.Provider>;
}
export function useJourney() { return useContext(JourneyContext); }
