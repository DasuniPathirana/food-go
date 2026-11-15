"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, Users } from "lucide-react";
import { gameProfileSchema, type GameProfile } from "@/lib/game-profile";

export function GameProgress() {
  const [profile, setProfile] = useState<GameProfile | null>(null);
  const [status, setStatus] = useState("Loading your progress…");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const update = () => setRefresh(n => n + 1);
    window.addEventListener("food-go:progress", update);
    return () => window.removeEventListener("food-go:progress", update);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/game", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(13000)]) })
      .then(async response => { const parsed = gameProfileSchema.safeParse(await response.json()); if (!response.ok || !parsed.success) throw new Error(); if (!controller.signal.aborted) { setProfile(parsed.data); setStatus(""); } })
      .catch(() => { if (!controller.signal.aborted) setStatus("Your progress could not load. Try again shortly."); });
    return () => controller.abort();
  }, [refresh]);
  return <section className="profile-card" aria-label="Explorer progression"><h2><Sparkles size={22} />Your adventure</h2>{profile ? <><p><strong>Level {profile.level} · {profile.xp} XP</strong></p><progress aria-label="Progress to next level" value={profile.xp % 250} max={250} /><p>{profile.nextLevelXp - profile.xp} XP to your next level</p><p><Users size={17} /> {profile.reachCount} unique signed-in post views</p><p>Verified places +50, verified dishes +100 and the three-place challenge +100. Approved stories, replies, likes received and unique signed-in reach also earn XP.</p></> : <p role="status">{status}</p>}<button type="button" className="secondary-button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} />Refresh progress</button></section>;
}
