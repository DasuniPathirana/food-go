import { useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Coffee,
  Compass,
  Flag,
  Leaf,
  Map,
  MapPin,
  Search,
  ShieldCheck,
  Store,
  User,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { DishArtwork, NeighbourhoodMap } from "./src/Illustrations";
import { quests, venues, type Venue } from "./src/data";

type Tab = "Map" | "FoodDex" | "Quests" | "VenueDex" | "Profile";
type Filter = "All places" | "Cafes" | "Restaurants";
const tabs: { name: Tab; Icon: LucideIcon }[] = [
  { name: "Map", Icon: Map },
  { name: "FoodDex", Icon: BookOpen },
  { name: "Quests", Icon: Flag },
  { name: "VenueDex", Icon: Store },
  { name: "Profile", Icon: User },
];
const filters: Filter[] = ["All places", "Cafes", "Restaurants"];

export default function App() {
  return (
    <SafeAreaProvider>
      <FoodGo />
    </SafeAreaProvider>
  );
}

function FoodGo() {
  const [tab, setTab] = useState<Tab>("Map");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All places");
  const [selectedId, setSelectedId] = useState("fern");
  const [savedVenueIds, setSavedVenueIds] = useState<string[]>([]);
  const [savedDishIds, setSavedDishIds] = useState<string[]>([]);
  const [activeQuestIds, setActiveQuestIds] = useState<string[]>([]);
  const [privateProfile, setPrivateProfile] = useState(true);
  const scroll = useRef<ScrollViewInstance | null>(null);
  const filteredVenues = venues.filter((venue) => {
    const categoryMatch =
      filter === "All places" ||
      (filter === "Cafes"
        ? venue.category === "Cafe"
        : venue.category === "Restaurant");
    return (
      categoryMatch &&
      `${venue.name} ${venue.neighbourhood} ${venue.cuisine} ${venue.dish}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );
  });
  const selectedVenue =
    filteredVenues.find((venue) => venue.id === selectedId) ??
    filteredVenues[0];

  function navigate(next: Tab) {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function toggleSavedVenue(id: string) {
    setSavedVenueIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  function toggleSavedDish(id: string) {
    setSavedDishIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  function toggleQuest(id: string) {
    setActiveQuestIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={styles.safe}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Food Go, return to map"
          onPress={() => navigate("Map")}
          style={styles.brand}
        >
          <View style={styles.brandMark}>
            <Leaf size={24} strokeWidth={1.6} color="#f7f8f2" />
          </View>
          <Text style={styles.brandName}>
            food<Text style={styles.brandGo}>go</Text>
            <Text style={styles.brandDot}>.</Text>
          </Text>
        </Pressable>
        <View style={styles.demoPill}>
          <View style={styles.demoDot} />
          <Text style={styles.demoPillText}>PREVIEW</Text>
        </View>
        <Pressable
          onPress={() => navigate("Profile")}
          accessibilityRole="button"
          accessibilityLabel="Open explorer profile"
          style={styles.avatar}
        >
          <User size={20} color="#355a47" />
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === "Map" && (
          <>
            <View style={styles.eyebrowRow}>
              <MapPin size={13} color="#5c725d" />
              <Text style={styles.eyebrow}>MELBOURNE, VICTORIA</Text>
            </View>
            <Text style={styles.title}>Good food.{"\n"}Great discoveries.</Text>
            <Text style={styles.subtitle}>
              Find a little more to love about your neighbourhood.
            </Text>
            <View style={styles.search}>
              <Search size={20} color="#6f7b6a" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
                placeholder="A place, a dish, a new favourite..."
                placeholderTextColor="#7a8475"
                accessibilityLabel="Search sample venues and dishes"
                returnKeyType="search"
                autoCapitalize="none"
                maxLength={100}
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={styles.clear}
                >
                  <X size={18} color="#59705a" />
                </Pressable>
              )}
            </View>
            <View style={styles.filters}>
              {filters.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item }}
                  onPress={() => setFilter(item)}
                  style={[
                    styles.filter,
                    filter === item && styles.filterActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filter === item && styles.filterTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <NeighbourhoodMap
              venues={filteredVenues}
              selectedId={selectedVenue?.id ?? ""}
              onSelect={setSelectedId}
            />
            {selectedVenue && (
              <View style={styles.mapSelection}>
                <View style={styles.flex}>
                  <Text style={styles.selectionName}>{selectedVenue.name}</Text>
                  <Text style={styles.smallMuted}>
                    {selectedVenue.cuisine} in {selectedVenue.neighbourhood}
                  </Text>
                </View>
                <SaveButton
                  saved={savedVenueIds.includes(selectedVenue.id)}
                  onPress={() => toggleSavedVenue(selectedVenue.id)}
                  label={selectedVenue.name}
                />
              </View>
            )}
            <SectionHeading
              title="A taste of the neighbourhood"
              subtitle={`${filteredVenues.length} fictional places to explore`}
            />
            {filteredVenues.length === 0 ? (
              <EmptyState
                title="No sample places found"
                description="Try a different dish or clear your filters."
                action="Clear search and filters"
                onPress={() => {
                  setQuery("");
                  setFilter("All places");
                }}
              />
            ) : (
              filteredVenues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  saved={savedVenueIds.includes(venue.id)}
                  onSave={() => toggleSavedVenue(venue.id)}
                />
              ))
            )}
            <Pressable
              onPress={() => navigate("Quests")}
              accessibilityRole="button"
              style={styles.questBanner}
            >
              <View style={styles.questBannerIcon}>
                <Compass size={29} strokeWidth={1.5} color="#dce5c7" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.questBannerEyebrow}>
                  MAKE A MORNING OF IT
                </Text>
                <Text style={styles.questBannerTitle}>
                  Follow your curiosity.
                </Text>
                <Text style={styles.questBannerBody}>
                  Explore your first food trail
                </Text>
              </View>
              <ArrowRight size={21} color="#ecf0df" />
            </Pressable>
            <PreviewNote />
          </>
        )}

        {tab === "FoodDex" && (
          <>
            <Text style={styles.eyebrow}>YOUR FOOD PASSPORT</Text>
            <Text style={styles.title}>
              A world of flavour,{"\n"}one dish at a time.
            </Text>
            <Text style={styles.subtitle}>
              Keep a little list of the things you would love to try.
            </Text>
            <View style={styles.statBand}>
              <Stat value={String(savedDishIds.length)} label="Saved to try" />
              <Stat value="0" label="Verified dishes" />
              <Stat value="0" label="Cuisines tried" />
            </View>
            <SectionHeading
              title="Start with something delicious"
              subtitle="Sample dishes, ready for your wish list"
            />
            {venues.map((venue) => {
              const saved = savedDishIds.includes(venue.id);
              return (
                <View key={venue.id} style={styles.dishCard}>
                  <View style={styles.dishArt}>
                    <DishArtwork
                      variant={venue.plate}
                      background={venue.colour}
                    />
                  </View>
                  <View style={styles.dishContent}>
                    <Text style={styles.cardEyebrow}>{venue.cuisine}</Text>
                    <Text style={styles.cardTitle}>{venue.dish}</Text>
                    <Text style={styles.smallMuted}>{venue.name}</Text>
                    <Pressable
                      onPress={() => toggleSavedDish(venue.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: saved }}
                      style={[
                        styles.outlineButton,
                        saved && styles.savedButton,
                      ]}
                    >
                      {saved ? (
                        <Check size={16} color="#2c5942" />
                      ) : (
                        <Bookmark size={16} color="#2c5942" />
                      )}
                      <Text style={styles.outlineButtonText}>
                        {saved ? "Saved to try" : "Save to try"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <View style={styles.infoBox}>
              <ShieldCheck color="#517148" size={22} />
              <Text style={styles.infoText}>
                A wish list is different from a verified experience. No dish is
                marked as eaten in this preview.
              </Text>
            </View>
            <PreviewNote />
          </>
        )}

        {tab === "Quests" && (
          <>
            <Text style={styles.eyebrow}>LITTLE ADVENTURES, GOOD MEMORIES</Text>
            <Text style={styles.title}>Take the{"\n"}scenic route.</Text>
            <Text style={styles.subtitle}>
              A good meal is even better with a little discovery along the way.
            </Text>
            <View style={styles.statBand}>
              <Stat
                value={String(activeQuestIds.length)}
                label="Active trails"
              />
              <Stat value="0" label="Verified visits" />
              <Stat value="0" label="Completed" />
            </View>
            {quests.map((quest, index) => {
              const active = activeQuestIds.includes(quest.id);
              return (
                <View style={styles.questCard} key={quest.id}>
                  <View style={styles.questTop}>
                    <View style={styles.questNumber}>
                      <Text style={styles.questNumberText}>0{index + 1}</Text>
                    </View>
                    <Text style={styles.cardEyebrow}>{quest.category}</Text>
                  </View>
                  <Text style={styles.questTitle}>{quest.title}</Text>
                  <Text style={styles.questDescription}>
                    {quest.description}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={styles.progressStart} />
                  </View>
                  <View style={styles.questBottom}>
                    <Text style={styles.smallMuted}>
                      0 of {quest.count} verified discoveries
                    </Text>
                    <Pressable
                      onPress={() => toggleQuest(quest.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.questButton,
                        active && styles.questButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.questButtonText,
                          active && styles.questButtonActiveText,
                        ]}
                      >
                        {active ? "Leave trail" : "Join trail"}
                      </Text>
                      {!active && <ArrowRight size={15} color="#fffef8" />}
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <View style={styles.infoBox}>
              <Flag color="#517148" size={21} />
              <Text style={styles.infoText}>
                Joining a sample trail changes this session only. Visits and
                rewards require a connected, verified check-in system.
              </Text>
            </View>
            <PreviewNote />
          </>
        )}

        {tab === "VenueDex" && (
          <>
            <Text style={styles.eyebrow}>YOUR LITTLE BLACK BOOK</Text>
            <Text style={styles.title}>Places worth{"\n"}coming back to.</Text>
            <Text style={styles.subtitle}>
              Keep your next good find close at hand.
            </Text>
            <View style={styles.statBand}>
              <Stat value={String(savedVenueIds.length)} label="Saved places" />
              <Stat value="0" label="Verified visits" />
              <Stat value="0" label="Regions explored" />
            </View>
            <SectionHeading
              title="Your saved places"
              subtitle="A wish list for your next adventure"
            />
            {savedVenueIds.length === 0 ? (
              <EmptyState
                title="Your next favourite is out there"
                description="Save a place from the map to start your personal collection."
                action="Explore the map"
                onPress={() => navigate("Map")}
              />
            ) : (
              venues
                .filter((venue) => savedVenueIds.includes(venue.id))
                .map((venue) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    saved
                    onSave={() => toggleSavedVenue(venue.id)}
                  />
                ))
            )}
            <PreviewNote />
          </>
        )}

        {tab === "Profile" && (
          <>
            <Text style={styles.eyebrow}>FOOD EXPLORER</Text>
            <Text style={styles.title}>Make room{"\n"}for discovery.</Text>
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Leaf size={34} strokeWidth={1.4} color="#426441" />
              </View>
              <Text style={styles.profileName}>Curious explorer</Text>
              <Text style={styles.profileCaption}>
                Guest preview. No account connected.
              </Text>
              <View style={styles.profileBadge}>
                <Compass size={15} color="#526d49" />
                <Text style={styles.profileBadgeText}>
                  Your journey starts here
                </Text>
              </View>
            </View>
            <View style={styles.statBand}>
              <Stat value={String(savedVenueIds.length)} label="Saved places" />
              <Stat value={String(savedDishIds.length)} label="Dishes to try" />
              <Stat
                value={String(activeQuestIds.length)}
                label="Active trails"
              />
            </View>
            <SectionHeading title="Thoughtful by default" />
            <View style={styles.setting}>
              <View style={styles.settingIcon}>
                <ShieldCheck size={22} color="#506e49" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.settingTitle}>
                  Private explorer profile
                </Text>
                <Text style={styles.settingDescription}>
                  Preview preference only
                </Text>
              </View>
              <Switch
                value={privateProfile}
                onValueChange={setPrivateProfile}
                accessibilityLabel="Private profile preview preference"
                trackColor={{ false: "#c5cdbd", true: "#476e53" }}
                thumbColor="#fffef9"
              />
            </View>
            <View style={styles.setting}>
              <View style={styles.settingIcon}>
                <MapPin size={22} color="#506e49" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.settingTitle}>
                  Your location stays yours
                </Text>
                <Text style={styles.settingDescription}>
                  This preview does not request location.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Account connection is a later step",
                  "This is a guest preview. Sign-in, account deletion and permanent storage will be connected and tested together before public launch.",
                )
              }
              accessibilityRole="button"
              style={styles.accountButton}
            >
              <Text style={styles.accountButtonText}>About your account</Text>
              <ChevronRight size={18} color="#355a47" />
            </Pressable>
            <PreviewNote />
          </>
        )}
      </ScrollView>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {tabs.map(({ name, Icon }) => {
          const active = tab === name;
          return (
            <Pressable
              key={name}
              onPress={() => navigate(name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={name === "Map" ? "Explore map" : name}
              style={styles.tab}
            >
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                <Icon
                  size={21}
                  strokeWidth={active ? 2 : 1.6}
                  color={active ? "#2e5942" : "#7a8374"}
                />
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function PreviewNote() {
  return (
    <View style={styles.previewNote}>
      <Leaf size={15} color="#788170" />
      <Text style={styles.previewNoteText}>
        A first look at Food Go. Fictional venues and dishes. Session-only
        saves.
      </Text>
    </View>
  );
}
function SaveButton({
  saved,
  onPress,
  label,
}: {
  saved: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${saved ? "Remove" : "Save"} ${label}${saved ? " from saved places" : ""}`}
      accessibilityState={{ selected: saved }}
      style={[styles.saveButton, saved && styles.saveButtonActive]}
    >
      <Bookmark
        size={19}
        strokeWidth={1.7}
        color="#365e43"
        fill={saved ? "#365e43" : "none"}
      />
    </Pressable>
  );
}
function VenueCard({
  venue,
  saved,
  onSave,
}: {
  venue: Venue;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <View style={styles.venueCard}>
      <View style={styles.venueArt}>
        <DishArtwork variant={venue.plate} background={venue.colour} />
      </View>
      <View style={styles.venueContent}>
        <View style={styles.cardTop}>
          <Text style={styles.cardEyebrow}>
            {venue.category === "Cafe"
              ? "NEIGHBOURHOOD CAFE"
              : "INDEPENDENT KITCHEN"}
          </Text>
          <SaveButton saved={saved} onPress={onSave} label={venue.name} />
        </View>
        <Text style={styles.cardTitle}>{venue.name}</Text>
        <Text style={styles.venueDish}>{venue.dish}</Text>
        <View style={styles.venueMeta}>
          <MapPin size={12} color="#72816b" />
          <Text style={styles.smallMuted}>{venue.neighbourhood}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.smallMuted}>Sample venue</Text>
        </View>
      </View>
    </View>
  );
}
function EmptyState({
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
      <View style={styles.emptyIcon}>
        <Coffee size={29} color="#608051" strokeWidth={1.4} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      <Pressable
        style={styles.primaryButton}
        onPress={onPress}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>{action}</Text>
        <ArrowRight color="#fffef9" size={16} />
      </Pressable>
    </View>
  );
}

const headingFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "Georgia",
});
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f2" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 9,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e8ebdf",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    flex: 1,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#2c543e",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -1.5,
    color: "#244a36",
  },
  brandGo: { fontWeight: "400" },
  brandDot: { color: "#8a9b5b" },
  demoPill: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    borderColor: "#dce3d2",
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  demoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#7e9760" },
  demoPillText: {
    color: "#677c58",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#dbe2d2",
    backgroundColor: "#eef1e5",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 22,
    paddingTop: 27,
    paddingBottom: 24,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.75,
    color: "#687b5f",
    lineHeight: 16,
  },
  title: {
    fontFamily: headingFont,
    fontSize: 35,
    lineHeight: 41,
    letterSpacing: -1.35,
    color: "#284532",
    marginTop: 11,
    marginBottom: 10,
  },
  subtitle: {
    color: "#65735d",
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 330,
    marginBottom: 23,
  },
  search: {
    backgroundColor: "#fffef9",
    borderColor: "#e0e5d7",
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
    paddingLeft: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#2c4a36",
    fontSize: 12,
    minHeight: 50,
    paddingVertical: 12,
    paddingRight: 10,
  },
  clear: {
    minHeight: 46,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: {
    flexDirection: "row",
    gap: 7,
    flexWrap: "wrap",
    marginVertical: 15,
  },
  filter: {
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#dee4d5",
    justifyContent: "center",
    backgroundColor: "#f7f8f2",
  },
  filterActive: { backgroundColor: "#2e5942", borderColor: "#2e5942" },
  filterText: { fontSize: 11, fontWeight: "500", color: "#687660" },
  filterTextActive: { color: "#fffef9" },
  mapSelection: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: "#fffef9",
    borderWidth: 1,
    borderColor: "#e2e7d9",
    borderRadius: 15,
    marginTop: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectionName: {
    fontSize: 15,
    color: "#2d4c37",
    fontWeight: "600",
    marginBottom: 4,
  },
  flex: { flex: 1 },
  smallMuted: { fontSize: 11, lineHeight: 17, color: "#5d6c55" },
  sectionHeading: { marginTop: 26, marginBottom: 14, gap: 4 },
  sectionTitle: {
    fontFamily: headingFont,
    fontSize: 22,
    lineHeight: 28,
    color: "#2d4c37",
    letterSpacing: -0.45,
  },
  sectionSubtitle: { color: "#7a8471", fontSize: 11, lineHeight: 17 },
  venueCard: {
    backgroundColor: "#fffef9",
    borderColor: "#e3e7db",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 12,
    flexDirection: "row",
    minHeight: 144,
  },
  venueArt: { width: 107, backgroundColor: "#e7ebd9" },
  venueContent: { flex: 1, padding: 13, paddingTop: 8 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
  },
  cardEyebrow: {
    color: "#7b886b",
    fontSize: 8,
    lineHeight: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.5,
    lineHeight: 24,
    color: "#2e4c38",
    marginTop: 1,
  },
  venueDish: { color: "#6b7861", fontSize: 11, lineHeight: 17, marginTop: 2 },
  venueMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
  },
  metaDot: { fontSize: 12, color: "#a0aa94" },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  saveButtonActive: { backgroundColor: "#eff3e7" },
  questBanner: {
    marginTop: 12,
    backgroundColor: "#2e513e",
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  questBannerIcon: { width: 44, alignItems: "center" },
  questBannerEyebrow: { fontSize: 7, letterSpacing: 1.3, color: "#b6c8a8" },
  questBannerTitle: {
    fontFamily: headingFont,
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 27,
    color: "#f1f2e6",
    marginTop: 3,
  },
  questBannerBody: { fontSize: 10, color: "#c2cebb", marginTop: 4 },
  previewNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 25,
    paddingHorizontal: 3,
  },
  previewNoteText: { color: "#7e8775", fontSize: 10, lineHeight: 16, flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e0e6d6",
    backgroundColor: "#fffef9",
    paddingTop: 7,
    paddingHorizontal: 8,
    paddingBottom: 5,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 3,
    paddingBottom: 8,
    minHeight: 60,
    justifyContent: "center",
  },
  tabIcon: {
    width: 44,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  tabIconActive: { backgroundColor: "#e9efdd" },
  tabLabel: { color: "#7b8473", fontSize: 9, marginTop: 5 },
  tabLabelActive: { color: "#31573d", fontWeight: "600" },
  statBand: {
    backgroundColor: "#edf1e4",
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 19,
    marginTop: 2,
    marginBottom: 5,
  },
  stat: { flex: 1, alignItems: "center", gap: 6, paddingHorizontal: 3 },
  statValue: {
    fontFamily: headingFont,
    fontSize: 27,
    lineHeight: 30,
    color: "#3b5a3b",
  },
  statLabel: { color: "#6e7f61", fontSize: 9, textAlign: "center" },
  dishCard: {
    borderRadius: 20,
    borderColor: "#e2e6d9",
    borderWidth: 1,
    backgroundColor: "#fffef9",
    overflow: "hidden",
    marginBottom: 16,
  },
  dishArt: { height: 178 },
  dishContent: { padding: 18 },
  outlineButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#d9e2cc",
    borderRadius: 11,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
  },
  outlineButtonText: { fontSize: 11, color: "#355b40", fontWeight: "600" },
  savedButton: { backgroundColor: "#eef3e5" },
  infoBox: {
    backgroundColor: "#edf1e5",
    padding: 16,
    borderRadius: 14,
    gap: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 9,
  },
  infoText: { flex: 1, color: "#68785e", fontSize: 11, lineHeight: 18 },
  questCard: {
    marginTop: 18,
    backgroundColor: "#fffef9",
    borderWidth: 1,
    borderColor: "#e0e6d7",
    borderRadius: 20,
    padding: 19,
  },
  questTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  questNumber: {
    backgroundColor: "#eff2e6",
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  questNumberText: { fontFamily: headingFont, fontSize: 18, color: "#688052" },
  questTitle: {
    fontFamily: headingFont,
    fontSize: 24,
    letterSpacing: -0.65,
    lineHeight: 30,
    color: "#2e4d36",
    marginTop: 15,
  },
  questDescription: {
    color: "#748168",
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#e9eedf",
    borderRadius: 2,
    marginTop: 22,
  },
  progressStart: { width: 0, height: 4, backgroundColor: "#638052" },
  questBottom: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 7,
  },
  questButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#355c43",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  questButtonText: { color: "#fffef8", fontSize: 10, fontWeight: "600" },
  questButtonActive: { backgroundColor: "#edf2e3" },
  questButtonActiveText: { color: "#3f6042" },
  empty: {
    paddingHorizontal: 22,
    paddingVertical: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d6dfc9",
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#f1f4e9",
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: "#e5ecd8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  emptyTitle: {
    fontFamily: headingFont,
    fontSize: 22,
    textAlign: "center",
    color: "#3a5b3d",
    lineHeight: 28,
  },
  emptyDescription: {
    color: "#78856c",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 9,
    marginBottom: 19,
  },
  primaryButton: {
    backgroundColor: "#355c43",
    minHeight: 46,
    paddingHorizontal: 17,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonText: { fontSize: 11, color: "#fffef9", fontWeight: "600" },
  profileCard: {
    padding: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e7d6",
    backgroundColor: "#fffef9",
    borderRadius: 22,
    marginTop: 12,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: "#e6edd7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  profileName: {
    fontFamily: headingFont,
    fontSize: 26,
    color: "#35583b",
    lineHeight: 32,
  },
  profileCaption: { fontSize: 11, color: "#7c8772", marginTop: 8 },
  profileBadge: {
    backgroundColor: "#eff3e7",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileBadgeText: { color: "#6a7c5b", fontSize: 10 },
  setting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e7ebdd",
    minHeight: 79,
  },
  settingIcon: { width: 30, alignItems: "center" },
  settingTitle: {
    fontSize: 12,
    color: "#38573e",
    fontWeight: "500",
    lineHeight: 19,
  },
  settingDescription: {
    fontSize: 10,
    color: "#7e8873",
    lineHeight: 17,
    marginTop: 3,
  },
  accountButton: {
    minHeight: 52,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#dce4d1",
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  accountButtonText: { color: "#355a47", fontSize: 12, fontWeight: "500" },
});
