/** Browser-only sample game rules. Never use this reducer to grant real rewards. */
export const DEMO_GAME_KEY = "food-go:adventure-demo:v1";
export const DEMO_AUTHOR_ID = "40000000-0000-4000-8000-000000000004";
export const DEMO_START_XP = 320;
export const DEMO_VENUE_IDS = ["finch-and-field", "ciao-carlton", "small-hours", "arcade-leaf-and-grain", "arcade-laneway-noodles", "arcade-cloud-patisserie"] as const;
export type DemoVenueId = typeof DEMO_VENUE_IDS[number];
export const DEMO_DISH_XP: Record<DemoVenueId, number> = { "finch-and-field": 75, "ciao-carlton": 100, "small-hours": 50, "arcade-leaf-and-grain": 50, "arcade-laneway-noodles": 50, "arcade-cloud-patisserie": 50 };
export const DEMO_QUESTS = [
  { id: "morning-person", title: "The bright brunch round", description: "A cafe favourite, a colourful bowl and a pastry finale.", stops: ["finch-and-field", "arcade-leaf-and-grain", "arcade-cloud-patisserie"], xp: 150, image: "/images/brunch.jpg" },
  { id: "little-italy", title: "A little taste of Melbourne", description: "Three example favourites, from brunch to pizza and coffee.", stops: ["finch-and-field", "ciao-carlton", "small-hours"], xp: 200, image: "/images/pizza.jpg" },
  { id: "small-rituals", title: "Coffee and a bakery stop", description: "Start at Small Hours, then find Cloud Patisserie inside Garden Arcade.", stops: ["small-hours", "arcade-cloud-patisserie"], xp: 100, image: "/images/coffee.jpg" },
] as const;
export type DemoQuestId = typeof DEMO_QUESTS[number]["id"];
export type DemoAwardKind = "visit" | "dish" | "quest" | "daily" | "post" | "like" | "comment" | "share";
export type DemoAward = { key: string; kind: DemoAwardKind; subject: string; day: string; at: string; amount: number; revoked?: true };
export type DemoGameState = {
  version: 1; name: string; savedVenues: DemoVenueId[]; savedDishes: DemoVenueId[]; visited: DemoVenueId[]; collected: DemoVenueId[];
  activeQuests: DemoQuestId[]; claimedQuests: DemoQuestId[]; route: { venueId: DemoVenueId; stage: "walking" | "arrived" } | null; ledger: DemoAward[];
};
export type DemoSocialEvent = { kind: "post" | "like" | "comment" | "share" | "remove-post"; postId: string; authorId?: string; eventId?: string };
export type DemoGameAction =
  | { type: "reset" }
  | { type: "name"; name: string }
  | { type: "save-venue" | "save-dish" | "route" | "check-in" | "collect-dish"; venueId: string }
  | { type: "arrive" | "cancel-route" | "daily" }
  | { type: "start-quest" | "leave-quest" | "claim-quest"; questId: string }
  | { type: "social"; event: DemoSocialEvent };

const venueId = (id: string): id is DemoVenueId => (DEMO_VENUE_IDS as readonly string[]).includes(id);
const questId = (id: string): id is DemoQuestId => DEMO_QUESTS.some((quest) => quest.id === id);
const validSocialId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9-]{1,80}$/u.test(id);
const MAX_LEDGER = 2000;
export function createDemoGame(): DemoGameState {
  return { version: 1, name: "Alex", savedVenues: [], savedDishes: [], visited: [], collected: [], activeQuests: [], claimedQuests: [], route: null, ledger: [] };
}
/** Reward resets use one documented Australian calendar day, including daylight saving. */
export function demoDay(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}
export function demoProgress(state: DemoGameState) {
  const xp = DEMO_START_XP + state.ledger.reduce((total, award) => total + (award.revoked ? 0 : award.amount), 0);
  const level = Math.floor(xp / 250) + 2;
  return { xp, level, intoLevel: xp % 250, nextAt: (level - 1) * 250, remaining: 250 - xp % 250 };
}
export function demoBadges(state: DemoGameState) {
  return [
    { id: "footsteps", name: "First footsteps", detail: "Check in at one example venue", earned: state.visited.length > 0 },
    { id: "taste", name: "A taste for it", detail: "Confirm your first example dish", earned: state.collected.length > 0 },
    { id: "trail", name: "Trail finder", detail: "Complete and claim a food trail", earned: state.claimedQuests.length > 0 },
    { id: "regular", name: "Local regular", detail: "Visit three different example venues", earned: state.visited.length >= 3 },
    { id: "story", name: "Good company", detail: "Share your first public example story", earned: state.ledger.some((entry) => entry.kind === "post" && !entry.revoked) },
    { id: "plate", name: "Full plate", detail: "Collect all six example dishes", earned: state.collected.length === DEMO_VENUE_IDS.length },
  ];
}
export function demoQuestProgress(state: DemoGameState, id: string) {
  const quest = DEMO_QUESTS.find((entry) => entry.id === id);
  return quest ? quest.stops.filter((stop) => state.visited.includes(stop)).length : 0;
}
const toggle = <T extends string>(items: T[], id: T) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
function award(state: DemoGameState, kind: DemoAwardKind, subject: string, amount: number, now: Date) {
  const key = `${kind}:${subject}`;
  if (state.ledger.length >= MAX_LEDGER || state.ledger.some((entry) => entry.key === key)) return state;
  return { ...state, ledger: [...state.ledger, { key, kind, subject, amount, day: demoDay(now), at: now.toISOString() }] };
}

