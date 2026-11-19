"use client";
import { useEffect, useState } from "react";
import { Compass, Gift, MapPinned, Trees, X } from "lucide-react";
import styles from "./demo-world-tour.module.css";

export type DemoStop = "city" | "park" | "treasure";

/** A guided, explicitly fictional showcase, isolated from real visits/rewards. */
export function DemoWorldTour({ onSelect }: { onSelect: (stop: DemoStop) => void }) {
  const [enabled,setEnabled]=useState(false);
  const [open,setOpen]=useState(false);
  useEffect(()=>setEnabled(new URLSearchParams(window.location.search).get("world-demo")==="1"),[]);
  if (!enabled) return null;
  return <div className={styles.dock} aria-label="Food Go demonstration world">
    <button type="button" className={styles.trigger} aria-label={open?"Close demo tour":"Open demo tour"}
      aria-expanded={open} onClick={()=>setOpen(!open)}><Compass size={17}/><span>Demo tour</span></button>
    {open && <div className={styles.menu} role="group" aria-label="Client demo destinations">
      <div className={styles.heading}>
        <div><strong>Explore Food Go</strong><small>Visual demo · no real rewards</small></div>
        <button type="button" aria-label="Close demo destinations" onClick={()=>setOpen(false)}><X size={17}/></button>
      </div>
      <button type="button" onClick={()=>{onSelect("city");setOpen(false);}}>
        <MapPinned size={18}/><span><strong>City explorer</strong><small>Buildings and urban scenery</small></span>
      </button>
      <button type="button" onClick={()=>{onSelect("park");setOpen(false);}}>
        <Trees size={18}/><span><strong>Park discovery</strong><small>3D nature and hidden areas</small></span>
      </button>
      <button type="button" onClick={()=>{onSelect("treasure");setOpen(false);}}>
        <Gift size={18}/><span><strong>Treasure encounter</strong><small>Inspect a non-redeemable chest</small></span>
      </button>
    </div>}
  </div>;
}
