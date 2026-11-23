import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Compass,
  Flag,
  MapPin,
  Search,
  Store,
  UserRound,
  Utensils,
  Tag,
  Tractor,
  Layers,
  Sparkles,
  ShieldCheck,
  Check,
  X,
} from "lucide-react-native";
import {
  fetchMobileCatalogue,
  type MobileCatalogueConfig,
  type PublicDish,
  type PublicVenue,
} from "./catalogue";
import { getAllMalls, type MallData, type MallShopUnit } from "@food-go/domain";

const ink = "#183d32",
  muted = "#48634f",
  paper = "#f6f8f2",
  white = "#ffffff",
  line = "#d7e3d1";
const accent = "#bde538",
  actionInk = "#183d32",
  raised = "#edf6e6",
  link = "#2f6941",
  gold = "#ffd445";

export const primaryTabs = [
  { name: "Feed", Icon: BookOpen },
  { name: "Quests", Icon: Flag },
  { name: "Explore", Icon: Compass },
  { name: "Deals", Icon: Tag },
  { name: "Outback", Icon: Tractor },
] as const;
export type PrimaryTab = typeof primaryTabs[number]["name"];

type SavedDish = { venue: PublicVenue; dish: PublicDish };
const categories = [
  { name: "All places", value: "" },
  { name: "Cafes", value: "cafe" },
  { name: "Restaurants", value: "restaurant" },
  { name: "Markets", value: "market" },
];

