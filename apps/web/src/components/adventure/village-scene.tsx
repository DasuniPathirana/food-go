"use client";

import { useEffect, useId, useState } from "react";
import { Maximize, Minus, Pause, Play, Plus } from "lucide-react";
import type { OutbackPlot } from "@/lib/adventure-contracts";
import { cropRules } from "@/lib/adventure-rules";
import styles from "./adventure.module.css";

function Tree({ x, y, small = false, variant = 0 }: { x: number; y: number; small?: boolean; variant?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${small ? 0.65 : 1})`}>
    <ellipse cx="9" cy="3" rx="22" ry="8" fill="#355b3825"/>
    <path d={variant % 2 ? "M-3 1-5-45H3L5 0Z" : "M-4 0V-40H4V1Z"} fill={variant % 2 ? "#c2b489" : "#967047"}/>
    <path d="M0-18-12-34M1-27 12-43" stroke={variant % 2 ? "#c2b489" : "#967047"} strokeWidth="4"/>
    <g className={styles.treeCanopy}>
      {variant % 3 === 1 ? <><ellipse cx="-10" cy="-43" rx="18" ry="14" fill="#428b67"/><ellipse cx="11" cy="-58" rx="21" ry="17" fill="#5aab79"/><ellipse cx="2" cy="-65" rx="14" ry="9" fill="#87c787"/><path d="m-22-44 12 2m8-20 10-2m1 15 11-2" stroke="#b8df9a" strokeWidth="3" strokeLinecap="round"/></>
        : variant % 3 === 2 ? <><path d="M-21-29Q-31-44-14-55Q-24-73-3-78Q15-80 15-62Q36-48 19-32Z" fill="#397e4b"/><path d="M-21-36Q-27-49-11-55Q-22-73-3-78Q10-78 10-65Q26-48 9-41Z" fill="#6bae4b"/><path d="M-14-51Q-6-59 1-55M-6-71 0-73" fill="none" stroke="#a1d16c" strokeWidth="4" strokeLinecap="round"/></>
          : <><path d="M-25-34Q-31-58-8-61Q-2-80 16-62Q36-57 25-36Q12-24-7-29Z" fill="#298c50"/><path d="M-25-40Q-30-59-8-61Q-2-80 16-62Q21-48 5-40Z" fill="#52b858"/><ellipse cx="-10" cy="-56" rx="8" ry="6" fill="#8cd66a"/>{variant > 2 && <><circle cx="-16" cy="-42" r="3" fill="#edb54f"/><circle cx="9" cy="-57" r="3" fill="#f5ca67"/><circle cx="17" cy="-39" r="3" fill="#e7a24a"/></>}</>}
    </g><path d="m-12 3 3-5m8 6 3-5m11 4 3-4" stroke="#79a94e" strokeWidth="2" strokeLinecap="round"/>
  </g>;
}
function Barrel({x,y,blue=false}: {x:number;y:number;blue?:boolean}) {
  return <g transform={`translate(${x} ${y})`}><ellipse cy="4" rx="10" ry="4" fill="#45633d22"/><path d="M-8-13v15q8 6 16 0v-15Z" fill={blue ? "#68a3a9" : "#be8a4f"}/><ellipse cy="-13" rx="8" ry="4" fill={blue ? "#b2d6d0" : "#e6bb7c"}/><path d="M-8-8q8 5 16 0M-8-1q8 5 16 0" stroke={blue ? "#d1e7d8" : "#806b4b"} strokeWidth="2" fill="none"/></g>;
}
function GroundDetails({seed}: {seed:number}) {
  return <g><path d="m-42 12 3-6m0 6 5-3m14 15 2-6m0 6 4-3m42-24 3-6m0 6 4-2" stroke={seed%2 ? "#68a64c" : "#7aaf51"} strokeWidth="1.8" strokeLinecap="round"/>
    <g transform={`translate(${seed%2 ? -36 : 40} ${seed%2 ? -9 : 5})`}><path d="M0 2v-8m4 10v-5" stroke="#598f49" strokeWidth="1.5"/><circle cy="-7" r="3.3" fill={seed%3 ? "#fff4ce" : "#eaa0a3"}/><circle cy="-7" r="1.2" fill="#dcaa39"/><circle cx="4" cy="-2" r="2.5" fill="#fff5d4"/></g>
  </g>;
}
function Building({ plot, ready, now }: { plot: OutbackPlot; ready: boolean; now:number }) {
  if (plot.kind === "wild") return <><Tree x={-16+plot.cell%3*3} y={4} variant={plot.cell}/>{plot.cell%3 !== 1 && <Tree x={25} y={15} small variant={plot.cell+1}/>}<path d="m25-15 14-7 12 7-7 10-19-2Z" fill="#96a59a"/><path d="m25-15 14-7 4 14-18 1Z" fill="#d7ddd1"/><path d="m39-22 12 7-8 2Z" fill="#b5bfb1"/><GroundDetails seed={plot.cell}/></>;
  if (plot.kind === "cleared") return <><path d="m-33-2 34-17 34 17M-26 10 34-20M-7 20 47-7" fill="none" stroke="#b1884f" strokeWidth="3" strokeLinecap="round"/><path d="M-29-17v-13m-5 5h10" stroke="#d3ac6b" strokeWidth="3"/></>;
  if (plot.kind === "garden") {
    const duration = plot.crop ? cropRules[plot.crop].seconds*1000 : 1;
    const growth = ready ? 1 : plot.readyAt ? Math.max(0,Math.min(1,1-(Date.parse(plot.readyAt)-now)/duration)) : 0;
    return <>
    <path d="m-50 0 50-25L50 0 0 25Z" fill="#9a6944" stroke="#dfbb83" strokeWidth="4"/><path d="m-50 0v6L0 31 50 6V0L0 25Z" fill="#a87a4e"/>
    {[-20, 0, 20].map(offset => <path key={offset} d={`m${offset - 21} ${offset / 2 + 9} 42-21`} stroke="#694d34" strokeWidth="4"/>)}
    {plot.crop && [[-25,-1],[-7,-10],[11,-19],[-7,10],[11,1],[29,-8]].map(([x,y], index) => <g key={index} transform={`translate(${x} ${y}) scale(${0.3+growth*0.7})`}><g className={styles.crop}>
      <ellipse cy="2" rx="6" ry="2" fill="#604b3538"/><path d="M0 0v-19" stroke={plot.crop === "wheat" ? growth > .7 ? "#dba64b" : "#7d9f4e" : "#3d913e"} strokeWidth="3" strokeLinecap="round"/>
      {plot.crop === "wheat" ? <><path d="m0-9-6-6m6 1 6-6m-6 0-4-6" stroke={ready ? "#ffdc62" : "#9cc466"} strokeWidth="4" strokeLinecap="round"/></>
        : <><path d="M0-8Q-14-22-11-9Q-7-3 0-8M0-12Q12-26 12-13Q7-6 0-12" fill="#62b349"/>{growth > .65 && (plot.crop === "tomato" ? <><circle cx="-6" cy="-7" r="4" fill={ready ? "#f46a3e" : "#a3ba4c"}/><circle cx="5" cy="-13" r="4" fill={ready ? "#ff8850" : "#c3c758"}/></> : <path d="m-3-3 6 0-3 9Z" fill="#ff9e35"/>)}</>}
    </g></g>)}
    {!plot.crop && <><path d="m-7-4 8-5 8 5-8 5Z" fill="#d8a369"/><path d="m-42-6 9-4 8 4-8 4Z" fill="#e5c795"/></>}
    <path d="M-39-21v-17m-4 3 8-4" stroke="#ae8759" strokeWidth="2.5"/><path d="m-36-38 14 7-14 6Z" fill="#efe8b4"/><Barrel x={-44} y={13} blue/>
  </>;
  }
  if (plot.kind === "tank") return <>
    <ellipse cx="7" cy="7" rx="34" ry="13" fill="#34564229"/><path d="M-23-44v40q24 17 48 0v-40Z" fill="#81beca"/>
    <path d="M0-43v49q13 0 25-10v-40Z" fill="#5c9fae"/><ellipse cy="-44" rx="24" ry="11" fill="#b9e2e3"/>
    {[-33,-20,-8].map(y => <path key={y} d={`M-22 ${y}q22 15 46 0`} fill="none" stroke="#e2f3eb" strokeWidth="2" opacity=".65"/>)}
    <path d="m23-10 15 7v11" fill="none" stroke="#e9dca8" strokeWidth="5"/><path d="m34-5 8 4m-4-9v8" stroke="#817a4c" strokeWidth="2.5"/><circle cx="38" cy="9" r="3" fill="#63c7ee"/>
    <ellipse cy="-44" rx="18" ry="7" fill="none" stroke="#e1ece0" strokeWidth="2"/><path d="m-5-51 7-3 7 3-7 3Z" fill="#6c9b9e"/>
    <path d="M-11-32v27" stroke="#e4efd8" strokeWidth="5" strokeLinecap="round"/><path d="M-11-22v15" stroke="#4b9cbd" strokeWidth="3"/><path d="m-6-29 5 2m-5 7 5 2m-5 7 5 2" stroke="#eff6de" strokeWidth="1.5"/>
    <path d="m-28 5 14 7m-1-2 13 6m8-1 15-7" stroke="#708977" strokeWidth="4"/><Barrel x={-31} y={13}/><GroundDetails seed={plot.cell}/>
  </>;
  const bakery = plot.kind === "bakery", shed = plot.kind === "shed";
  if (shed) return <>
    <ellipse cx="5" cy="9" rx="45" ry="14" fill="#34564227"/>
    <path d="M-34-8v-33l21-21 24 23v52Z" fill="#d3ae70"/><path d="M11 13V-39l30-17V-4Z" fill="#a77f4e"/>
    <path d="m-39-41 24-27 35 19-24 26Z" fill="#7ba18b"/><path d="m-15-68 24 25 38-17-27-13Z" fill="#4c7e71"/>
    {[-29,-18,-7].map(x=><path key={x} d={`M${x}-34v29`} stroke="#b68c57" strokeWidth="1.5"/>)}
    <path d="M-27-24v25l29 15v-26Z" fill="#9c774b" stroke="#e5c78a" strokeWidth="2"/><path d="m-26-21 27 34m-27-9 27-14M-12-17v25" stroke="#dab77b" strokeWidth="2.5"/>
    <path d="m22-36 11-5v13l-11 6Z" fill="#769b94" stroke="#d8c48b" strokeWidth="2"/>
    <path d="m-33-48 14-15m-3 21 14-15m-4 22 14-15m16 0 12-5" stroke="#abc5a6" strokeWidth="1.3"/>
    <Barrel x={-39} y={8}/><path d="m25 12 12-6 11 6-11 6Z" fill="#ddbc72"/><path d="m25 12v-8l12-6 11 6v8l-11 6Z" fill="#d8b462"/><path d="m31 2 10 11m-3-15 9 11" stroke="#f0d68d" strokeWidth="2"/>
    <path d="m-47-7 5-17 6 3-5 17m-4-15 8 4m-10 2 8 4" fill="none" stroke="#7d7950" strokeWidth="2.5"/>
  </>;
  const height = shed ? 34 : bakery ? 46 : 52;
  return <>
    <ellipse cx="7" cy="8" rx="43" ry="16" fill="#34564227"/>
    <path d={`M-34-10v-${height}l34 17v${height}Z`} fill={shed ? "#c6a477" : "#fff1cc"}/>
    <path d={`M0 7v-${height}l35-18v${height}Z`} fill={shed ? "#a57f56" : "#e0c89b"}/>
    <path d={`m-40-${height + 12} 36-24 45 23-37 23Z`} fill={bakery ? "#f2814c" : shed ? "#618c80" : "#d96d49"}/>
    <path d={`m-40-${height + 12} 36-24 0 10-28 18Z`} fill={bakery ? "#ffb271" : shed ? "#94b4a0" : "#f49c63"}/>
    <path d={`M-23-${height+14}l30 15M-21-${height+22}l32 16M-12-${height+29}l30 15M-9-${height+8}l20-18M5-${height+2}l22-20`} fill="none" stroke={bakery ? "#f9b276" : "#ee9d68"} strokeWidth="1.4" opacity=".85"/>
    <path d={`M-17-${height - 8}v16l-9-5v-16Z`} fill="#7eb5ba" stroke="#fff8dd" strokeWidth="2"/>
    <path d="M9 2v-25l13-7v25Z" fill="#746843"/><path d="m-33-9 0 9 33 17 36-18v-9L0 8Z" fill="#d8bd82"/>
    {!shed && <><path d={`M18-${height + 18}v-22l8-4v23`} fill="#d6c398"/><path d={`m17-${height + 41} 8-4 5 3-8 4Z`} fill="#f6e9ce"/></>}
    {bakery ? <>
      <path d="M-29-28 1-13 32-29v10L1-3-29-18Z" fill="#fff2cb"/><path d="m-29-28 5 2v10l-5-2m10-7 5 2v10l-5-2m10-7 5 2v10l-5-2m10-5 5-2v10l-5 2m10-15 5-2v10l-5 2m10-15 5-2v10l-5 2" fill="#719c72"/>
      <path d="m-28-48 24 12v11l-24-12Z" fill="#fff3d1" stroke="#c39353" strokeWidth="1.2"/><text x="-24" y="-32" transform="rotate(27 -24 -32)" fontSize="6" fontWeight="900" fill="#98603c">BAKERY</text>
      <path d="m-26-7 19 10v7l-19-10Z" fill="#ae7a45"/>{[-22,-15].map(x=><g key={x}><ellipse cx={x} cy={x/2+5} rx="5" ry="3" transform={`rotate(27 ${x} ${x/2+5})`} fill="#efbf6d"/><path d={`m${x-1} ${x/2+3} 2 2`} stroke="#fff0bb" strokeWidth="1.2"/></g>)}
      <path d="m23-30 7-4v15l-7 4Z" fill="#e7d59f"/><path d="M24-29v12" stroke="#f9ecc6" strokeWidth="1.2"/>
      <Barrel x={39} y={8}/><path d="m-40 8 12 6 6-4-12-6Z" fill="#b79a5a"/><path d="m-38 7 7-6 6 3-7 7Z" fill="#e3bb75"/>
      {plot.status === "ready" && <g className={styles.chimneySmoke}><ellipse cx="24" cy={-height-57} rx="5" ry="8" fill="#fffdf399"/><ellipse cx="29" cy={-height-69} rx="8" ry="6" fill="#fffdf366"/></g>}
    </> : <>
      <path d="m-9-65 10-13 14 9v15L1-47-9-53Z" fill="#fff0cc"/><path d="m-12-65 12-16 19 10-5 4L1-74-7-61Z" fill="#b65a40"/><path d="m0-64 7 4v9l-7-4Z" fill="#89b7b6" stroke="#fff8dd" strokeWidth="1.3"/>
      <path d="m22-39 8-4v11l-8 4Z" fill="#92b9b4" stroke="#fff4d7" strokeWidth="2"/><path d="m24-43 4-2m-8 19 11-5" stroke="#8a996d" strokeWidth="2"/>
      <path d="m-28-5 30 15 31-15v8L2 19-28 4Z" fill="#b29c64"/><path d="m-30-22 31 15 33-16-31-15Z" fill="#81a184"/><path d="m-30-22 31 15v5l-31-15Z" fill="#6d8d73"/>
      <path d="M-24-17V5M3-4v23M28-17V4" stroke="#fff0c8" strokeWidth="3"/><path d="m-24-3 27 14 25-13" fill="none" stroke="#eddab0" strokeWidth="2"/>
      <path d="m-13 9 15 7 15-7v5L2 22-13 14Z" fill="#d8bd85"/><path d="m-13 15 15 7 15-8v4L2 27-13 20Z" fill="#dfc992"/>
      <path d="m-41-2 10 5-2 13-7-4Z" fill="#ca8b56"/><path d="M-36 1q-13-12-5-15 8-1 8 15m-2-1q-1-17 8-14 5 7-8 14" fill="#6b9d4b"/>
      <Barrel x={38} y={10} blue/>
    </>}
    {plot.level > 1 && <path d="m-44 6 8-4 8 4-8 4Z" fill="#f8d45d"/>}
  </>;
}

function ConstructionCrew() {
  return <g><path d="M-40 12v-53M38 9v-51M-40-24 38-25m-78 18 78-1m-78-16 78 16m-78 1 78-18" stroke="#c29e61" strokeWidth="2.4" fill="none"/><path d="M-45-39 0-17 43-39" fill="none" stroke="#efd391" strokeWidth="4"/>
    <g transform="translate(-33 14)"><ellipse cy="3" rx="10" ry="4" fill="#355c3b22"/><path d="M-5-4v-12h10v12Z" fill="#538b7a"/><path d="m-4-5-2 9m9-9 2 9" stroke="#716a46" strokeWidth="3"/><circle cy="-22" r="6" fill="#e0b882"/><path d="M-7-22q0-11 7-11t7 11Z" fill="#f4cc59"/><path d="M-10-22h20" stroke="#d5a845" strokeWidth="3" strokeLinecap="round"/><g className={styles.builderArm}><path d="m4-14 11-10" stroke="#dfb883" strokeWidth="4"/><path d="m13-22 5-11" stroke="#9b7d52" strokeWidth="2.5"/><path d="m14-34 9 4" stroke="#77988a" strokeWidth="4"/></g></g>
    <path d="m27 18 14-7 10 5-14 7Z" fill="#d7b478"/><path d="m27 18v-6l14-7 10 5v6l-14 7Z" fill="#e6c58a"/><path d="m31 13 14 7m-7-13 10 5" stroke="#aa8656" strokeWidth="1.5"/>
  </g>;
}

/** Original isometric artwork. Plot state and rewards always come from the server. */
export function VillageScene({ plots, selected, onSelect, region, now }: {
  plots: readonly OutbackPlot[]; selected: number | null; onSelect?: (cell: number) => void; region?: string; now: number;
}) {
  const id = useId().replaceAll(":", "");
  const [zoom,setZoom] = useState(1), [paused,setPaused] = useState(false);
  const [foreground,setForeground] = useState(false), [reduced,setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => { setForeground(document.visibilityState !== "hidden"); setReduced(media.matches); };
    sync(); media.addEventListener("change",sync); document.addEventListener("visibilitychange",sync);
    return () => { media.removeEventListener("change",sync); document.removeEventListener("visibilitychange",sync); };
  },[]);
  const width = 800/zoom, height = 500/zoom;
  const focusX = selected == null ? 390 : 390+(selected%4-Math.floor(selected/4))*72;
  const focusY = selected == null ? 245 : 125+(selected%4+Math.floor(selected/4))*36;
  const centreX = Math.max(width/2,Math.min(800-width/2,focusX)), centreY = Math.max(height/2,Math.min(500-height/2,focusY));
  const dry = region === "NT" || region === "WA" || region === "SA";
  const grass = dry ? "#b5cc6a" : "#91cf65", edge = dry ? "#ad8150" : "#698d43";
  const sorted = [...plots].sort((a,b) => (Math.floor(a.cell/4)+a.cell%4) - (Math.floor(b.cell/4)+b.cell%4));
  return <div className={styles.villageViewport} data-scene-motion={!paused && !reduced && foreground ? "on" : "off"}>
    <svg className={styles.village} viewBox={`${centreX-width/2} ${centreY-height/2} ${width} ${height}`} style={{aspectRatio:"8 / 5"}} role="group" aria-label={plots.length ? "Your Outback village. Select a plot to build, farm or upgrade." : "A green Australian homestead landscape"}>
    <defs><linearGradient id={`${id}sky`} x2="0" y2="1"><stop stopColor="#dff4f8"/><stop offset="1" stopColor="#f6f9d8"/></linearGradient>
      <filter id={`${id}blur`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter></defs>
    <g aria-hidden="true"><rect width="800" height="500" fill={`url(#${id}sky)`}/>
      <g className={styles.villageCloud}><path d="M74 77q-6-13 8-18 7-20 24-7 18-5 22 12 12 2 9 13Z" fill="#fffdf5b0"/><path d="M510 63q-6-13 10-18 3-17 20-10 13-9 24 7 17 0 18 15Z" fill="#fffdf588"/></g>
      <path d="M0 160Q120 65 240 115Q350 15 470 112Q650 25 800 118V500H0Z" fill="#c8dfad"/>
      <path d="M0 204Q115 117 272 174Q409 66 545 157Q695 96 800 190V500H0Z" fill="#b3d28c"/>
      <path d="M0 309Q190 187 395 310T800 244V500H0Z" fill="#d1e7a2"/>
      <path d="M684 150Q629 224 701 304T570 500" fill="none" stroke="#b4dd9a" strokeWidth="61"/>
      <path d="M684 150Q629 224 701 304T570 500" fill="none" stroke="#57c5e8" strokeWidth="40"/>
      <path className={styles.riverGlints} d="M684 150Q629 224 701 304T570 500" fill="none" stroke="#d4f7ed" strokeWidth="2" strokeDasharray="8 55 14 70" strokeLinecap="round"/>
      <ellipse cx="386" cy="376" rx="270" ry="57" fill="#355f3330" filter={`url(#${id}blur)`}/>
      <path d="M102 253 390 109 678 253v27L390 425 102 280Z" fill={edge}/><path d="m390 397 288-144v27L390 425Z" fill={dry ? "#986b43" : "#54763a"}/>
      <path d="M102 253 390 109 678 253 390 397Z" fill={grass}/>
      <Tree x={86} y={311} variant={1}/><Tree x={719} y={226} variant={2}/><Tree x={752} y={279} small variant={3}/><Tree x={171} y={407} small variant={4}/>
      <path d="m105 433 65-30 23 12-65 31Z" fill="#ebd69a"/><path d="m234 453 40-20m13 30 40-20m-126-11 10-5" stroke="#b8cd80" strokeWidth="3"/>
      {[0,1,2].map(i => <g key={i} transform={`translate(${510+i*34} ${86+i*9})`}><path d="M0 0v31m18-39v31M0 11l18-9m-18 20 18-9" stroke="#c79d60" strokeWidth="4" strokeLinecap="round"/></g>)}
    </g>
    {sorted.map(plot => {
      const x = 390+(plot.cell%4-Math.floor(plot.cell/4))*72, y = 145+(plot.cell%4+Math.floor(plot.cell/4))*36;
      const ready = !!plot.readyAt && Date.parse(plot.readyAt) <= now;
      const label = `Plot ${plot.cell+1}, ${plot.kind}, level ${plot.level}${plot.status !== "ready" ? `, ${ready ? "ready to check" : plot.status}` : ""}`;
      return <g key={plot.cell} transform={`translate(${x} ${y})`} className={styles.plot} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}
        aria-label={label} aria-pressed={onSelect ? selected === plot.cell : undefined} onClick={() => onSelect?.(plot.cell)}
        onKeyDown={event => { if (onSelect && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(plot.cell); } }}>
        <title>{label}</title><path className={styles.plotTile} d="M0-36 72 0 0 36-72 0Z" fill={plot.kind === "cleared" ? "#d7b67e" : grass} stroke="#cbe6a0" strokeWidth="2"/>
        {selected === plot.cell && <path d="M0-33 65 0 0 33-65 0Z" fill="#ffdb4a33" stroke="#ffdf55" strokeWidth="4"/>}
        <g aria-hidden="true"><Building plot={plot} ready={ready} now={now}/>
          {plot.status === "building" && <ConstructionCrew/>}
          {ready && <g transform="translate(0 -83)"><rect x="-28" y="-10" width="56" height="22" rx="8" fill="#fff8d8" stroke="#c99c30"/><text textAnchor="middle" y="5" fill="#4b592c" fontSize="10" fontWeight="800">READY</text></g>}
        </g>
      </g>;
    })}
    {!plots.length && <g aria-hidden="true"><Tree x={326} y={260} variant={1}/><Tree x={470} y={276}/><Tree x={395} y={334} small variant={2}/><path d="m319 305 58-28 32 17-58 28Z" fill="#e8d09b"/><path d="M377 278v-52" stroke="#a57944" strokeWidth="4"/><g className={styles.villageFlag}><path d="M379 226h56l-7 11 7 10h-56Z" fill="#fff1b9"/><path d="m391 232 5 4-5 4" fill="none" stroke="#657c39" strokeWidth="2"/></g></g>}
  </svg>
  <div className={styles.villageTools} role="group" aria-label="Village view controls">
    <button type="button" aria-label="Zoom in on village" disabled={zoom >= 1.75} onClick={() => setZoom(value => Math.min(1.75,value+.25))}><Plus size={17}/></button>
    <button type="button" aria-label="Zoom out of village" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1,value-.25))}><Minus size={17}/></button>
    <button type="button" aria-label="Fit whole village" onClick={() => setZoom(1)}><Maximize size={16}/></button>
    <button type="button" aria-label={paused ? "Enable village motion" : "Pause village motion"} aria-pressed={paused || reduced} disabled={reduced} title={reduced ? "Village motion is off for reduced motion" : paused ? "Enable village motion" : "Pause village motion"} onClick={() => setPaused(value => !value)}>{paused || reduced ? <Play size={15}/> : <Pause size={15}/>}</button>
  </div></div>;
}
