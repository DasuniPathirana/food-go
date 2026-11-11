import {
  Fragment,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Flag,
  Map,
  MapPin,
  Search,
  Store,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { NeighbourhoodMap } from "./src/Illustrations";
import { quests, venues, type Venue } from "./src/data";

type Tab = "Map" | "FoodDex" | "VenueDex" | "Quests" | "Profile";
type Filter = "All places" | "Cafes" | "Restaurants";
const tabs: { name: Tab; Icon: LucideIcon }[] = [
  { name: "Map", Icon: Map },
  { name: "FoodDex", Icon: BookOpen },
  { name: "VenueDex", Icon: Store },
  { name: "Quests", Icon: Flag },
  { name: "Profile", Icon: UserRound },
];
const filters: Filter[] = ["All places", "Cafes", "Restaurants"];
const photos: Record<string, ImageSourcePropType> = {
  fern: require("../web/public/images/brunch.jpg"),
  terra: require("../web/public/images/pizza.jpg"),
  little: require("../web/public/images/coffee.jpg"),
};
const colour = {
  paper: "#faf8f2",
  white: "#fffefa",
  ink: "#183d32",
  muted: "#5b625a",
  line: "#dedfd5",
  rust: "#b64a36",
  pale: "#edf0e6",
};

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
  const [selectedId, setSelectedId] = useState(venues[0]?.id ?? "");
  const [savedVenueIds, setSavedVenueIds] = useState<string[]>([]);
  const [savedDishIds, setSavedDishIds] = useState<string[]>([]);
  const [plannedQuestIds, setPlannedQuestIds] = useState<string[]>([]);
  const [privateProfile, setPrivateProfile] = useState(true);
  const [notice, setNotice] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const scroll = useRef<ScrollViewInstance | null>(null);
  const filteredVenues = venues.filter((venue) => {
    const matchesCategory =
      filter === "All places" ||
      (filter === "Cafes"
        ? venue.category === "Cafe"
        : venue.category === "Restaurant");
    return (
      matchesCategory &&
      `${venue.name} ${venue.neighbourhood} ${venue.cuisine} ${venue.dish}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    );
  });
  const selectedVenue =
    filteredVenues.find((venue) => venue.id === selectedId) ??
    filteredVenues[0];
  const savedVenues = venues.filter((venue) =>
    savedVenueIds.includes(venue.id),
  );

  function navigate(next: Tab) {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  function toggle(id: string, update: Dispatch<SetStateAction<string[]>>) {
    update((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  function clearPlans() {
    setSavedVenueIds([]);
    setSavedDishIds([]);
    setPlannedQuestIds([]);
    setNotice("Your saved examples and trail plans have been cleared.");
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={styles.safe}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Pressable
          onPress={() => navigate("Map")}
          accessibilityRole="button"
          accessibilityLabel="Food Go home"
          style={styles.brand}
        >
          <Text style={styles.wordmark}>
            foodgo<Text style={styles.wordmarkDot}>.</Text>
          </Text>
        </Pressable>
        <Text style={styles.previewLabel}>Preview</Text>
        <Pressable
          onPress={() => navigate("Profile")}
          accessibilityRole="button"
          accessibilityLabel="Open guest profile"
          style={styles.profileShortcut}
        >
          <UserRound size={22} color={colour.ink} />
        </Pressable>
      </View>
      <ScrollView
        ref={scroll}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {tab === "Map" && (
          <>
            <View style={styles.location}>
              <MapPin size={16} color={colour.rust} />
              <Text style={styles.locationText}>Melbourne, VIC</Text>
            </View>
            <Text style={styles.title}>Where are we eating?</Text>
            <Text style={styles.intro}>
              Find a cafe, pick a dish, plan your next stop.
            </Text>
            <View style={styles.search}>
              <Search size={20} color={colour.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search food, places or suburbs"
                placeholderTextColor={colour.muted}
                accessibilityLabel="Search sample venues and dishes"
                style={styles.searchInput}
                maxLength={100}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {!!query && (
                <Pressable
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={styles.clear}
                >
                  <X size={20} color={colour.ink} />
                </Pressable>
              )}
            </View>
            <View style={styles.filters}>
              {filters.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item }}
                  style={[
                    styles.filter,
                    filter === item && styles.filterActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      filter === item && styles.filterActiveText,
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
                <View style={styles.selectedDot} />
                <Text style={styles.selectedText}>
                  Selected:{" "}
                  <Text style={styles.selectedName}>{selectedVenue.name}</Text>
                </Text>
              </View>
            )}
            <SectionHeading
              title="Places nearby"
              detail={`${filteredVenues.length} sample ${filteredVenues.length === 1 ? "venue" : "venues"}`}
            />
            {filteredVenues.length === 0 ? (
              <EmptyState
                title="No places match that search"
                description="Try another suburb or dish, or reset your filters."
                action="Reset search"
                onPress={() => {
                  setQuery("");
                  setFilter("All places");
                }}
              />
            ) : (
              filteredVenues.map((venue, index) => (
                <VenueRow
                  key={venue.id}
                  venue={venue}
                  number={index + 1}
                  selected={selectedVenue?.id === venue.id}
                  saved={savedVenueIds.includes(venue.id)}
                  onSave={() => toggle(venue.id, setSavedVenueIds)}
                />
              ))
            )}
            <Pressable
              onPress={() => navigate("Quests")}
              accessibilityRole="button"
              style={styles.trailLink}
            >
              <View style={styles.flex}>
                <Text style={styles.sectionTitle}>Plan a cafe morning</Text>
                <Text style={styles.trailDescription}>
                  Three stops. Coffee, brunch and something baked.
                </Text>
              </View>
              <ArrowRight size={24} color={colour.rust} />
            </Pressable>
            <PreviewNote />
          </>
        )}

        {tab === "FoodDex" && (
          <>
            <PageHeading
              label="FoodDex"
              title="Dishes to try"
              description="Keep a list for your next meal. Saved ideas and verified food experiences stay separate."
            />
            <View style={styles.stats}>
              <Stat value={savedDishIds.length} label="Saved ideas" />
              <Stat value={0} label="Verified dishes" />
              <Stat value={0} label="Cuisines tried" />
            </View>
            <SectionHeading title="Start here" detail="Example dishes" />
            {venues.map((venue) => {
              const saved = savedDishIds.includes(venue.id);
              return (
                <View key={venue.id} style={styles.dishCard}>
                  <Image
                    source={photos[venue.id]}
                    style={styles.dishPhoto}
                    accessibilityLabel={`Illustrative photo for ${venue.dish}`}
                  />
                  <View style={styles.dishBody}>
                    <Text style={styles.dishCuisine}>{venue.cuisine}</Text>
                    <Text style={styles.dishTitle}>{venue.dish}</Text>
                    <Text style={styles.bodyMuted}>
                      {venue.name}, {venue.neighbourhood}
                    </Text>
                    <Pressable
                      onPress={() => toggle(venue.id, setSavedDishIds)}
                      accessibilityRole="button"
                      accessibilityLabel={`${saved ? "Unsave" : "Save"} ${venue.dish}`}
                      accessibilityState={{ selected: saved }}
                      style={[
                        styles.outlineButton,
                        saved && styles.buttonSaved,
                      ]}
                    >
                      {saved ? (
                        <Check size={18} color={colour.ink} />
                      ) : (
                        <Bookmark size={18} color={colour.ink} />
                      )}
                      <Text style={styles.outlineButtonText}>
                        {saved ? "Saved to try" : "Save dish"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            <Text style={styles.note}>
              Saving a dish does not mark it as eaten. Verification will be
              added with the connected check-in system.
            </Text>
            <PreviewNote />
          </>
        )}

        {tab === "VenueDex" && (
          <>
            <PageHeading
              label="VenueDex"
              title="Saved places"
              description="The places you bookmarked for a future visit."
            />
            <View style={styles.stats}>
              <Stat value={savedVenueIds.length} label="Saved places" />
              <Stat value={0} label="Verified visits" />
              <Stat value={0} label="Regions visited" />
            </View>
            <SectionHeading
              title="Your list"
              detail={`${savedVenues.length} saved`}
            />
            {savedVenues.length === 0 ? (
              <EmptyState
                title="Nothing saved yet"
                description="Bookmark a place on the map to keep it here for this session."
                action="Explore the map"
                onPress={() => navigate("Map")}
              />
            ) : (
              savedVenues.map((venue, index) => (
                <VenueRow
                  key={venue.id}
                  venue={venue}
                  number={index + 1}
                  saved
                  onSave={() => toggle(venue.id, setSavedVenueIds)}
                />
              ))
            )}
            <Text style={styles.note}>
              A saved place is a plan, not a verified visit.
            </Text>
            <PreviewNote />
          </>
        )}

        {tab === "Quests" && (
          <>
            <PageHeading
              label="Quests and trails"
              title="Your next stops"
              description="Pick a route through the neighbourhood. Take it at your own pace."
            />
            <View style={styles.stats}>
              <Stat value={plannedQuestIds.length} label="Planned trails" />
              <Stat value={0} label="Verified visits" />
              <Stat value={0} label="Completed" />
            </View>
            {quests.map((quest, index) => {
              const planned = plannedQuestIds.includes(quest.id);
              return (
                <View key={quest.id} style={styles.quest}>
                  <View style={styles.questMeta}>
                    <Text style={styles.questCategory}>{quest.category}</Text>
                    <Text style={styles.questNumber}>0{index + 1}</Text>
                  </View>
                  <Text style={styles.questTitle}>{quest.title}</Text>
                  <Text style={styles.bodyMuted}>{quest.description}</Text>
                  <View style={styles.questStops}>
                    {Array.from({ length: quest.count }, (_, stop) => (
                      <Fragment key={stop}>
                        <View style={styles.stopDot} />
                        {stop < quest.count - 1 && (
                          <View style={styles.stopLine} />
                        )}
                      </Fragment>
                    ))}
                  </View>
                  <Text style={styles.questProgress}>
                    0 of {quest.count} visits verified
                  </Text>
                  <Pressable
                    onPress={() => toggle(quest.id, setPlannedQuestIds)}
                    accessibilityRole="button"
                    accessibilityLabel={`${planned ? "Remove" : "Add"} ${quest.title} ${planned ? "from" : "to"} your plan`}
                    accessibilityState={{ selected: planned }}
                    style={[
                      styles.primaryButton,
                      planned && styles.buttonSaved,
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        planned && styles.plannedText,
                      ]}
                    >
                      {planned ? "Remove from plan" : "Add to plan"}
                    </Text>
                    {planned ? (
                      <Check size={18} color={colour.ink} />
                    ) : (
                      <ArrowRight size={18} color={colour.white} />
                    )}
                  </Pressable>
                </View>
              );
            })}
            <Text style={styles.note}>
              These are sample trails. Adding a plan does not complete a quest
              or award points.
            </Text>
            <PreviewNote />
          </>
        )}

        {tab === "Profile" && (
          <>
            <PageHeading
              label="Profile"
              title="Your food passport"
              description="A place for your saved stops, dishes and future verified visits."
            />
            <View style={styles.guestProfile}>
              <View style={styles.guestAvatar}>
                <UserRound size={28} color={colour.ink} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.guestName}>Guest explorer</Text>
                <Text style={styles.bodyMuted}>No account connected</Text>
              </View>
            </View>
            <View style={styles.stats}>
              <Stat value={savedVenueIds.length} label="Saved places" />
              <Stat value={savedDishIds.length} label="Dish ideas" />
              <Stat value={plannedQuestIds.length} label="Trail plans" />
            </View>
            <SectionHeading title="Privacy and saved data" />
            <View style={styles.setting}>
              <View style={styles.flex}>
                <Text style={styles.settingTitle}>Private profile</Text>
                <Text style={styles.settingHelp}>Preview preference only</Text>
              </View>
              <Switch
                value={privateProfile}
                onValueChange={setPrivateProfile}
                accessibilityLabel="Private profile preview preference"
                hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
                trackColor={{ false: "#bdc3b7", true: colour.ink }}
                thumbColor={colour.white}
              />
            </View>
            <Text style={styles.note}>
              Your plans stay in this app session. They are not public, sent to
              a server or synced to the website.
            </Text>
            <Pressable
              onPress={clearPlans}
              accessibilityRole="button"
              style={styles.settingAction}
            >
              <Text style={styles.settingActionText}>Clear saved examples</Text>
              <X size={20} color={colour.ink} />
            </Pressable>
            {!!notice && (
              <Text style={styles.status} accessibilityRole="alert">
                {notice}
              </Text>
            )}
            <Pressable
              onPress={() => setAboutOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: aboutOpen }}
              style={styles.settingAction}
            >
              <Text style={styles.settingActionText}>About this preview</Text>
              {aboutOpen ? (
                <X size={20} color={colour.ink} />
              ) : (
                <ChevronRight size={20} color={colour.ink} />
              )}
            </Pressable>
            {aboutOpen && (
              <Text style={styles.note}>
                All places and trails are examples. Accounts, permanent saves,
                live maps and secure check-ins are not connected in the mobile
                app. The app does not request camera, microphone or location
                access.
              </Text>
            )}
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
              accessibilityLabel={name}
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              <Icon
                size={22}
                color={active ? colour.ink : colour.muted}
                strokeWidth={active ? 2.3 : 1.7}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {name}
              </Text>
              <View
                style={[
                  styles.tabIndicator,
                  active && styles.tabIndicatorActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function PageHeading({
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
      <Text style={styles.pageLabel}>{label}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.intro}>{description}</Text>
    </>
  );
}
function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail && <Text style={styles.sectionDetail}>{detail}</Text>}
    </View>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function SaveButton({
  saved,
  onPress,
  name,
}: {
  saved: boolean;
  onPress: () => void;
  name: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${saved ? "Unsave" : "Save"} ${name}`}
      accessibilityState={{ selected: saved }}
      style={styles.saveButton}
    >
      <Bookmark
        size={20}
        color={colour.ink}
        fill={saved ? colour.ink : "none"}
      />
    </Pressable>
  );
}
function VenueRow({
  venue,
  number,
  selected,
  saved,
  onSave,
}: {
  venue: Venue;
  number: number;
  selected?: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <View style={[styles.venueRow, selected && styles.venueRowSelected]}>
      <Image
        source={photos[venue.id]}
        style={styles.venuePhoto}
        accessibilityLabel={`Illustrative photo for ${venue.dish}`}
      />
      <View style={styles.venueDetails}>
        <View style={styles.venueTitleRow}>
          <Text style={styles.venueNumber}>
            {String(number).padStart(2, "0")}
          </Text>
          <Text style={styles.venueName}>{venue.name}</Text>
        </View>
        <Text style={styles.venueMeta}>
          {venue.neighbourhood} · {venue.category}
        </Text>
        <Text style={styles.venueDish}>{venue.dish}</Text>
      </View>
      <SaveButton saved={saved} name={venue.name} onPress={onSave} />
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
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.bodyMuted}>{description}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>{action}</Text>
        <ArrowRight size={18} color={colour.white} />
      </Pressable>
    </View>
  );
}
function PreviewNote() {
  return (
    <Text style={styles.previewNote}>
      Example venues and experiences. Live location and check-ins are not
      connected.
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colour.paper },
  flex: { flex: 1, minWidth: 0 },
  header: {
    height: 66,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colour.line,
  },
  brand: { minHeight: 44, justifyContent: "center" },
  wordmark: {
    color: colour.ink,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1.9,
  },
  wordmarkDot: { color: colour.rust },
  previewLabel: { marginLeft: "auto", color: colour.muted, fontSize: 13 },
  profileShortcut: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 30,
    maxWidth: 650,
    width: "100%",
    alignSelf: "center",
  },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 11,
  },
  locationText: { fontSize: 14, color: colour.muted, fontWeight: "500" },
  pageLabel: {
    color: colour.rust,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  title: {
    fontSize: 35,
    lineHeight: 39,
    letterSpacing: -1.2,
    fontWeight: "700",
    color: colour.ink,
  },
  intro: {
    color: colour.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    marginBottom: 23,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: "#819075",
    borderRadius: 9,
    backgroundColor: colour.white,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 50,
    fontSize: 14,
    color: colour.ink,
    paddingVertical: 9,
  },
  clear: {
    width: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    marginBottom: 18,
  },
  filter: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colour.line,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  filterActive: { backgroundColor: colour.ink, borderColor: colour.ink },
  filterText: { fontSize: 13, color: colour.ink, fontWeight: "500" },
  filterActiveText: { color: colour.white },
  mapSelection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingTop: 12,
    paddingBottom: 1,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colour.rust,
  },
  selectedText: { fontSize: 13, color: colour.muted, flex: 1 },
  selectedName: { fontWeight: "600", color: colour.ink },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 13,
  },
  sectionTitle: {
    color: colour.ink,
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.45,
  },
  sectionDetail: { color: colour.muted, fontSize: 13 },
  venueRow: {
    flexDirection: "row",
    gap: 13,
    minHeight: 127,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colour.line,
  },
  venueRowSelected: { borderBottomColor: "#b9c8b4" },
  venuePhoto: {
    width: 85,
    height: 94,
    borderRadius: 7,
    backgroundColor: colour.pale,
  },
  venueDetails: { flex: 1, minWidth: 0, justifyContent: "center", gap: 6 },
  venueTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: 6,
  },
  venueNumber: { color: colour.rust, fontSize: 12, fontWeight: "700" },
  venueName: {
    color: colour.ink,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  venueMeta: { color: colour.muted, fontSize: 13, lineHeight: 18 },
  venueDish: { color: colour.ink, fontSize: 13, lineHeight: 19 },
  saveButton: {
    width: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
    marginRight: -8,
  },
  trailLink: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colour.line,
    paddingVertical: 22,
    marginTop: 24,
    gap: 14,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 92,
  },
  trailDescription: {
    color: colour.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  previewNote: {
    color: colour.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 26,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colour.line,
  },
  stats: {
    flexDirection: "row",
    paddingVertical: 21,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colour.line,
    marginBottom: 4,
  },
  stat: { flex: 1, paddingRight: 8 },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colour.ink,
    lineHeight: 33,
  },
  statLabel: {
    color: colour.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  dishCard: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colour.line,
    paddingBottom: 23,
  },
  dishPhoto: {
    width: "100%",
    height: 194,
    borderRadius: 9,
    backgroundColor: colour.pale,
  },
  dishBody: { paddingTop: 15 },
  dishCuisine: {
    fontSize: 13,
    color: colour.rust,
    fontWeight: "600",
    marginBottom: 7,
  },
  dishTitle: {
    color: colour.ink,
    fontSize: 23,
    lineHeight: 28,
    letterSpacing: -0.55,
    fontWeight: "700",
    marginBottom: 6,
  },
  bodyMuted: { color: colour.muted, fontSize: 14, lineHeight: 22 },
  outlineButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#c6cec0",
    borderRadius: 7,
    marginTop: 16,
  },
  outlineButtonText: { color: colour.ink, fontSize: 14, fontWeight: "600" },
  buttonSaved: { backgroundColor: colour.pale },
  primaryButton: {
    alignSelf: "flex-start",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: colour.ink,
    paddingHorizontal: 18,
    borderRadius: 7,
    marginTop: 20,
  },
  primaryButtonText: { color: colour.white, fontSize: 14, fontWeight: "600" },
  plannedText: { color: colour.ink },
  note: { color: colour.muted, fontSize: 14, lineHeight: 23, marginTop: 19 },
  quest: {
    paddingVertical: 25,
    borderBottomWidth: 1,
    borderBottomColor: colour.line,
  },
  questMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "baseline",
    marginBottom: 13,
  },
  questCategory: { fontSize: 14, color: colour.rust, fontWeight: "600" },
  questNumber: { fontSize: 14, color: colour.muted },
  questTitle: {
    color: colour.ink,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.75,
    fontWeight: "700",
    marginBottom: 11,
  },
  questStops: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    maxWidth: 210,
  },
  stopDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#a7b39c",
    backgroundColor: colour.paper,
  },
  stopLine: { flex: 1, height: 1, backgroundColor: "#cad0c2" },
  questProgress: { color: colour.muted, fontSize: 13, marginTop: 10 },
  empty: { paddingVertical: 26 },
  emptyTitle: {
    color: colour.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 11,
  },
  guestProfile: {
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
    paddingBottom: 22,
  },
  guestAvatar: {
    backgroundColor: colour.pale,
    width: 59,
    height: 59,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  guestName: {
    fontSize: 21,
    fontWeight: "700",
    color: colour.ink,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  setting: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 80,
    borderBottomWidth: 1,
    borderColor: colour.line,
    paddingVertical: 16,
  },
  settingTitle: { fontSize: 16, color: colour.ink, fontWeight: "600" },
  settingHelp: { fontSize: 13, color: colour.muted, marginTop: 6 },
  settingAction: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    borderBottomWidth: 1,
    borderBottomColor: colour.line,
    paddingVertical: 12,
  },
  settingActionText: {
    color: colour.ink,
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  status: { marginTop: 13, fontSize: 14, lineHeight: 22, color: colour.ink },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colour.line,
    backgroundColor: colour.paper,
    paddingHorizontal: 9,
    paddingTop: 7,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 62,
    gap: 5,
    paddingTop: 4,
  },
  tabLabel: { fontSize: 11, color: colour.muted, fontWeight: "500" },
  tabLabelActive: { color: colour.ink, fontWeight: "700" },
  tabIndicator: {
    width: 17,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
    backgroundColor: "transparent",
  },
  tabIndicatorActive: { backgroundColor: colour.rust },
});
