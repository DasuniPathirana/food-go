import { z } from "zod";

export const outbackRegions = [
  { id: "NSW", name: "New South Wales", destination: "Riverina", landscape: "River plains and red earth", climate: "Warm summers, cool winters", challenge: "Store water for dry spells" },
  { id: "VIC", name: "Victoria", destination: "Grampians foothills", landscape: "Rolling farmland and woodland", climate: "Cool seasons and changeable rain", challenge: "Protect crops from dry summers" },
  { id: "QLD", name: "Queensland", destination: "Darling Downs", landscape: "Wide grasslands and rich soil", climate: "Warm days and summer storms", challenge: "Balance heat and water" },
  { id: "SA", name: "South Australia", destination: "Clare Valley", landscape: "Golden hills and open farms", climate: "Dry summers and winter rain", challenge: "Make each water tank count" },
  { id: "WA", name: "Western Australia", destination: "Wheatbelt", landscape: "Expansive fields and granite outcrops", climate: "Dry summers and mild winters", challenge: "Build resilient water storage" },
  { id: "TAS", name: "Tasmania", destination: "Midlands", landscape: "Green valleys and open pasture", climate: "Cool air and seasonal rainfall", challenge: "Plan for the cooler growing season" },
  { id: "NT", name: "Northern Territory", destination: "Katherine country", landscape: "Red earth and tropical savanna", climate: "Distinct wet and dry seasons", challenge: "Save wet-season water" },
  { id: "ACT", name: "Australian Capital Territory", destination: "Canberra hinterland", landscape: "Tableland farms and bushland", climate: "Warm summers and frosty winters", challenge: "Care for soil through cool months" },
] as const;
export const regionSchema = z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]);
export const questCategorySchema = z.enum(["explore", "try", "feedback", "community", "promo"]);
export const structureSchema = z.enum(["garden", "shed", "tank", "bakery"]);
export const cropSchema = z.enum(["carrot", "wheat", "tomato"]);
const time = z.iso.datetime({ offset: true });
const integer = z.number().int().nonnegative();
const request = { requestId: z.uuid() };
const quest = { ...request, questId: z.uuid() };
const plot = { ...request, cell: z.number().int().min(0).max(15) };
export const adventureActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ ...request, action: z.literal("chooseDestination"), region: regionSchema }),
  z.strictObject({ ...quest, action: z.literal("acceptQuest") }),
  z.strictObject({ ...quest, action: z.literal("completeQuest"), code: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/u),
    feedback: z.string().trim().min(10).max(1000).optional(), postId: z.uuid().optional() }),
  z.strictObject({ ...request, action: z.literal("claimDaily") }),
  z.strictObject({ ...plot, action: z.enum(["clear", "upgrade", "finish", "harvest"]) }),
  z.strictObject({ ...plot, action: z.literal("build"), structure: structureSchema }),
  z.strictObject({ ...plot, action: z.literal("plant"), crop: cropSchema }),
  z.strictObject({ ...request, action: z.literal("questCreate"), id: z.uuid(), venueId: z.uuid(), title: z.string().trim().min(3).max(90),
    description: z.string().trim().min(10).max(1000), category: questCategorySchema, startsAt: time, endsAt: time,
    capacity: z.number().int().min(1).max(500), dishId: z.uuid().optional(), promotionId: z.uuid().optional(),
    discountPercent: z.number().int().min(1).max(50).optional() }),
  z.strictObject({ ...quest, action: z.enum(["questSubmit", "questIssue"]) }),
  z.strictObject({ ...quest, action: z.literal("questReview"), decision: z.enum(["approve", "reject", "withdraw"]), reason: z.string().trim().min(3).max(240) }),
]);
export type AdventureAction = z.infer<typeof adventureActionSchema>;
export const achievementSchema = z.object({ visits: integer, cuisines: integer, quests: integer, questCategories: integer,
  posts: integer, harvests: integer, buildings: integer });
export const adventureProfileSchema = z.object({ xp: integer, level: z.number().int().min(1).max(250), xpLevel: z.number().int().min(1).max(250),
  nextLevelXp: integer, tier: z.enum(["foundation", "community", "advanced", "mighty", "golden", "legendary"]),
  achievements: achievementSchema, nextRequirements: achievementSchema });
export const adventureQuestSchema = z.object({ id: z.uuid(), venueId: z.uuid(), venueName: z.string(), venueSlug: z.string(),
  title: z.string(), description: z.string(), category: questCategorySchema, rewardXp: integer, capacity: integer, acceptedCount: integer,
  startsAt: time, endsAt: time, status: z.enum(["draft", "pending", "published", "rejected", "withdrawn"]),
  discountPercent: integer.nullable(), dishId: z.uuid().nullable(), promotionId: z.uuid().nullable(),
  privateFeedback: z.array(z.string()).max(20),
  managed: z.boolean(), participation: z.object({ acceptedAt: time, completedAt: time.nullable(), awardedXp: integer }).nullable() });
export const resourcesSchema = z.object({ wood: integer, stone: integer, water: integer, seeds: integer, coins: integer });
export const outbackPlotSchema = z.object({ cell: z.number().int().min(0).max(15),
  kind: z.enum(["wild", "cleared", "farmhouse", "garden", "shed", "tank", "bakery"]), level: integer,
  status: z.enum(["ready", "building", "growing"]), readyAt: time.nullable(), crop: cropSchema.nullable() });
export const adventureStateSchema = z.object({ serverNow: time, profile: adventureProfileSchema,
  quests: z.array(adventureQuestSchema).max(200), partnerVenues: z.array(z.object({ id: z.uuid(), name: z.string() })).max(100),
  partnerDishes: z.array(z.object({ id: z.uuid(), venueId: z.uuid(), name: z.string() })).max(100),
  partnerPromotions: z.array(z.object({ id: z.uuid(), venueId: z.uuid(), title: z.string(), startsAt: time, endsAt: time })).max(100),
  operator: z.boolean(), village: z.object({ region: regionSchema, createdAt: time, resources: resourcesSchema,
    plots: z.array(outbackPlotSchema).length(16), dailyEligible: z.boolean(), dailyClaimed: z.boolean() }).nullable() });
export type AdventureState = z.infer<typeof adventureStateSchema>;
export type AdventureQuest = z.infer<typeof adventureQuestSchema>;
export type OutbackPlot = z.infer<typeof outbackPlotSchema>;
export type AdventureResources = z.infer<typeof resourcesSchema>;
