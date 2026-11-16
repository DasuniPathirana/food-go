"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Coins, Droplets, Flag, Hammer, House, Leaf, MapPin, Mountain, RefreshCw, Sprout, Timer, TreePine, Wheat } from "lucide-react";
import { outbackRegions, type AdventureResources, type OutbackPlot } from "@/lib/adventure-contracts";
import { clearCost, cropRules, maximumStructureLevel, structureRules, upgradeRules } from "@/lib/adventure-rules";
import { useAdventure, useAdventureClock, timeRemaining } from "./use-adventure";
import { VillageScene } from "./village-scene";
import styles from "./adventure.module.css";

const names = { wild: "Untamed patch", cleared: "A fresh start", farmhouse: "The homestead", garden: "Kitchen garden", shed: "Farm shed", tank: "Rainwater tank", bakery: "Village bakery" };
const resourceIcons = { wood: TreePine, stone: Mountain, water: Droplets, seeds: Wheat, coins: Coins };
const structureIcons = { garden: Sprout, shed: House, tank: Droplets, bakery: Wheat };
function costLabel(cost: Partial<AdventureResources>) {
  return Object.entries(cost).filter(([key]) => key in resourceIcons).map(([key,value]) => `${value} ${key}`).join(" · ");
}
function affordable(resources: AdventureResources, cost: Partial<AdventureResources>) {
  return Object.entries(cost).filter(([key]) => key in resourceIcons).every(([key,value]) => resources[key as keyof AdventureResources] >= value!);
}

