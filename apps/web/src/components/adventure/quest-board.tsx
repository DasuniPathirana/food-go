"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, BadgeCheck, BookOpen, Check, CheckCheck, Clock3, Copy, Flag, MapPin, MessageSquare, Plus, RefreshCw, ShieldCheck, Sparkles, Sprout, Store, Ticket, Utensils, X, Zap } from "lucide-react";
import type { AdventureQuest } from "@/lib/adventure-contracts";
import { questRewards, xpForLevel } from "@/lib/adventure-rules";
import { communityFeedSchema, type CommunityPost } from "@/lib/community";
import type { WorldLootClaim } from "@/lib/world-data";
import { useAdventure } from "./use-adventure";
import { useJourney } from "../journey-provider";
import styles from "./adventure.module.css";
import { useFeedAccess } from "../feed-access";

const categories = { explore: { label: "Go & discover", icon: MapPin }, try: { label: "Try something new", icon: Utensils }, feedback: { label: "Honest feedback", icon: MessageSquare }, community: { label: "Share your story", icon: Sparkles }, promo: { label: "A little extra", icon: Ticket } };
type QuestCategory = AdventureQuest["category"];
type QuestSection = "quests" | "visits" | "wishlist" | "achievements";
type SavedVenueDetail = { id: string; slug: string; name: string; suburb: string; cuisine: string; address: string };
const localInputTime = (date: Date) => new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);

