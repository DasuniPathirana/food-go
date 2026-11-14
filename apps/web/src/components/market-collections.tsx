"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, Compass, Flag, Heart, MapPin, MessagesSquare, Radio, Store, Ticket, Trophy, UserRound, Utensils, Zap } from "lucide-react";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import { DEMO_DISH_XP, DEMO_QUESTS, demoQuestProgress, type DemoGameAction, type DemoGameState } from "@/lib/demo-game";
import css from "./market-collections.module.css";

type GameProps = {
  state: DemoGameState;
  dispatch: (action: DemoGameAction) => void;
  venues: CatalogueVenue[];
};

const explore = "/demo/explore";
const venueUrl = (id: string) => `/demo/venue/${encodeURIComponent(id)}`;

export function DemoCollection({ dishes, state, dispatch, venues, xp }: GameProps & { dishes: boolean; xp: number }) {
  const [tab, setTab] = useState("all");
  const saves: readonly string[] = dishes ? state.savedDishes : state.savedVenues;
  const discoveries: readonly string[] = dishes ? state.collected : state.visited;
  const visible = venues.filter((venue) => tab === "all" || (tab === "saved" ? saves : discoveries).includes(venue.id));
  return <div className={css.page}>
    <header className={css.heading}>
      <div><h1>{dishes ? "FoodDex" : "VenueDex"}</h1><p>{dishes ? "Save a dish for later or collect it on a demo visit." : "Save your next stop and keep the places you’ve visited."}</p></div>
      <Link className={css.mapLink} href={explore}><Compass size={17} /> Keep exploring <ArrowUpRight size={15} /></Link>
    </header>
    <div className={css.summary} aria-label="Your collection summary">
      <span>{dishes ? <BookOpen /> : <Store />} <strong>{discoveries.length}/{venues.length}</strong> {dishes ? "dishes collected" : "places visited"}</span>
      <span><Bookmark /> <strong>{saves.length}</strong> saved</span>
      <span><Zap /> <strong>{xp}</strong> demo XP</span>
    </div>
    <div className={css.tabs} role="group" aria-label="Collection filters">{[
      ["all", "Discover all"], ["saved", "Saved to try"], ["collected", dishes ? "Collected" : "Visited"],
    ].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value}>{label}</button>)}</div>
    {visible.length > 0 ? <div className={css.collection}>{visible.map((venue) => {
      const title = dishes ? venue.dish : venue.name;
      const collected = discoveries.includes(venue.id);
      const saved = saves.includes(venue.id);
      return <article className={css.foodCard} key={venue.id}>
        <div className={css.foodPhoto}><Link href={venueUrl(venue.id)} tabIndex={-1} aria-hidden="true"><Image src={venue.image} alt="" width={500} height={350} sizes="(max-width: 620px) 104px, (max-width: 900px) 46vw, 32vw" /></Link>
          <button className={css.bookmark} aria-label={`${saved ? "Unsave" : "Save"} ${title}`} aria-pressed={saved} onClick={() => dispatch({ type: dishes ? "save-dish" : "save-venue", venueId: venue.id })}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button>
        </div>
        <div className={css.foodInfo}><h2><Link href={venueUrl(venue.id)}>{title}<ArrowUpRight size={16} /></Link></h2>
          <p>{dishes ? venue.name : venue.building ? `${venue.building.name} · ${venue.building.unit}` : venue.suburb}</p><small>{venue.cuisine}</small>
        </div>
        <div className={css.stub}><span className={collected ? css.collected : undefined}>{collected && <Check size={14} />}{collected ? (dishes ? "Collected" : "Visited") : "Example discovery"}</span>
          <strong><Zap size={14} />{dishes ? DEMO_DISH_XP[venue.id as keyof typeof DEMO_DISH_XP] : 50} demo XP</strong></div>
      </article>;
    })}</div> : <div className={css.empty}><BookOpen size={30} /><h2>{tab === "saved" ? "Nothing saved yet" : dishes ? "No dishes collected yet" : "No visits yet"}</h2>
      <p>{tab === "saved" ? "Bookmark a discovery to add it to this list." : dishes ? "Visit a stop and confirm its dish separately to collect it." : "Start a route and confirm your example visit at a stop."}</p>
      <Link className={css.action} href={explore}>Go exploring <ArrowRight size={16} /></Link></div>}
  </div>;
}