export function reduceDemoGame(state: DemoGameState, action: DemoGameAction, now = new Date()): DemoGameState {
  if (!Number.isFinite(now.getTime())) return state;
  if (action.type === "reset") return createDemoGame();
  if (action.type === "name") {
    const name = action.name.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, 40);
    return name ? { ...state, name } : state;
  }
  if (action.type === "daily") return award(state, "daily", demoDay(now), 25, now);
  if (action.type === "cancel-route") return { ...state, route: null };
  if (action.type === "arrive") return state.route ? { ...state, route: { ...state.route, stage: "arrived" } } : state;
  if ("venueId" in action) {
    const id = action.venueId;
    if (!venueId(id)) return state;
    if (action.type === "save-venue") return { ...state, savedVenues: toggle(state.savedVenues, id) };
    if (action.type === "save-dish") return { ...state, savedDishes: toggle(state.savedDishes, id) };
    if (action.type === "route") return { ...state, route: { venueId: id, stage: "walking" } };
    if (action.type === "check-in") {
      if (state.visited.includes(id) || state.route?.venueId !== id || state.route.stage !== "arrived") return state;
      const next = award(state, "visit", id, 50, now);
      return next === state ? state : { ...next, visited: [...state.visited, id], route: null };
    }
    if (action.type === "collect-dish") {
      if (!state.visited.includes(id) || state.collected.includes(id)) return state;
      const next = award(state, "dish", id, DEMO_DISH_XP[id], now);
      return next === state ? state : { ...next, collected: [...state.collected, id] };
    }
  }
  if ("questId" in action) {
    const id = action.questId;
    if (!questId(id)) return state;
    const quest = DEMO_QUESTS.find((entry) => entry.id === id)!;
    if (action.type === "start-quest") {
      if (state.claimedQuests.includes(id)) return state;
      const stop = quest.stops.find((entry) => !state.visited.includes(entry));
      return { ...state, activeQuests: state.activeQuests.includes(id) ? state.activeQuests : [...state.activeQuests, id], route: stop ? { venueId: stop, stage: "walking" } : null };
    }
    if (action.type === "leave-quest") return { ...state, activeQuests: state.activeQuests.filter((entry) => entry !== id) };
    if (action.type === "claim-quest") {
      if (!state.activeQuests.includes(id) || state.claimedQuests.includes(id) || !quest.stops.every((stop) => state.visited.includes(stop))) return state;
      const next = award(state, "quest", id, quest.xp, now);
      return next === state ? state : { ...next, claimedQuests: [...state.claimedQuests, id], activeQuests: state.activeQuests.filter((entry) => entry !== id) };
    }
  }
  if (action.type === "social") {
    const event = action.event;
    if (!validSocialId(event.postId)) return state;
    if (event.kind === "remove-post") return { ...state, ledger: state.ledger.map((entry) => entry.kind === "post" && entry.subject === event.postId ? { ...entry, revoked: true } : entry) };
    const rules = { post: { amount: 25, cap: 3 }, like: { amount: 2, cap: 5 }, comment: { amount: 5, cap: 2 }, share: { amount: 5, cap: 1 } };
    const rule = rules[event.kind];
    if (!rule || (event.kind !== "post" && (!validSocialId(event.authorId) || event.authorId === DEMO_AUTHOR_ID))) return state;
    if (event.kind === "post" && event.authorId && event.authorId !== DEMO_AUTHOR_ID) return state;
    const today = demoDay(now);
    if (state.ledger.filter((entry) => entry.kind === event.kind && entry.day === today).length >= rule.cap) return state;
    return award(state, event.kind, event.postId, rule.amount, now);
  }
  return state;
}

