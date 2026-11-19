"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Sparkles, X } from "lucide-react";
import styles from "./demo-treasure-encounter.module.css";

/**
 * Visual-only showcase, separate from server-owned restaurant encounter claims.
 * Never calls inventory, rewards, GPS or Supabase.
 */
export function DemoTreasureEncounter({ activationToken = 0 }: { activationToken?: number }) {
  const [enabled, setEnabled] = useState(false);
  const [stage, setStage] = useState<"closed" | "opening" | "revealed">("closed");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get("world-demo") === "1");
  }, []);
  useEffect(() => {
    if (stage !== "closed") panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [stage]);
  useEffect(() => { if (activationToken > 0) setStage("opening"); }, [activationToken]);
  if (!enabled) return null;
  return <section className={styles.demo} aria-label="Demonstration treasure encounter">
    {stage === "closed" ? <button type="button" className={styles.dock} onClick={() => setStage("opening")}
      aria-label="Inspect the non-redeemable Food Go treasure demonstration"><Gift size={18}/><span>Discover treasure</span><small>Demo</small></button> :
      <div ref={panel} className={styles.panel} role="region" aria-label="Food Go demonstration chest">
        <div className={styles.heading}><span><Sparkles size={16}/> Hidden discovery</span>
          <button type="button" aria-label="Close demo treasure" onClick={() => setStage("closed")}><X size={18}/></button>
        </div>
        <div className={styles.illustration} data-open={stage === "revealed"} aria-hidden="true">
          <span className={styles.halo}/>
          <span className={styles.chestLid}/>
          <span className={styles.chestBody}><span className={styles.lock}>✦</span></span>
          {stage === "revealed" && <span className={styles.reward}><Sparkles size={25}/></span>}
        </div>
        <strong>{stage === "revealed" ? "A secret discovery!" : "There's something nearby"}</strong>
        <p>{stage === "revealed" ? "You've previewed the opening animation. Real treasures require verified restaurant encounters." :
          "Open this preview chest to see Food Go's discovery animation."}</p>
        {stage === "opening" && <button type="button" className={styles.action} onClick={() => setStage("revealed")}>Open chest</button>}
        {stage === "revealed" && <button type="button" className={styles.action} onClick={() => setStage("closed")}>Return to Explore</button>}
        <small>Visual demonstration only · No inventory, offers or XP awarded</small>
      </div>}
  </section>;
}