export function ConnectedFoodGo({ config }: { config: MobileCatalogueConfig }) {
  const [tab, setTab] = useState<PrimaryTab>("Explore");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [venues, setVenues] = useState<PublicVenue[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savedVenues, setSavedVenues] = useState<PublicVenue[]>([]);
  const [savedDishes, setSavedDishes] = useState<SavedDish[]>([]);
  const [selectedMall, setSelectedMall] = useState<MallData | null>(null);
  const [mallFloor, setMallFloor] = useState<string>("g");
  const [passportOpen, setPassportOpen] = useState(false);
  const [avatarLook, setAvatarLook] = useState<string>("Pathfinder");
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollViewInstance | null>(null);

  async function load(nextQuery = query, nextType = type) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    setStatus("loading");
    setVenues([]);
    setHasMore(false);
    setExpanded(null);
    try {
      const result = await fetchMobileCatalogue(
        config,
        { query: nextQuery, type: nextType },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || request.current !== controller) return;
      setVenues(result.venues);
      setHasMore(result.hasMore);
      setStatus("ready");
    } catch {
      if (
        request.current === controller &&
        (!controller.signal.aborted || timedOut)
      )
        setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  useEffect(() => {
    void load("", "");
    return () => request.current?.abort();
  }, [config]);

  function navigate(next: PrimaryTab) {
    setPassportOpen(false);
    setSelectedMall(null);
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function saveVenue(venue: PublicVenue) {
    setSavedVenues((current) =>
      current.some((item) => item.id === venue.id)
        ? current.filter((item) => item.id !== venue.id)
        : [...current, venue].slice(-100)
    );
  }

  function saveDish(venue: PublicVenue, dish: PublicDish) {
    setSavedDishes((current) =>
      current.some((item) => item.dish.id === dish.id)
        ? current.filter((item) => item.dish.id !== dish.id)
        : [...current, { venue, dish }].slice(-100)
    );
  }

  const dishes = venues.flatMap((venue) =>
    venue.dishes.map((dish) => ({ venue, dish }))
  );
  const malls = getAllMalls();

  const connection =
    status === "loading" ? (
      <Text style={styles.notice} accessibilityRole="alert">
        Loading published places…
      </Text>
    ) : status === "error" ? (
      <Empty
        title="Places are temporarily unavailable"
        description="We could not load the public catalogue. Please try again shortly."
        action="Try again"
        onPress={() => void load()}
      />
    ) : null;

  function dishCard({ venue, dish }: SavedDish) {
    const saved = savedDishes.some((item) => item.dish.id === dish.id);
    return (
      <View key={dish.id} style={styles.card}>
        <Text style={styles.label}>{venue.cuisine}</Text>
        <Text style={styles.cardTitle}>{dish.name}</Text>
        <Text style={styles.body}>
          {venue.name}, {venue.suburb}, {venue.state}
        </Text>
        {!!dish.description && <Text style={styles.body}>{dish.description}</Text>}
        {dish.priceAudCents !== null && (
          <Text style={styles.price}>
            AUD ${(dish.priceAudCents / 100).toFixed(2)}
          </Text>
        )}
        <Action
          label={saved ? "Saved to try" : "Save dish"}
          selected={saved}
          onPress={() => saveDish(venue, dish)}
        />
      </View>
    );
  }

  function venueCard(venue: PublicVenue) {
    const saved = savedVenues.some((item) => item.id === venue.id);
    const open = expanded === venue.id;
    return (
      <View key={venue.id} style={styles.card}>
        <View style={styles.cardTop}>
          <View
            style={styles.placeholder}
            accessibilityLabel="Venue photograph not supplied"
          >
            <Utensils size={26} color={ink} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>{venue.cuisine}</Text>
            <Text style={styles.cardTitle}>{venue.name}</Text>
            <Text style={styles.body}>
              {venue.suburb}, {venue.state} ·{" "}
              {venue.type === "cafe"
                ? "Cafe"
                : venue.type === "market"
                ? "Food market"
                : "Restaurant"}
            </Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={() => saveVenue(venue)}
            accessibilityRole="button"
            accessibilityLabel={`${saved ? "Unsave" : "Save"} ${venue.name}`}
            accessibilityState={{ selected: saved }}
          >
            <Bookmark size={22} color={ink} fill={saved ? ink : "none"} />
          </Pressable>
        </View>
        <Pressable
          style={styles.detailsButton}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setExpanded(open ? null : venue.id)}
        >
          <Text style={styles.actionText}>
            {open ? "Close details" : "Venue details and menu"}
          </Text>
          <ArrowRight size={18} color={ink} />
        </Pressable>
        {open && (
          <View style={styles.details}>
            {!!venue.description && (
              <Text style={styles.body}>{venue.description}</Text>
            )}
            <Text style={styles.body}>
              {venue.address}, {venue.suburb}, {venue.state} {venue.postcode}
            </Text>
            <Text style={styles.small}>
              Confirm hours, menu availability and dietary needs directly with
              the venue.
            </Text>
            <Text style={styles.sectionTitle}>Available dishes</Text>
            {venue.dishes.length ? (
              venue.dishes.map((dish) => dishCard({ venue, dish }))
            ) : (
              <Text style={styles.body}>
                No available menu items have been added yet.
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable
          onPress={() => navigate("Explore")}
          style={styles.brandButton}
          accessibilityRole="button"
          accessibilityLabel="Food Go home"
        >
          <Text style={styles.brand}>foodgo.</Text>
        </Pressable>
        <Text style={styles.headerLabel}>Australia</Text>
        <Pressable
          style={[styles.iconButton, passportOpen && styles.iconButtonActive]}
          onPress={() => setPassportOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Open Passport profile"
        >
          <UserRound size={22} color={ink} />
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Passport Profile Drawer */}
        {passportOpen ? (
          <>
            <Heading
              label="Passport"
              title="Your Food Passport"
              description="Progress, saved stops and personal explorer identity."
            />
            <View style={styles.stats}>
              <Stat value={1} label="Explorer Level" />
              <Stat value={0} label="Verified XP" />
              <Stat value={savedVenues.length} label="Saved Venues" />
            </View>

            <Text style={styles.sectionTitle}>Explorer Appearance</Text>
            <View style={styles.filters}>
              {["Pathfinder", "Foodie", "Trailblazer", "Anime Sky", "Anime Violet"].map(
                (look) => (
                  <Pressable
                    key={look}
                    style={[
                      styles.filter,
                      avatarLook === look && styles.filterSelected,
                    ]}
                    onPress={() => setAvatarLook(look)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        avatarLook === look && styles.filterSelectedText,
                      ]}
                    >
                      {look}
                    </Text>
                  </Pressable>
                )
              )}
            </View>

            <Text style={styles.sectionTitle}>
              Saved Collections ({savedVenues.length + savedDishes.length})
            </Text>
            {savedVenues.length > 0 && (
              <>
                <Text style={styles.bodyMuted}>VenueDex bookmarks:</Text>
                {savedVenues.map(venueCard)}
              </>
            )}
            {savedDishes.length > 0 && (
              <>
                <Text style={styles.bodyMuted}>FoodDex dish ideas:</Text>
                {savedDishes.map(dishCard)}
              </>
            )}
            {savedVenues.length === 0 && savedDishes.length === 0 && (
              <Text style={styles.notice}>
                You have not saved any venues or dishes yet.
              </Text>
            )}

            <Action
              label="Clear saved places and dishes"
              onPress={() => {
                setSavedVenues([]);
                setSavedDishes([]);
                setNotice("Session saves have been cleared.");
              }}
            />
            {!!notice && (
              <Text style={styles.notice} accessibilityRole="alert">
                {notice}
              </Text>
            )}
          </>
        ) : selectedMall ? (
          /* Shopping Mall Interactive Directory */
          <>
            <Pressable
              onPress={() => setSelectedMall(null)}
              style={styles.backButton}
            >
              <Text style={styles.actionText}>← Back to Explore</Text>
            </Pressable>
            <Heading
              label="Approved Shopping Mall"
              title={selectedMall.name}
              description={`${selectedMall.entrance.streetName} · ${selectedMall.entrance.description}`}
            />
            <Text style={styles.sectionTitle}>Select Mall Floor</Text>
            <View style={styles.filters}>
              {selectedMall.floors.map((floor) => (
                <Pressable
                  key={floor.id}
                  style={[
                    styles.filter,
                    mallFloor === floor.id && styles.filterSelected,
                  ]}
                  onPress={() => setMallFloor(floor.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      mallFloor === floor.id && styles.filterSelectedText,
                    ]}
                  >
                    {floor.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>
              Floor Directory (
              {
                selectedMall.shops.filter((s) => s.floorId === mallFloor).length
              }{" "}
              shops)
            </Text>
            {selectedMall.shops
              .filter((s) => s.floorId === mallFloor)
              .map((shop) => (
                <View key={shop.id} style={styles.card}>
                  <Text style={styles.label}>{shop.unitNumber}</Text>
                  <Text style={styles.cardTitle}>{shop.name}</Text>
                  <Text style={styles.body}>
                    {shop.category} {shop.cuisine ? `· ${shop.cuisine}` : ""}
                  </Text>
                </View>
              ))}

            {selectedMall.quests.filter((q) => q.floorId === mallFloor).length >
              0 && (
              <>
                <Text style={styles.sectionTitle}>Floor Quests</Text>
                {selectedMall.quests
                  .filter((q) => q.floorId === mallFloor)
                  .map((quest) => (
                    <View key={quest.id} style={styles.questCard}>
                      <Text style={styles.cardTitle}>{quest.title}</Text>
                      <Text style={styles.body}>{quest.description}</Text>
                      <Text style={styles.xpBadge}>+{quest.rewardXp} XP</Text>
                    </View>
                  ))}
              </>
            )}
          </>
        ) : tab === "Feed" ? (
          /* Feed Tab */
          <>
            <Heading
              label="Community Feed"
              title="Australian Food Stories"
              description="Thoughts, food finds and honest community reviews from foodies aged 16+."
            />
            <View style={styles.card}>
              <View style={styles.row}>
                <ShieldCheck size={20} color={link} />
                <Text style={styles.label}>Age Notice</Text>
              </View>
              <Text style={styles.body}>
                Community participation and Feed access require a signed-in
                account aged 16 or over. Respectful, truthful reviews and
                criticism are welcome.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Community Highlights</Text>
            <View style={styles.card}>
              <Text style={styles.label}>Melbourne CBD · Breakfast Thought</Text>
              <Text style={styles.cardTitle}>The Best Flat White in Degraves</Text>
              <Text style={styles.body}>
                "The morning rush here has an energy like nowhere else. Steamed
                milk texture was silky smooth, zero bitterness. 10/10 start to the
                day."
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Carlton · Hidden Gem</Text>
              <Text style={styles.cardTitle}>Wood-Fired Perfection</Text>
              <Text style={styles.body}>
                "Found a small pizzeria tucked off Lygon Street with naturally
                fermented dough. Crisp leopard-spotted crust with fresh basil."
              </Text>
            </View>
          </>
        ) : tab === "Quests" ? (
          /* Quests Tab */
          <>
            <Heading
              label="Quests & Trails"
              title="Melbourne Food Quests"
              description="Complete genuine restaurant support requests across exploration, dishes and stories."
            />
            <View style={styles.questCard}>
              <Text style={styles.label}>Exploration Milestone</Text>
              <Text style={styles.cardTitle}>Melbourne Laneway Odyssey</Text>
              <Text style={styles.body}>
                Explore 3 verified Melbourne CBD laneway venues and log your visit.
              </Text>
              <Text style={styles.xpBadge}>+150 XP Reward</Text>
            </View>

            <View style={styles.questCard}>
              <Text style={styles.label}>Dish Discovery</Text>
              <Text style={styles.cardTitle}>The Artisanal Bakery Hunt</Text>
              <Text style={styles.body}>
                Try a certified pastry or artisanal sourdough loaf at a local bakery.
              </Text>
              <Text style={styles.xpBadge}>+100 XP Reward</Text>
            </View>
          </>
        ) : tab === "Explore" ? (
          /* Explore Tab */
          <>
            <View style={styles.location}>
              <MapPin size={16} color={link} />
              <Text style={styles.label}>Melbourne Geographic Region</Text>
            </View>
            <Text style={styles.title}>Where are we eating?</Text>
            <Text style={styles.intro}>
              Explore verified restaurants, approved malls and real street paths.
            </Text>

            {/* Approved Shopping Malls Section */}
            <Text style={styles.sectionTitle}>Approved Shopping Malls</Text>
            <View style={styles.filters}>
              {malls.map((mall) => (
                <Pressable
                  key={mall.id}
                  style={styles.mallButton}
                  onPress={() => {
                    setSelectedMall(mall);
                    setMallFloor(mall.floors[0]?.id ?? "g");
                  }}
                >
                  <Layers size={16} color={ink} />
                  <Text style={styles.mallButtonText}>{mall.name}</Text>
                  <ArrowRight size={14} color={muted} />
                </Pressable>
              ))}
            </View>

            <View style={styles.search}>
              <Search size={20} color={muted} />
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                maxLength={100}
                placeholder="Search a place, suburb or cuisine"
                placeholderTextColor={muted}
                selectionColor={link}
                accessibilityLabel="Search venue names, suburbs or cuisines"
                returnKeyType="search"
                autoCapitalize="none"
                onSubmitEditing={() => void load()}
              />
              {!!query && (
                <Pressable
                  style={styles.iconButton}
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <X size={18} color={ink} />
                </Pressable>
              )}
            </View>
            <View style={styles.filters}>
              {categories.map((item) => (
                <Pressable
                  key={item.name}
                  style={[
                    styles.filter,
                    type === item.value && styles.filterSelected,
                  ]}
                  onPress={() => {
                    setType(item.value);
                    void load(query, item.value);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === item.value }}
                >
                  <Text
                    style={[
                      styles.filterText,
                      type === item.value && styles.filterSelectedText,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Action label="Search places" onPress={() => void load()} />

            {connection}
            {status === "ready" && (
              <>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Published Venues</Text>
                  <Text style={styles.small}>
                    {venues.length}
                    {hasMore ? "+" : ""} places
                  </Text>
                </View>
                {venues.length ? (
                  venues.map(venueCard)
                ) : (
                  <Empty
                    title="No published places found"
                    description="Try another suburb or cuisine. Places appear after ownership and listing approval."
                    action="Clear search"
                    onPress={() => {
                      setQuery("");
                      setType("");
                      void load("", "");
                    }}
                  />
                )}
                {hasMore && (
                  <Text style={styles.notice}>
                    Showing the first 50 matching venues. Add a suburb or cuisine
                    to narrow search.
                  </Text>
                )}
              </>
            )}
          </>
        ) : tab === "Deals" ? (
          /* Deals Tab */
          <>
            <Heading
              label="Exclusive Deals"
              title="Verified Venue Offers"
              description="Official operator-reviewed dining promotions and time-limited deals."
            />
            <View style={styles.card}>
              <Text style={styles.label}>Featured Offer · Melbourne CBD</Text>
              <Text style={styles.cardTitle}>Weekday Lunch Specialty</Text>
              <Text style={styles.body}>
                Enjoy complimentary house-brewed iced tea with any main noodle dish
                between 11:30 AM and 2:30 PM, Monday to Thursday.
              </Text>
              <Text style={styles.small}>
                Valid through 30 November 2026 · Verified partner venue
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Coffee Roasters Deal · Fitzroy</Text>
              <Text style={styles.cardTitle}>Double Discovery Bonus</Text>
              <Text style={styles.body}>
                Receive a commemorative explorer stamp and +50 bonus XP when trying
                the single-origin filter flight.
              </Text>
              <Text style={styles.small}>
                Valid during opening hours · 1 claim per customer per week
              </Text>
            </View>
          </>
        ) : (
          /* Outback Tab */
          <>
            <Heading
              label="Outback Village"
              title="Australian Farm Homestead"
              description="Your permanent 16-plot isometric Australian farm. Clearing, upgrades and harvests use server time."
            />
            <View style={styles.card}>
              <Text style={styles.label}>Homestead Status</Text>
              <Text style={styles.cardTitle}>Level 1 Farmhouse & Orchard</Text>
              <Text style={styles.body}>
                Plots: 4 cleared, 12 bushland · Water Tank: Full · Silo: Ready for
                harvest
              </Text>
              <Text style={styles.small}>
                Daily supplies refresh on the Sydney calendar at midnight.
              </Text>
            </View>
            <View style={styles.stats}>
              <Stat value={4} label="Active Plots" />
              <Stat value={100} label="Lumber" />
              <Stat value={250} label="Water" />
            </View>
          </>
        )}
      </ScrollView>

      {/* Primary Bottom Navigation Bar: Feed | Quests | Explore | Deals | Outback */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        {primaryTabs.map(({ name, Icon }) => (
          <Pressable
            key={name}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={name}
            accessibilityState={{ selected: tab === name && !passportOpen }}
            onPress={() => navigate(name)}
          >
            <Icon
              size={22}
              color={tab === name && !passportOpen ? link : muted}
              strokeWidth={tab === name && !passportOpen ? 2.3 : 1.7}
            />
            <Text
              style={[
                styles.tabLabel,
                tab === name && !passportOpen && styles.tabSelected,
              ]}
            >
              {name}
            </Text>
            <View
              style={[
                styles.indicator,
                tab === name && !passportOpen && styles.indicatorSelected,
              ]}
            />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Heading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.intro}>{description}</Text>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function Action({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.action, selected && styles.actionSelected]}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
    >
      <Text style={styles.actionText}>{label}</Text>
      <ArrowRight size={18} color={ink} />
    </Pressable>
  );
}

function Empty({
  title,
  description,
  action,
  onPress,
}: {
  title: string;
  description: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
      <Action label={action} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: paper },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  header: {
    height: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: line,
  },
  brandButton: { minHeight: 44, justifyContent: "center" },
  brand: { fontSize: 29, fontWeight: "800", color: ink, letterSpacing: -1.6 },
  headerLabel: { marginLeft: "auto", color: muted, fontSize: 12 },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  iconButtonActive: { backgroundColor: raised },
  content: { padding: 22, paddingBottom: 32, gap: 16 },
  title: {
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1.4,
    fontWeight: "800",
    color: ink,
  },
  intro: { fontSize: 15, lineHeight: 23, color: muted, marginBottom: 4 },
  label: { color: link, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  location: { flexDirection: "row", gap: 7, alignItems: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    minHeight: 54,
    borderWidth: 1,
    borderColor: line,
    backgroundColor: white,
    borderRadius: 9,
  },
  input: { flex: 1, minWidth: 0, minHeight: 50, color: ink, fontSize: 14 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filter: {
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 7,
    borderWidth: 1,
    borderColor: line,
  },
  filterSelected: { backgroundColor: accent, borderColor: accent },
  filterText: { fontSize: 13, fontWeight: "600", color: ink },
  filterSelectedText: { color: actionInk },
  mallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: raised,
    borderWidth: 1,
    borderColor: line,
  },
  mallButtonText: { fontSize: 13, fontWeight: "700", color: ink },
  backButton: { paddingVertical: 8 },
  sectionHeading: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 20, lineHeight: 27, fontWeight: "700", color: ink },
  card: {
    backgroundColor: white,
    padding: 16,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 10,
    gap: 10,
  },
  questCard: {
    backgroundColor: "#fffdf3",
    padding: 16,
    borderWidth: 1,
    borderColor: "#fae892",
    borderLeftWidth: 4,
    borderLeftColor: gold,
    borderRadius: 10,
    gap: 6,
  },
  xpBadge: {
    fontSize: 12,
    fontWeight: "800",
    color: "#80500c",
    backgroundColor: "#fff1c2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  placeholder: {
    width: 52,
    height: 62,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: raised,
  },
  cardTitle: { fontSize: 19, fontWeight: "700", lineHeight: 25, color: ink },
  body: { fontSize: 14, lineHeight: 22, color: muted },
  bodyMuted: { fontSize: 13, color: muted, fontStyle: "italic" },
  small: { fontSize: 12, lineHeight: 19, color: muted },
  detailsButton: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: line,
    gap: 12,
    paddingTop: 8,
  },
  details: { gap: 12 },
  price: { fontSize: 15, color: ink, fontWeight: "700" },
  action: {
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: white,
  },
  actionSelected: { backgroundColor: raised, borderColor: "#88a846" },
  actionText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    color: ink,
  },
  notice: { color: muted, fontSize: 13, lineHeight: 21, paddingVertical: 8 },
  empty: {
    padding: 20,
    borderWidth: 1,
    borderColor: line,
    borderRadius: 10,
    gap: 14,
    backgroundColor: white,
  },
  stats: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    padding: 16,
    backgroundColor: raised,
    borderRadius: 8,
    gap: 5,
  },
  statValue: { fontSize: 28, color: ink, fontWeight: "800" },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: line,
    backgroundColor: white,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  tabLabel: { fontSize: 10, color: muted },
  tabSelected: { color: link, fontWeight: "700" },
  indicator: { height: 3, width: 18, borderRadius: 2 },
  indicatorSelected: { backgroundColor: link },
});