/** Discard malformed or unbounded stores. Numeric XP is always derived, never restored. */
export function parseDemoGame(value: unknown): DemoGameState {
  const empty = createDemoGame();
  if (!value || typeof value !== "object") return empty;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 40 || /[\u0000-\u001f\u007f]/u.test(raw.name)) return empty;
  const list = <T extends string>(input: unknown, valid: (id: string) => id is T, max: number): T[] | null =>
    Array.isArray(input) && input.length <= max && input.every((item) => typeof item === "string" && valid(item)) && new Set(input).size === input.length ? input : null;
  const savedVenues = list(raw.savedVenues, venueId, 6), savedDishes = list(raw.savedDishes, venueId, 6), visited = list(raw.visited, venueId, 6), collected = list(raw.collected, venueId, 6);
  const activeQuests = list(raw.activeQuests, questId, 3), claimedQuests = list(raw.claimedQuests, questId, 3);
  if (!savedVenues || !savedDishes || !visited || !collected || !activeQuests || !claimedQuests || collected.some((id) => !visited.includes(id))) return empty;
  let route: DemoGameState["route"] = null;
  if (raw.route !== null) {
    const candidate = raw.route as Record<string, unknown> | undefined;
    if (!candidate || typeof candidate.venueId !== "string" || !venueId(candidate.venueId) || !["walking", "arrived"].includes(String(candidate.stage))) return empty;
    route = { venueId: candidate.venueId, stage: candidate.stage as "walking" | "arrived" };
  }
  if (!Array.isArray(raw.ledger) || raw.ledger.length > MAX_LEDGER) return empty;
  const ledger: DemoAward[] = [];
  for (const item of raw.ledger) {
    if (!item || typeof item !== "object") return empty;
    const entry = item as DemoAward;
    if (typeof entry.subject !== "string" || typeof entry.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(entry.day) || typeof entry.at !== "string" || entry.at.length > 32 || !Number.isFinite(Date.parse(entry.at)) || entry.day !== demoDay(new Date(entry.at)) || entry.key !== `${entry.kind}:${entry.subject}` || ledger.some((previous) => previous.key === entry.key) || (entry.revoked !== undefined && entry.revoked !== true)) return empty;
    let expected = 0;
    if (entry.kind === "visit" && venueId(entry.subject) && visited.includes(entry.subject)) expected = 50;
    if (entry.kind === "dish" && venueId(entry.subject) && collected.includes(entry.subject)) expected = DEMO_DISH_XP[entry.subject];
    if (entry.kind === "quest" && questId(entry.subject) && claimedQuests.includes(entry.subject)) expected = DEMO_QUESTS.find((quest) => quest.id === entry.subject)!.xp;
    if (entry.kind === "daily" && entry.subject === entry.day) expected = 25;
    if (validSocialId(entry.subject)) expected ||= ({ post: 25, like: 2, comment: 5, share: 5 } as Record<string, number>)[entry.kind] || 0;
    if (!expected || entry.amount !== expected || (entry.revoked && entry.kind !== "post")) return empty;
    ledger.push({ key: entry.key, kind: entry.kind, subject: entry.subject, day: entry.day, at: entry.at, amount: expected, ...(entry.revoked ? { revoked: true as const } : {}) });
  }
  if (visited.some((id) => !ledger.some((entry) => entry.kind === "visit" && entry.subject === id)) || collected.some((id) => !ledger.some((entry) => entry.kind === "dish" && entry.subject === id)) || claimedQuests.some((id) => !ledger.some((entry) => entry.kind === "quest" && entry.subject === id) || !DEMO_QUESTS.find((quest) => quest.id === id)!.stops.every((stop) => visited.includes(stop)))) return empty;
  for (const [kind, cap] of [["post", 3], ["like", 5], ["comment", 2], ["share", 1]] as const) {
    const counts = new Map<string, number>();
    for (const entry of ledger.filter((award) => award.kind === kind)) counts.set(entry.day, (counts.get(entry.day) || 0) + 1);
    if ([...counts.values()].some((count) => count > cap)) return empty;
  }
  return { version: 1, name: raw.name.trim(), savedVenues, savedDishes, visited, collected, activeQuests, claimedQuests, route, ledger };
}
