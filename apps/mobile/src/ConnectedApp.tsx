import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Bookmark, BookOpen, Compass, Flag, MapPin, Search, Store, UserRound, Utensils, X } from "lucide-react-native";
import { fetchMobileCatalogue, type MobileCatalogueConfig, type PublicDish, type PublicVenue } from "./catalogue";

const ink = "#183d32", muted = "#48634f", paper = "#f6f8f2", white = "#ffffff", line = "#d7e3d1";
const accent = "#bde538", actionInk = "#183d32", raised = "#edf6e6", link = "#2f6941";
const tabs = [
  { name: "FoodDex", Icon: BookOpen }, { name: "VenueDex", Icon: Store },
  { name: "Explore", Icon: Compass }, { name: "Quests", Icon: Flag }, { name: "Passport", Icon: UserRound },
] as const;
type Tab = typeof tabs[number]["name"];
type SavedDish = { venue: PublicVenue; dish: PublicDish };
const categories = [{ name: "All places", value: "" }, { name: "Cafes", value: "cafe" }, { name: "Restaurants", value: "restaurant" }, { name: "Markets", value: "market" }];

export function ConnectedFoodGo({ config }: { config: MobileCatalogueConfig }) {
  const [tab, setTab] = useState<Tab>("Explore");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [venues, setVenues] = useState<PublicVenue[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savedVenues, setSavedVenues] = useState<PublicVenue[]>([]);
  const [savedDishes, setSavedDishes] = useState<SavedDish[]>([]);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollViewInstance | null>(null);

  async function load(nextQuery = query, nextType = type) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 12000);
    setStatus("loading"); setVenues([]); setHasMore(false); setExpanded(null);
    try {
      const result = await fetchMobileCatalogue(config, { query: nextQuery, type: nextType }, { signal: controller.signal });
      if (controller.signal.aborted || request.current !== controller) return;
      setVenues(result.venues); setHasMore(result.hasMore); setStatus("ready");
    } catch {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) setStatus("error");
    } finally { clearTimeout(timeout); }
  }
  useEffect(() => {
    void load("", "");
    return () => request.current?.abort();
  }, [config]);

  function navigate(next: Tab) { setTab(next); scroll.current?.scrollTo({ y: 0, animated: false }); }
  function saveVenue(venue: PublicVenue) {
    setSavedVenues((current) => current.some((item) => item.id === venue.id) ? current.filter((item) => item.id !== venue.id) : [...current, venue].slice(-100));
  }
  function saveDish(venue: PublicVenue, dish: PublicDish) {
    setSavedDishes((current) => current.some((item) => item.dish.id === dish.id) ? current.filter((item) => item.dish.id !== dish.id) : [...current, { venue, dish }].slice(-100));
  }
  const dishes = venues.flatMap((venue) => venue.dishes.map((dish) => ({ venue, dish })));
  const connection = status === "loading" ? <Text style={styles.notice} accessibilityRole="alert">Loading published places…</Text>
    : status === "error" ? <Empty title="Places are temporarily unavailable" description="We could not load the public catalogue. Please try again shortly." action="Try again" onPress={() => void load()} /> : null;

  function dishCard({ venue, dish }: SavedDish) {
    const saved = savedDishes.some((item) => item.dish.id === dish.id);
    return <View key={dish.id} style={styles.card}>
      <Text style={styles.label}>{venue.cuisine}</Text><Text style={styles.cardTitle}>{dish.name}</Text>
      <Text style={styles.body}>{venue.name}, {venue.suburb}, {venue.state}</Text>
      {!!dish.description && <Text style={styles.body}>{dish.description}</Text>}
      {dish.priceAudCents !== null && <Text style={styles.price}>AUD ${(dish.priceAudCents / 100).toFixed(2)}</Text>}
      <Action label={saved ? "Saved to try" : "Save dish"} selected={saved} onPress={() => saveDish(venue, dish)} />
    </View>;
  }
  function venueCard(venue: PublicVenue) {
    const saved = savedVenues.some((item) => item.id === venue.id);
    const open = expanded === venue.id;
    return <View key={venue.id} style={styles.card}>
      <View style={styles.cardTop}><View style={styles.placeholder} accessibilityLabel="Venue photograph not supplied"><Utensils size={26} color={ink} /></View>
        <View style={styles.flex}><Text style={styles.label}>{venue.cuisine}</Text><Text style={styles.cardTitle}>{venue.name}</Text>
          <Text style={styles.body}>{venue.suburb}, {venue.state} · {venue.type === "cafe" ? "Cafe" : venue.type === "market" ? "Food market" : "Restaurant"}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={() => saveVenue(venue)} accessibilityRole="button" accessibilityLabel={`${saved ? "Unsave" : "Save"} ${venue.name}`} accessibilityState={{ selected: saved }}>
          <Bookmark size={22} color={ink} fill={saved ? ink : "none"} />
        </Pressable>
      </View>
      <Pressable style={styles.detailsButton} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : venue.id)}>
        <Text style={styles.actionText}>{open ? "Close details" : "Venue details and menu"}</Text><ArrowRight size={18} color={ink} />
      </Pressable>
      {open && <View style={styles.details}>
        {!!venue.description && <Text style={styles.body}>{venue.description}</Text>}
        <Text style={styles.body}>{venue.address}, {venue.suburb}, {venue.state} {venue.postcode}</Text>
        <Text style={styles.small}>Confirm hours, menu availability and dietary needs directly with the venue.</Text>
        <Text style={styles.sectionTitle}>Available dishes</Text>
        {venue.dishes.length ? venue.dishes.map((dish) => dishCard({ venue, dish })) : <Text style={styles.body}>No available menu items have been added yet.</Text>}
      </View>}
    </View>;
  }

  return <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
    <StatusBar barStyle="dark-content" />
    <View style={styles.header}><Pressable onPress={() => navigate("Explore")} style={styles.brandButton} accessibilityRole="button" accessibilityLabel="Food Go home"><Text style={styles.brand}>foodgo.</Text></Pressable>
      <Text style={styles.headerLabel}>Public catalogue</Text><Pressable style={styles.iconButton} onPress={() => navigate("Passport")} accessibilityRole="button" accessibilityLabel="Open guest passport"><UserRound size={22} color={ink} /></Pressable>
    </View>
    <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {tab === "Explore" && <>
        <View style={styles.location}><MapPin size={16} color={link} /><Text style={styles.label}>Australia · Published venues</Text></View>
        <Text style={styles.title}>Where are we eating?</Text><Text style={styles.intro}>Find a place, pick a dish, plan your next stop.</Text>
        <View style={styles.search}><Search size={20} color={muted} /><TextInput style={styles.input} value={query} onChangeText={setQuery} maxLength={100}
          placeholder="Search a place, suburb or cuisine" placeholderTextColor={muted} selectionColor={link} accessibilityLabel="Search venue names, suburbs or cuisines" returnKeyType="search" autoCapitalize="none" onSubmitEditing={() => void load()} />
          {!!query && <Pressable style={styles.iconButton} onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search"><X size={18} color={ink} /></Pressable>}
        </View>
        <View style={styles.filters}>{categories.map((item) => <Pressable key={item.name} style={[styles.filter, type === item.value && styles.filterSelected]} onPress={() => { setType(item.value); void load(query, item.value); }} accessibilityRole="button" accessibilityState={{ selected: type === item.value }}>
          <Text style={[styles.filterText, type === item.value && styles.filterSelectedText]}>{item.name}</Text>
        </Pressable>)}</View>
        <Action label="Search places" onPress={() => void load()} />
        <Text style={styles.notice}>List view. Live maps and directions are not connected. Venue photographs have not been supplied.</Text>
        {connection}
        {status === "ready" && <><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Places to explore</Text><Text style={styles.small}>{venues.length}{hasMore ? "+" : ""} places</Text></View>
          {venues.length ? venues.map(venueCard) : <Empty title="No published places found" description="Try another suburb or cuisine. Places appear after ownership and listing approval." action="Clear search" onPress={() => { setQuery(""); setType(""); void load("", ""); }} />}
          {hasMore && <Text style={styles.notice}>Showing the first 50 matching venues. Add a suburb or cuisine to narrow the search.</Text>}
        </>}
      </>}
      {tab === "FoodDex" && <>
        <Heading label="FoodDex" title="Dishes to try" description="Available menu items from your latest venue search, with a separate list of dishes saved this session." />
        <View style={styles.stats}><Stat value={savedDishes.length} label="Saved dishes" /><Stat value={0} label="Verified dishes" /></View>
        {savedDishes.length > 0 && <><Text style={styles.sectionTitle}>Saved to try</Text>{savedDishes.map(dishCard)}</>}
        <Text style={styles.sectionTitle}>From your latest search</Text>{connection}
        {status === "ready" && (dishes.length ? dishes.map(dishCard) : <Text style={styles.notice}>No available menu items in these results. Try another venue search.</Text>)}
        <Text style={styles.notice}>A dish save does not save its venue or mark the dish as eaten. Saved menu details reflect the time they were loaded.</Text>
      </>}
      {tab === "VenueDex" && <>
        <Heading label="VenueDex" title="Saved places" description="The places you bookmarked during this app session." />
        <View style={styles.stats}><Stat value={savedVenues.length} label="Saved places" /><Stat value={0} label="Verified visits" /></View>
        {savedVenues.length ? savedVenues.map(venueCard) : <Empty title="Nothing saved yet" description="Bookmark a published venue to keep it here for this session." action="Explore places" onPress={() => navigate("Explore")} />}
        <Text style={styles.notice}>A saved place is a plan, not a verified visit. Saved details reflect the time they were loaded; confirm changes with the venue.</Text>
      </>}
      {tab === "Quests" && <><Heading label="Quests and trails" title="More places to discover" description="Connected food trails are being prepared." />
        <Empty title="No connected trails yet" description="Verified visits, dish discoveries and quest rewards need secure check-ins. Exploring or saving a place does not award points." action="Explore places" onPress={() => navigate("Explore")} />
      </>}
      {tab === "Passport" && <>
        <Heading label="Your food passport" title="Guest explorer" description="Public venue discovery without a connected mobile account." />
        <View style={styles.stats}><Stat value={savedVenues.length} label="Saved places" /><Stat value={savedDishes.length} label="Saved dishes" /></View>
        <Text style={styles.sectionTitle}>Your plans stay in this session</Text>
        <Text style={styles.body}>Saved venues and dishes are held in app memory and clear when the app closes. They are not sent to an account or synced to the website.</Text>
        <Action label="Clear saved places and dishes" onPress={() => { setSavedVenues([]); setSavedDishes([]); setNotice("Your session saves have been cleared."); }} />
        {!!notice && <Text style={styles.notice} accessibilityRole="alert">{notice}</Text>}
        <Text style={styles.notice}>The public catalogue uses approved venue records. Accounts, permanent saves, live maps, camera scanning and verified rewards are not connected in this mobile app. No camera, microphone or location permission is requested.</Text>
      </>}
    </ScrollView>
    <View style={styles.tabBar} accessibilityRole="tablist">{tabs.map(({ name, Icon }) => <Pressable key={name} style={styles.tab} accessibilityRole="tab" accessibilityLabel={name} accessibilityState={{ selected: tab === name }} onPress={() => navigate(name)}>
      <Icon size={22} color={tab === name || name === "Explore" ? link : muted} strokeWidth={tab === name ? 2.3 : 1.7} /><Text style={[styles.tabLabel, (tab === name || name === "Explore") && styles.tabSelected]}>{name}</Text>
      <View style={[styles.indicator, tab === name && styles.indicatorSelected]} />
    </Pressable>)}</View>
  </SafeAreaView>;
}