export function DemoTrails({ state, dispatch, venues }: GameProps) {
  return <div className={css.page}>
    <header className={css.heading}><div><h1>Food trails</h1><p>Choose a route and collect its stops around Melbourne.</p></div>
      <Link className={css.mapLink} href={explore}><Compass size={17} /> Open Explore <ArrowUpRight size={15} /></Link></header>
    <div className={css.trails}>{DEMO_QUESTS.map((quest) => {
      const count = demoQuestProgress(state, quest.id);
      const active = state.activeQuests.includes(quest.id);
      const claimed = state.claimedQuests.includes(quest.id);
      return <article className={css.route} key={quest.id}>
        <div className={css.routePhoto}><Image src={quest.image} alt="" width={600} height={380} sizes="(max-width: 680px) 100vw, 36vw" />
          <span className={css.routeReward}><Zap size={17} /> {quest.xp} XP</span></div>
        <div className={css.routeInfo}><h2>{quest.title}</h2><p>{quest.description}</p>
          <ol className={css.stops} aria-label={`${quest.title} stops`}>{quest.stops.map((stop, index) => {
            const visited = state.visited.includes(stop);
            return <li key={stop} data-visited={visited}><Link href={venueUrl(stop)}><span aria-label={`Stop ${index + 1}${visited ? ", visited" : ""}`}>{visited ? <Check size={15} /> : index + 1}</span>
              {venues.find((entry) => entry.id === stop)?.name}<ArrowUpRight size={14} /></Link></li>;
          })}</ol>
          <div className={css.routeFooter}>
            <div className={css.progress}><strong>{claimed ? "Trail complete" : active ? "In your plan" : `${quest.stops.length} stops`}</strong><span>{count}/{quest.stops.length} example visits</span>
              <progress max={quest.stops.length} value={count} aria-label={`${quest.title} example progress`} /></div>
            {claimed ? <span className={css.claimed}><Trophy size={18} />Reward collected</span>
              : active && count === quest.stops.length ? <button className={css.action} onClick={() => dispatch({ type: "claim-quest", questId: quest.id })}><Ticket size={17} /> Claim {quest.xp} demo XP</button>
              : <Link className={css.action} href={explore} onClick={() => dispatch({ type: "start-quest", questId: quest.id })}>{active ? "Continue adventure" : "Start this trail"} <ArrowRight size={16} /></Link>}
          </div>
          {active && !claimed && <button className={css.remove} onClick={() => dispatch({ type: "leave-quest", questId: quest.id })}>Remove from my plan</button>}
        </div>
      </article>;
    })}</div>
    <p className={css.note}>These trails use fictional venues. Example visits, completions and XP stay on this browser.</p>
  </div>;
}

const rewardRules = [
  { icon: MapPin, title: "Discover a place", value: "+50 XP", text: "Start a route, arrive, then confirm the simulated QR check-in. Once per example venue." },
  { icon: Utensils, title: "Try its signature dish", value: "+50 to 100 XP", text: "Confirm the dish separately after an example visit. Once per dish." },
  { icon: Flag, title: "Finish a food trail", value: "+100 to 200 XP", text: "Start a trail, check in at its stops, then claim the reward once." },
  { icon: MessagesSquare, title: "Share an experience", value: "+25 XP", text: "Publish a public example post. The first three each day earn XP. Removing a post removes its publishing XP." },
  { icon: Heart, title: "Join the conversation", value: "+2 to 5 XP", text: "Like another explorer’s story for 2 XP on up to five posts a day. Earn 5 XP for commenting on each of two different posts and 5 XP for sharing one other explorer’s post." },
  { icon: Radio, title: "Story reach", value: "No demo XP", text: "Feed counts in this demo are fictional. Unique signed-in reach belongs to the connected account experience." },
];

export function DemoRewards({ ready, claimed, onCollect }: { ready: boolean; claimed: boolean; onCollect: () => void }) {
  return <div className={css.page}>
    <header className={css.heading}><div><h1>Rewards</h1><p>Collect demo XP from exploring and sharing. It has no cash value.</p></div>
      <Link className={css.mapLink} href="/demo/passport"><UserRound size={17} /> View passport <ArrowUpRight size={15} /></Link></header>
    <section className={css.boost}><div className={css.boostValue}><Zap size={21} /><strong>25</strong><span>Demo XP</span></div>
      <div className={css.boostBody}><h2>Daily boost</h2><p>One boost each calendar day, Sydney time.</p><button className={css.action} disabled={!ready || claimed} onClick={onCollect}>
        {claimed ? <Check size={17} /> : <Ticket size={17} />}{claimed ? "Today’s boost collected" : "Collect 25 demo XP"}</button></div>
    </section>
    <h2 className={css.listTitle}>How to earn XP</h2>
    <dl className={css.rules}>{rewardRules.map((rule) => <div key={rule.title}><dt><rule.icon size={20} /><span>{rule.title}</span><strong>{rule.value}</strong></dt>
      <dd>{rule.text}</dd></div>)}</dl><p className={css.note}>Repeat reactions do not earn XP again. Your example activity stays on this browser.</p>
  </div>;
}