export function Outback({ signedIn }: { signedIn: boolean }) {
  const game = useAdventure(signedIn), now = useAdventureClock(game.data?.serverNow);
  const [region, setRegion] = useState<(typeof outbackRegions)[number]["id"]>("VIC");
  const [selected, setSelected] = useState<number>(5);
  const village = game.data?.village;
  const destination = outbackRegions.find(item => item.id === (village?.region ?? region))!;
  const plot = village?.plots.find(item => item.cell === selected);
  const ready = !!plot?.readyAt && Date.parse(plot.readyAt) <= now;
  const [notice, setNotice] = useState("");
  async function perform(input: Parameters<typeof game.act>[0], message: string) {
    setNotice("");
    if (await game.act(input)) setNotice(message);
  }
  return <div className={styles.adventurePage}>
    <header className={styles.pageHeading}><div><span className={styles.eyebrow}>A little land. A lot of possibility.</span>
      <h1>Welcome to your <em>Outback.</em></h1><p>Find good food out there. Grow something good back home.</p></div>
      <Link className={styles.textLink} href="/quests">Find a quest<ArrowRight size={17}/></Link></header>
    {game.error && <div className={styles.notice} role="alert"><span>{game.error}</span><button type="button" onClick={() => void game.refresh()}><RefreshCw size={15}/>Refresh village</button></div>}
    {notice && <p className={styles.success} role="status"><Check size={16}/>{notice}</p>}
    {game.loading && !game.data && <div className={styles.loading} role="status"><RefreshCw size={20}/>Opening your patch of Australia…</div>}
    {game.needsAccount ? <section className={styles.welcomeVillage}><div className={styles.welcomeArt}><VillageScene plots={[]} selected={null} now={now}/><span className={styles.sceneStamp}>Made by you. Grown over time.</span></div>
      <div className={styles.welcomeCopy}><span className={styles.eyebrow}>From your first seed to a thriving village</span><h2>Good things<br/>take a little growing.</h2>
        <p>Choose your Australian home, plant your first garden and make room for a bakery. Your food adventures help your village flourish.</p>
        <Link className={styles.primary} href="/auth/sign-in?next=/outback">Sign in to start growing<ArrowRight size={18}/></Link><span className={styles.finePrint}>No paid shortcuts. Your village is saved to your account.</span></div></section>
      : !village && game.data ? <section className={styles.destinationSection}>
        <div className={styles.destinationIntro}><div><span className={styles.eyebrow}>01 · Put down your roots</span><h2>Where feels like home?</h2><p>Eight places to begin. One home to make your own.</p></div><span className={styles.permanent}><MapPin size={17}/>Your home destination stays with your village.</span></div>
        <div className={styles.destinationGrid}>{outbackRegions.map((item, index) => <button type="button" key={item.id} aria-pressed={region === item.id} className={styles.destination} onClick={() => setRegion(item.id)}>
          <span className={`${styles.regionArt} ${styles[`region${index}`]}`} aria-hidden="true"><span/><i/><b>{item.id}</b></span><span><strong>{item.destination}</strong><small>{item.name}</small></span>{region === item.id && <Check size={18}/>}</button>)}</div>
        <div className={styles.destinationPreview}><div><h3>{destination.destination}</h3><p>{destination.landscape}.</p><div className={styles.terrainFacts}><span><Leaf size={16}/>{destination.climate}</span><span><Droplets size={16}/>{destination.challenge}</span></div></div>
          <button className={styles.primary} type="button" disabled={!!game.busy} onClick={() => void perform({ action: "chooseDestination", region }, "Your homestead is ready. Select a plot and make it your own.")}><Flag size={18}/>{game.busy ? "Preparing your homestead…" : `Make ${destination.destination} my home`}</button></div>
      </section> : village ? <>
        <section className={styles.villageSection} aria-label="Your farm and village">
          <div className={styles.villageTopline}><div><MapPin size={17}/><span><strong>{destination.destination}</strong><small>{destination.name}</small></span></div>
            <div className={styles.resources} aria-label="Village resources">{Object.entries(village.resources).map(([key,value]) => { const Icon = resourceIcons[key as keyof AdventureResources]; return <span key={key} title={key}><Icon size={16}/><strong>{value}</strong><small>{key}</small></span>; })}</div></div>
          <div className={styles.villageLayout}><div className={styles.sceneWrap}><VillageScene plots={village.plots} selected={selected} onSelect={cell => { setSelected(cell); setNotice(""); }} region={village.region} now={now}/>
            <span className={styles.sceneStamp}><Sprout size={14}/>Select a plot. Make it yours.</span></div>
            <aside className={styles.plotPanel} aria-label="Selected plot actions"><div className={styles.plotTitle}><span className={styles.plotNumber}>{String(selected+1).padStart(2,"0")}</span><div><small>YOUR PATCH</small><h2>{plot ? names[plot.kind] : "Choose a plot"}</h2></div></div>
              <label className={styles.plotChooser}>Choose a plot<select value={selected} onChange={event => { setSelected(Number(event.target.value)); setNotice(""); }}>{village.plots.map(item => <option key={item.cell} value={item.cell}>{String(item.cell+1).padStart(2,"0")} · {names[item.kind]}</option>)}</select></label>
              {plot && <><div className={styles.plotMeta}><span>{plot.kind === "wild" || plot.kind === "cleared" ? "Room to grow" : `Level ${plot.level} of ${maximumStructureLevel}`}</span><span>{plot.status === "building" ? "Under construction" : plot.status === "growing" ? "Growing" : "Ready"}</span></div>
                {plot.status !== "ready" ? <div className={styles.timerCard}><h3>{ready ? plot.status === "growing" ? "A good day to harvest." : "Ready for the finishing touch." : plot.status === "growing" ? "A little patience. A little sunshine." : "Something good is taking shape."}</h3>
                  <strong>{ready ? "Ready to check" : timeRemaining(plot.readyAt, now)}</strong><button className={styles.primary} type="button" disabled={!ready || !!game.busy} onClick={() => void perform({ action: plot.status === "growing" ? "harvest" : "finish", cell: selected }, plot.status === "growing" ? "Harvest collected. Your supplies are updated." : "Construction complete. Your village is growing.")}>{plot.status === "growing" ? "Gather your harvest" : "Complete construction"}<Check size={17}/></button></div>
                  : plot.kind === "wild" ? <><p>A little clearing makes room for something wonderful.</p><div className={styles.cost}><TreePine size={16}/>{costLabel(clearCost)}</div><button type="button" className={styles.primary} disabled={!!game.busy || !affordable(village.resources,clearCost)} onClick={() => void perform({ action: "clear", cell: selected }, "Plot cleared. Choose what you would like to build here.")}><Hammer size={17}/>Prepare this plot</button></>
                    : plot.kind === "cleared" ? <><p>Pick the next piece of your village.</p><div className={styles.buildChoices}>{Object.entries(structureRules).map(([kind,rules]) => { const Icon = structureIcons[kind as keyof typeof structureIcons]; return <button type="button" key={kind} disabled={!!game.busy || !affordable(village.resources,rules)} onClick={() => void perform({ action: "build", cell: selected, structure: kind as keyof typeof structureRules }, "Building started. Come back for the finishing touch.")}><Icon size={22}/><span><strong>{names[kind as keyof typeof structureRules]}</strong><small>{costLabel(rules)}</small><small>{rules.seconds} seconds to build</small></span><ArrowRight size={16}/></button>; })}</div></>
                      : <>{plot.kind === "garden" && <div className={styles.cropChoices}><h3>What is growing next?</h3>{Object.entries(cropRules).map(([crop,rules]) => <button type="button" key={crop} disabled={!!game.busy || !affordable(village.resources,{water:rules.water,seeds:rules.seeds})} onClick={() => void perform({ action: "plant", cell: selected, crop: crop as keyof typeof cropRules }, `${crop[0].toUpperCase()+crop.slice(1)} planted. Let them grow.`)}><Sprout size={19}/><span><strong>{crop[0].toUpperCase()+crop.slice(1)}</strong><small>{rules.water} water · {rules.seeds} seed · {rules.seconds}s</small></span><span className={styles.yield}>{rules.coins*plot.level}<Coins size={12}/></span></button>)}</div>}
                        {plot.level < maximumStructureLevel ? <div className={styles.upgrade}><h3>A little better, every day.</h3><p>Upgrade to level {plot.level+1}.</p><small>{costLabel(upgradeRules(plot.level))} · {upgradeRules(plot.level).seconds}s</small><button type="button" className={styles.secondary} disabled={!!game.busy || !affordable(village.resources,upgradeRules(plot.level))} onClick={() => void perform({ action: "upgrade", cell: selected }, "Upgrade started. Your next chapter is on its way.")}><Hammer size={16}/>Start upgrade</button></div> : <p className={styles.success}><Check size={16}/>Fully grown. A lovely part of your village.</p>}</>}
              </>}
              {game.busy && <span className={styles.finePrint} role="status">Saving your change…</span>}
            </aside></div>
        </section>
        <section className={styles.villageBottom}><div className={styles.dailyCard}><div><span className={styles.eyebrow}>A little help from your adventures</span><h2>{village.dailyClaimed ? "Today's supplies are tucked away." : "Good adventures. Fresh supplies."}</h2><p>{village.dailyClaimed ? "Your next eligible daily reward will appear here." : village.dailyEligible ? "Your verified activity unlocked today's village supplies." : "Verified food adventures can unlock daily village supplies."}</p></div>
          <button type="button" className={styles.primary} disabled={!!game.busy || village.dailyClaimed || !village.dailyEligible} onClick={() => void perform({ action: "claimDaily" }, "Daily supplies collected. Ready for your next project.")}>{village.dailyClaimed ? <><Check size={16}/>Collected</> : "Collect supplies"}</button></div>
          <div className={styles.smallNote}><p>A village worth growing.<br/><strong>No attacks. No paid shortcuts. Just your own little world.</strong></p></div></section>
      </> : !game.loading && <section className={styles.empty}><h2>Your village is taking a moment.</h2><p>Refresh to load your saved adventure.</p><button type="button" className={styles.secondary} onClick={() => void game.refresh()}>Try again<RefreshCw size={16}/></button></section>}
  </div>;
}