function Heading({ label, title, description }: { label: string; title: string; description: string }) {
  return <><Text style={styles.label}>{label}</Text><Text style={styles.title}>{title}</Text><Text style={styles.intro}>{description}</Text></>;
}
function Stat({ value, label }: { value: number; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.small}>{label}</Text></View>;
}
function Action({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.action, selected && styles.actionSelected]} accessibilityRole="button" accessibilityState={selected === undefined ? undefined : { selected }} onPress={onPress}>
    <Text style={styles.actionText}>{label}</Text><ArrowRight size={18} color={ink} />
  </Pressable>;
}
function Empty({ title, description, action, onPress }: { title: string; description: string; action: string; onPress: () => void }) {
  return <View style={styles.empty}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{description}</Text><Action label={action} onPress={onPress} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: paper }, flex: { flex: 1, minWidth: 0 },
  header: { height: 66, flexDirection: "row", alignItems: "center", paddingHorizontal: 22, gap: 12, borderBottomWidth: 1, borderBottomColor: line },
  brandButton: { minHeight: 44, justifyContent: "center" }, brand: { fontSize: 29, fontWeight: "800", color: ink, letterSpacing: -1.6 },
  headerLabel: { marginLeft: "auto", color: muted, fontSize: 12 }, iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { padding: 22, paddingBottom: 32, gap: 16 }, title: { fontSize: 34, lineHeight: 39, letterSpacing: -1.4, fontWeight: "800", color: ink },
  intro: { fontSize: 15, lineHeight: 23, color: muted, marginBottom: 4 }, label: { color: link, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  location: { flexDirection: "row", gap: 7, alignItems: "center" }, search: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, minHeight: 54, borderWidth: 1, borderColor: line, backgroundColor: white, borderRadius: 9 },
  input: { flex: 1, minWidth: 0, minHeight: 50, color: ink, fontSize: 14 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: { paddingHorizontal: 12, minHeight: 44, justifyContent: "center", borderRadius: 7, borderWidth: 1, borderColor: line }, filterSelected: { backgroundColor: accent, borderColor: accent },
  filterText: { fontSize: 13, fontWeight: "600", color: ink }, filterSelectedText: { color: actionInk }, sectionHeading: { flexDirection: "row", gap: 10, justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: "700", color: ink }, card: { backgroundColor: white, padding: 16, borderWidth: 1, borderColor: line, borderRadius: 10, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 }, placeholder: { width: 52, height: 62, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: raised },
  cardTitle: { fontSize: 19, fontWeight: "700", lineHeight: 25, color: ink }, body: { fontSize: 14, lineHeight: 22, color: muted }, small: { fontSize: 12, lineHeight: 19, color: muted },
  detailsButton: { minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: line, gap: 12, paddingTop: 8 },
  details: { gap: 12 }, price: { fontSize: 15, color: ink, fontWeight: "700" }, action: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: line, borderRadius: 7, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, backgroundColor: white },
  actionSelected: { backgroundColor: raised, borderColor: "#88a846" }, actionText: { flexShrink: 1, fontSize: 14, fontWeight: "600", lineHeight: 21, color: ink }, notice: { color: muted, fontSize: 13, lineHeight: 21, paddingVertical: 8 },
  empty: { padding: 20, borderWidth: 1, borderColor: line, borderRadius: 10, gap: 14, backgroundColor: white }, stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, padding: 16, backgroundColor: raised, borderRadius: 8, gap: 5 }, statValue: { fontSize: 28, color: ink, fontWeight: "800" },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: line, backgroundColor: white, paddingTop: 8, paddingBottom: 4 },
  tab: { flex: 1, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 5 }, tabLabel: { fontSize: 10, color: muted }, tabSelected: { color: link, fontWeight: "700" },
  indicator: { height: 3, width: 18, borderRadius: 2 }, indicatorSelected: { backgroundColor: link },
});