export function QuestBoard({ signedIn }: { signedIn: boolean }) {
  const game = useAdventure(signedIn), journey = useJourney();
  const { age } = useFeedAccess();
  const [section, setSection] = useState<QuestSection>("quests");
  const [filter, setFilter] = useState<"available"|"active"|"completed"|"manage">("available");
  const [category, setCategory] = useState<"all"|QuestCategory>("all");
  const [completion, setCompletion] = useState<string | null>(null), [create, setCreate] = useState(false);
  const [issued, setIssued] = useState<{ code: string; expiresAt?: string } | null>(null), [notice,setNotice] = useState("");
  const [formVenue,setFormVenue] = useState(""), [formCategory,setFormCategory] = useState<QuestCategory>("explore"), [formPromotion,setFormPromotion] = useState("");
  const [stories,setStories] = useState<CommunityPost[]>([]), [storiesStatus,setStoriesStatus] = useState("");
  const [storyPage,setStoryPage] = useState<string | undefined>(), [nextStoryPage,setNextStoryPage] = useState<string | null>(null);
  const [savedDirectory, setSavedDirectory] = useState<SavedVenueDetail[]>([]);
  const [lootClaims, setLootClaims] = useState<WorldLootClaim[]>([]);

  useEffect(() => {
    if (!signedIn) return;
    fetch("/api/venues?limit=50", { cache: "no-store" })
      .then(async res => (res.ok ? await res.json() : null))
      .then(data => {
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.venues) ? data.venues : [];
        if (list.length) setSavedDirectory(list);
      })
      .catch(() => {});
    fetch("/api/world", { cache: "no-store", credentials: "same-origin" })
      .then(async res => (res.ok ? await res.json() : null))
      .then(data => {
        if (Array.isArray(data?.myClaims)) setLootClaims(data.myClaims);
      })
      .catch(() => {});
  }, [signedIn]);
  const quests = game.data?.quests ?? [];
  const managed = game.data?.partnerVenues.length || game.data?.operator;
  const filtered = quests.filter(quest => (filter === "manage" || quest.category !== "community" || age?.feedEligible) && (category === "all" || quest.category === category) && (filter === "manage" ? quest.managed || game.data?.operator
    : filter === "completed" ? !!quest.participation?.completedAt
      : filter === "active" ? !!quest.participation && !quest.participation.completedAt
        : quest.status === "published" && !quest.participation && !quest.managed));
  const profile = game.data?.profile;
  const selectedVenue = formVenue || game.data?.partnerVenues[0]?.id;
  const dishes = game.data?.partnerDishes.filter(item => item.venueId === selectedVenue) ?? [];
  const promotions = game.data?.partnerPromotions.filter(item => item.venueId === selectedVenue) ?? [];
  const selectedPromotion = promotions.find(item => item.id === formPromotion) ?? promotions[0];
  useEffect(() => {
    if (!completion || quests.find(quest => quest.id === completion)?.category !== "community") return;
    const controller = new AbortController();
    if (!storyPage) setStories([]);
    setStoriesStatus("Loading your published stories…");
    const query = new URLSearchParams({wall:"me",...(storyPage ? {cursor:storyPage} : {})});
    fetch("/api/community?"+query, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]) }).then(async response => {
      const parsed = communityFeedSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success || parsed.data.status !== "ready") throw new Error();
      if (controller.signal.aborted) return;
      const own = parsed.data.posts.filter(post => post.status === "published" && post.visibility === "public" && post.author.id === parsed.data.viewer?.id);
      setStories(current => storyPage ? [...new Map([...current,...own].map(post => [post.id,post])).values()] : own);
      setNextStoryPage(parsed.data.nextCursor);
      setStoriesStatus(own.length || storyPage ? "Choose an original story you published about this experience." : "Publish an original public story in Passport first. It must be approved before completing this quest.");
    }).catch(() => { if (!controller.signal.aborted) setStoriesStatus("Your stories could not load. Open Passport to check them, then try again."); });
    return () => controller.abort();
  }, [completion, game.data?.quests, storyPage]);
  async function perform(input: Parameters<typeof game.act>[0], message: string) {
    setNotice(""); const result = await game.act(input);
    if (result) { setNotice(message); if (result.code) setIssued({ code: result.code, expiresAt: result.expiresAt }); }
    return result;
  }
  async function complete(event: FormEvent<HTMLFormElement>, quest: AdventureQuest) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const result = await perform({ action: "completeQuest", questId: quest.id, code: String(form.get("code") ?? "").trim().toLowerCase(),
      ...(quest.category === "feedback" ? { feedback: String(form.get("feedback") ?? "") } : {}),
      ...(quest.category === "community" ? { postId: String(form.get("postId") ?? "").trim() } : {}) }, "Quest complete. Your verified progress has been updated.");
    if (result) setCompletion(null);
  }
  async function createQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget), now = new Date();
    const result = await perform({ action: "questCreate", id: crypto.randomUUID(), venueId: String(form.get("venueId")),
      title: String(form.get("title")), description: String(form.get("description")), category: String(form.get("category")) as QuestCategory,
      startsAt: new Date(Math.max(now.getTime(),formCategory === "promo" && selectedPromotion ? Date.parse(selectedPromotion.startsAt) : 0)).toISOString(), endsAt: new Date(String(form.get("endsAt"))).toISOString(), capacity: Number(form.get("capacity")),
      ...(formCategory === "try" && form.get("dishId") ? { dishId: String(form.get("dishId")) } : {}),
      ...(formCategory === "promo" && selectedPromotion ? { promotionId: selectedPromotion.id, discountPercent: Number(form.get("discountPercent")) } : {}) }, "Quest saved as a draft. Submit it for independent review when ready.");
    if (result) { setCreate(false); setFilter("manage"); }
  }
  const visitsList = journey?.data?.visits ?? [];
  const savedIds = journey?.data?.savedVenues ?? [];
  const wishlistVenues = savedDirectory.filter(v => savedIds.includes(v.id));
  const achievements = [
    { id: "first-visit", title: "First Footstep", description: "Complete 1 verified restaurant visit", unlocked: visitsList.length >= 1 },
    { id: "city-regular", title: "Melbourne Local", description: "Check in at 3 distinct pilot venues", unlocked: visitsList.length >= 3 },
    { id: "wishlist-planner", title: "Food Wishlist Curator", description: "Save 3 restaurants you plan to visit", unlocked: savedIds.length >= 3 },
    { id: "loot-hunter", title: "3D Treasure & AR Hunter", description: "Claim at least 1 Map or AR loot drop", unlocked: lootClaims.length >= 1 },
    { id: "dish-finder", title: "Flavour Collector", description: "Discover 3 verified menu dishes", unlocked: (journey?.data?.discoveries.length ?? 0) >= 3 },
    { id: "level-5", title: "Rising Explorer", description: "Reach Explorer Level 5 or higher", unlocked: (profile?.level ?? journey?.data?.progress.level ?? 1) >= 5 },
  ];
  const visits = visitsList.length;
  return <div className={styles.adventurePage}>
    <header className={styles.pageHeading}><div><span className={styles.eyebrow}>Little adventures. Real connections.</span><h1>Make your next meal<br/><em>part of the story.</em></h1><p>Track restaurant quests, visited stops, places you plan to visit, and explorer achievements.</p></div>
      <Link href="/outback" className={styles.secondary}><Sprout size={18}/>Outback (Coming Soon)<ArrowRight size={17}/></Link></header>
    <div className={styles.boardTools} style={{ marginBottom: 18 }}>
      <div className={styles.tabs} role="group" aria-label="Quest hub sections">
        <button type="button" aria-pressed={section === "quests"} onClick={() => setSection("quests")}>Quests ({quests.filter(q => q.status === "published").length})</button>
        <button type="button" aria-pressed={section === "visits"} onClick={() => setSection("visits")}>Visited Places ({visitsList.length + lootClaims.length})</button>
        <button type="button" aria-pressed={section === "wishlist"} onClick={() => setSection("wishlist")}>Willing to Visit ({savedIds.length})</button>
        <button type="button" aria-pressed={section === "achievements"} onClick={() => setSection("achievements")}>Achievements ({achievements.filter(a => a.unlocked).length}/{achievements.length})</button>
      </div>
    </div>
    <section className={styles.questHero} aria-label="Your adventure progress"><div className={styles.questHeroCopy}><span className={styles.eyebrow}>THE QUEST BOARD</span><h2>Good food.<br/>A good reason to get out.</h2><p>Real restaurant requests, genuine experiences and a little more to discover.</p></div>
      <div className={styles.questIllustration} aria-hidden="true"><span className={styles.ticketArt}><b>ONE MORE<br/>GOOD STORY</b><i>FOOD GO · ADVENTURE CLUB</i></span></div>
      <div className={styles.progressTicket}>{profile ? <><span>YOUR EXPLORER PASS</span><strong>{String(profile.level).padStart(2,"0")}<small>/ 250</small></strong><b>{profile.tier} explorer · {(journey?.data?.progress.coins ?? 0).toLocaleString()} Coins</b>
        <progress aria-label="XP towards next level" value={Math.max(0,profile.xp-xpForLevel(profile.level))} max={Math.max(1,profile.nextLevelXp-xpForLevel(profile.level))}/><small>{profile.xp.toLocaleString()} XP · {profile.level === 250 ? "Legendary level reached" : `${Math.max(0,profile.nextLevelXp-profile.xp).toLocaleString()} XP to next checkpoint`}</small><Link href="/profile">Open your Passport<ArrowRight size={14}/></Link></>
        : <><span>YOUR NEXT CHAPTER</span><h3>Every good story<br/>starts somewhere.</h3><Link href="/auth/sign-in?next=/quests">Sign in for your quests<ArrowRight size={15}/></Link></>}</div></section>
    {section === "visits" && (
      <section className={styles.questGrid} aria-label="Visited locations and claimed loot spots" style={{ marginTop: 18 }}>
        {!signedIn ? (
          <article className={styles.questCard}><h3>Sign in to view your visited locations</h3><p>Check-ins and claimed 3D Map / AR loots appear here automatically.</p><Link href="/auth/sign-in?next=/quests" className={styles.primary}>Sign in<ArrowRight size={16}/></Link></article>
        ) : visitsList.length === 0 && lootClaims.length === 0 ? (
          <article className={styles.questCard}><h3>No visited spots yet</h3><p>Walk the Melbourne 3D map, check in with a restaurant code, or grab an AR/Map reward.</p><Link href="/" className={styles.primary}>Explore Melbourne<ArrowRight size={16}/></Link></article>
        ) : (
          <>
            {visitsList.map(v => (
              <article key={v.id + v.at} className={styles.questCard}>
                <div className={styles.questCardTop}><span><MapPin size={15}/>Verified Check-in</span><b><BadgeCheck size={15}/>Visited</b></div>
                <div className={styles.questCardBody}>
                  <h3>{v.name}</h3>
                  <p>{v.suburb} · Checked in on {new Date(v.at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Link href="/feed" className={styles.secondary}>Write Story in Feed</Link>
                  </div>
                </div>
              </article>
            ))}
            {lootClaims.map(c => (
              <article key={c.id} className={styles.questCard}>
                <div className={styles.questCardTop}><span><Sparkles size={15}/>{c.grabMode === "ar_grab" ? "AR Scan Visit" : "Map Drop Visit"}</span><b>+{c.xpAwarded} XP / +{c.coinsAwarded} Coins</b></div>
                <div className={styles.questCardBody}>
                  <h3>{c.title}</h3>
                  <p>{c.venueName || "Melbourne Pilot Drop"} · Claimed {new Date(c.claimedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</p>
                </div>
              </article>
            ))}
          </>
        )}
      </section>
    )}
    {section === "wishlist" && (
      <section className={styles.questGrid} aria-label="Places willing to visit" style={{ marginTop: 18 }}>
        {!signedIn ? (
          <article className={styles.questCard}><h3>Sign in to build your Wishlist</h3><p>Save any restaurant from the 3D Explorer to track places you want to visit next.</p><Link href="/auth/sign-in?next=/quests" className={styles.primary}>Sign in<ArrowRight size={16}/></Link></article>
        ) : wishlistVenues.length === 0 ? (
          <article className={styles.questCard}><h3>Your Willing to Visit list is empty</h3><p>Open any venue on the 3D Explorer and tap Save to add it to your dining wishlist.</p><Link href="/" className={styles.primary}>Browse 3D Explorer<ArrowRight size={16}/></Link></article>
        ) : (
          wishlistVenues.map(v => (
            <article key={v.id} className={styles.questCard}>
              <div className={styles.questCardTop}><span><MapPin size={15}/>Willing to Visit</span><b>{v.suburb}</b></div>
              <div className={styles.questCardBody}>
                <h3>{v.name}</h3>
                <p>{v.cuisine} · {v.address}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <Link href={`/venues/${encodeURIComponent(v.slug)}`} className={styles.primary}>View Venue<ArrowRight size={15}/></Link>
                  <button type="button" className={styles.secondary} onClick={() => void journey?.save("venue", v.id)}>Remove</button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    )}
    {section === "achievements" && (
      <section className={styles.questGrid} aria-label="Explorer achievements and level milestones" style={{ marginTop: 18 }}>
        {achievements.map(item => (
          <article key={item.id} className={styles.questCard}>
            <div className={styles.questCardTop}>
              <span><BadgeCheck size={15}/>{item.unlocked ? "Unlocked Badge" : "Locked Milestone"}</span>
              <b>{item.unlocked ? "Earned" : "In Progress"}</b>
            </div>
            <div className={styles.questCardBody}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>
    )}
    {section === "quests" && <>
    {game.error && <div className={styles.notice} role="alert"><span>{game.error}</span><button type="button" onClick={() => void game.refresh()}><RefreshCw size={15}/>Try again</button></div>}
    {notice && <p className={styles.success} role="status"><CheckCheck size={17}/>{notice}</p>}
    {issued && <section className={styles.issuedCode} role="status"><div><ShieldCheck size={22}/><h3>Give this code to the eligible guest.</h3><p>Confirm their qualifying activity before sharing. Each code is single use.</p></div><code>{issued.code}</code><button type="button" className={styles.secondary} onClick={() => { if (!navigator.clipboard?.writeText) { setNotice("Select the code to copy it manually."); return; } void navigator.clipboard.writeText(issued.code).then(() => setNotice("Quest code copied.")).catch(() => setNotice("Select the code to copy it manually.")); }}><Copy size={16}/>Copy code</button>{issued.expiresAt && <small>Expires {new Date(issued.expiresAt).toLocaleString("en-AU")}</small>}<button type="button" aria-label="Close quest code" onClick={() => setIssued(null)}><X size={18}/></button></section>}
    <div className={styles.boardHeading}><div><span className={styles.eyebrow}>YOUR NEXT LITTLE ADVENTURE</span><h2>Pick something that feels good.</h2></div>{!!game.data?.partnerVenues.length && <button type="button" className={styles.secondary} onClick={() => setCreate(value => !value)} aria-expanded={create}><Plus size={17}/>Create a quest</button>}</div>
    {create && <form className={styles.questForm} onSubmit={createQuest}><div className={styles.formHeading}><h3>Invite people into your story.</h3><p>Ask for genuine support. Feedback requests must welcome honest experiences.</p></div>
      <label>Restaurant<select name="venueId" value={selectedVenue} onChange={event => { setFormVenue(event.target.value); setFormPromotion(""); setFormCategory("explore"); }} required>{game.data?.partnerVenues.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label>
      <label>Quest title<input name="title" minLength={3} maxLength={90} placeholder="Try our new seasonal lunch" required/></label>
      <label className={styles.formWide}>What would you like guests to do?<textarea name="description" minLength={10} maxLength={1000} rows={3} placeholder="Explain the experience and how your team will confirm it." required/></label>
      <label>Experience<select name="category" value={formCategory} onChange={event => setFormCategory(event.target.value as QuestCategory)}>{Object.entries(categories).map(([key,value]) => <option value={key} key={key} disabled={key === "promo" && !promotions.length}>{value.label} · {questRewards[key as keyof typeof questRewards]} XP{key === "promo" && !promotions.length ? " · publish an offer first" : ""}</option>)}</select></label>
      {formCategory === "try" && <label>Menu item<select name="dishId"><option value="">Any eligible meal or experience</option>{dishes.map(dish => <option key={dish.id} value={dish.id}>{dish.name}</option>)}</select></label>}
      {formCategory === "promo" && <><label>Published offer<select name="promotionId" value={selectedPromotion?.id ?? ""} onChange={event => setFormPromotion(event.target.value)} required>{promotions.map(promotion => <option key={promotion.id} value={promotion.id}>{promotion.title}</option>)}</select></label><label>Quest discount (%)<input name="discountPercent" type="number" min={1} max={50} required defaultValue={10}/></label></>}
      <label>Ends on<input name="endsAt" type="datetime-local" required min={localInputTime(new Date(formCategory === "promo" && selectedPromotion ? Math.max(Date.now(),Date.parse(selectedPromotion.startsAt)) : Date.now()))} max={formCategory === "promo" && selectedPromotion ? localInputTime(new Date(selectedPromotion.endsAt)) : undefined}/></label><label>Available places<input name="capacity" type="number" min={1} max={500} defaultValue={30} required/></label>
      <div className={styles.formWide}><button type="submit" className={styles.primary} disabled={!!game.busy}>Save quest draft<ArrowRight size={16}/></button></div></form>}
    <div className={styles.boardTools}><div className={styles.tabs} role="group" aria-label="Quest status">{([['available','Discover'],['active','In progress'],['completed','Completed'],...(managed ? [['manage','Manage']] : [])] as [typeof filter,string][]).map(([value,label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <label className={styles.categorySelect}>Experience<select value={category} onChange={event => setCategory(event.target.value as typeof category)}><option value="all">All experiences</option>{Object.entries(categories).map(([key,item]) => <option value={key} key={key}>{item.label}</option>)}</select></label></div>
    {game.loading && !game.data ? <div className={styles.loading} role="status"><RefreshCw size={20}/>Finding your next adventure…</div>
      : filtered.length ? <section className={styles.questGrid} aria-label="Restaurant quests">{filtered.map(quest => { const item = categories[quest.category], Icon = item.icon; return <article className={styles.questCard} key={quest.id} data-kind={quest.category}>
        <div className={styles.questCardTop}><span><Icon size={16}/>{item.label}</span><b><Zap size={15}/>{quest.rewardXp} XP</b></div><div className={styles.questCardBody}><Link href={`/venues/${quest.venueSlug}`} className={styles.venueLabel}><Store size={14}/>{quest.venueName}</Link><h3>{quest.title}</h3><p>{quest.description}</p>
          <div className={styles.questFacts}><span><Clock3 size={14}/>{new Date(quest.endsAt).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</span><span>{Math.max(0,quest.capacity-quest.acceptedCount)} places left</span>{quest.discountPercent != null && <span>{quest.discountPercent}% offer</span>}</div>
          {quest.participation?.completedAt ? <p className={styles.success}><BadgeCheck size={18}/>{quest.participation.awardedXp} XP verified · Complete</p>
            : filter === "manage" ? <div className={styles.manageQuest}><span className={styles.statusTag}>{quest.status}</span>
              {quest.managed && (quest.status === "draft" || quest.status === "rejected") && <button type="button" className={styles.secondary} disabled={!!game.busy} onClick={() => void perform({ action: "questSubmit", questId: quest.id }, "Quest sent for independent review.")}>Submit for review<ArrowRight size={15}/></button>}
              {quest.managed && quest.status === "published" && <button type="button" className={styles.secondary} disabled={!!game.busy} onClick={() => void perform({ action: "questIssue", questId: quest.id }, "Quest verification code created.")}><ShieldCheck size={16}/>Issue a guest code</button>}
              {quest.privateFeedback.length > 0 && <details className={styles.feedbackList}><summary>Private guest feedback ({quest.privateFeedback.length})</summary>{quest.privateFeedback.map((feedback,index) => <p key={index}>{feedback}</p>)}</details>}
              {game.data?.operator && !quest.managed && <form onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await perform({ action: "questReview", questId: quest.id, decision: String(form.get("decision")) as "approve"|"reject"|"withdraw", reason: String(form.get("reason")) }, "Quest review recorded."); }}><label>Review decision<select name="decision"><option value="approve">Approve</option><option value="reject">Reject</option><option value="withdraw">Withdraw</option></select></label><label>Decision reason<input name="reason" minLength={3} maxLength={240} required/></label><button className={styles.secondary} disabled={!!game.busy} type="submit">Record review</button></form>}
            </div> : quest.participation ? <><button type="button" className={styles.primary} onClick={() => { setCompletion(completion === quest.id ? null : quest.id); setStoryPage(undefined); setNextStoryPage(null); }} aria-expanded={completion === quest.id}><Check size={16}/>Complete your quest</button>
              {completion === quest.id && <form className={styles.completionForm} onSubmit={event => void complete(event,quest)}><label>Code from the restaurant<input name="code" autoComplete="off" minLength={32} maxLength={32} pattern="[a-fA-F0-9]{32}" placeholder="Your single-use quest code" required/></label>
                {quest.category === "feedback" && <label>Your honest feedback<textarea name="feedback" minLength={10} maxLength={1000} rows={3} required/><small>Feedback is private to the restaurant and operators. Honest criticism qualifies.</small></label>}
                {quest.category === "community" && <label>Your published food story<select name="postId" required disabled={!stories.length}><option value="">Choose your story</option>{stories.map(post => <option key={post.id} value={post.id}>{post.body.slice(0,85)}</option>)}</select><small>{storiesStatus} <Link href="/profile">Open Passport</Link></small><small>Share a genuine experience and disclose that this quest awards XP. Positive ratings are never required.</small></label>}
                {quest.category === "community" && nextStoryPage && <button type="button" className={styles.textLink} onClick={() => setStoryPage(nextStoryPage)}>Load more of your stories<ArrowRight size={14}/></button>}
                <button type="submit" className={styles.secondary} disabled={!!game.busy || (quest.category === "community" && !stories.length)}>Verify completion<ShieldCheck size={16}/></button></form>}</>
              : <button type="button" className={styles.primary} disabled={!!game.busy || quest.acceptedCount >= quest.capacity} onClick={() => void perform({ action: "acceptQuest", questId: quest.id }, "Quest added. Visit the restaurant and ask the team to verify your activity.")}>This one's for me<ArrowRight size={16}/></button>}
        </div></article>; })}</section>
        : <section className={styles.empty}><h3>{game.needsAccount ? "Your next chapter is waiting." : filter === "active" ? "Leave a little room for adventure." : filter === "completed" ? "Your good stories will live here." : filter === "manage" ? "Start with an invitation." : "Something good is on its way."}</h3><p>{game.needsAccount ? "Sign in to accept quests and keep your progress together." : filter === "active" ? "Pick a restaurant request from Discover to get started." : filter === "completed" ? "Completed, verified quests will appear here." : filter === "manage" ? "Create a genuine restaurant request and send it for review." : "Published restaurant quests appear here. In the meantime, find your next favourite on Explore."}</p><Link className={styles.secondary} href={game.needsAccount ? "/auth/sign-in?next=/quests" : "/"}>{game.needsAccount ? "Sign in to join in" : "Go exploring"}<ArrowRight size={16}/></Link></section>}
    <section className={styles.supportingQuests}><div><span><h3>A trail of good discoveries.</h3><p>{signedIn ? `${Math.min(visits,3)} of 3 different places collected.` : "Collect venue-issued visit codes as you explore."}</p></span><Link href="/collect">Collect a visit<ArrowRight size={16}/></Link></div><div><span><h3>Good experiences. Honestly earned.</h3><p>Quest rewards follow verified activity. Honest feedback always comes first.</p></span></div></section>
    </>}
  </div>;
}
