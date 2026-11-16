"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Sparkles, Users } from "lucide-react";
import { gameProfileSchema, type GameProfile } from "@/lib/game-profile";
import { playerProgressDisplay } from "@/lib/player-progress-display";
import Link from "next/link";

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
  const display = profile ? playerProgressDisplay(profile) : null;
  return <section className="profile-card" aria-label="Explorer progression"><h2><Sparkles size={22} />Your adventure</h2>{profile && display ? <><p><strong>Level {profile.level} of 250 · {profile.xp.toLocaleString("en-AU")} XP</strong></p><progress aria-label="Progress to next level" value={display.value} max={display.maximum} /><p>{display.text}</p>{display.missing.length > 0 && <p>Next milestones: {display.missing.join(", ")}.</p>}<p><Users size={17} /> {profile.reachCount} unique signed-in post views</p><p>Verified discoveries and genuine quests build your profile. After level 100, higher XP targets and varied achievements unlock the next levels.</p><Link href="/quests">View your quests and milestones</Link></> : <p role="status">{status}</p>}<button type="button" className="secondary-button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} />Refresh progress</button></section>;
}
