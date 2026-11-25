import { z } from "zod";

export const mallFloorSchema = z.strictObject({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(64),
  level: z.number().int().min(-5).max(10),
  description: z.string().max(200).optional(),
});
export type MallFloor = z.infer<typeof mallFloorSchema>;

export const mallShopUnitSchema = z.strictObject({
  id: z.string().min(1).max(64),
  mallId: z.string().min(1).max(64),
  floorId: z.string().min(1).max(32),
  unitNumber: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  category: z.enum(["restaurant", "cafe", "takeaway", "dessert", "kiosk", "food_hall"]),
  cuisine: z.string().max(60).optional(),
  venueId: z.string().uuid().optional(),
  openingHours: z.string().max(100).optional(),
});
export type MallShopUnit = z.infer<typeof mallShopUnitSchema>;

export const mallFloorQuestSchema = z.strictObject({
  id: z.string().min(1).max(64),
  mallId: z.string().min(1).max(64),
  floorId: z.string().min(1).max(32),
  title: z.string().min(2).max(100),
  description: z.string().min(5).max(300),
  rewardXp: z.number().int().min(10).max(500),
  targetUnitId: z.string().max(64).optional(),
});
export type MallFloorQuest = z.infer<typeof mallFloorQuestSchema>;

export const mallCollectibleSchema = z.strictObject({
  id: z.string().min(1).max(64),
  mallId: z.string().min(1).max(64),
  floorId: z.string().min(1).max(32),
  name: z.string().min(2).max(80),
  rarity: z.enum(["common", "uncommon", "rare", "epic"]),
  description: z.string().min(5).max(200),
});
export type MallCollectible = z.infer<typeof mallCollectibleSchema>;

export const mallDataSchema = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(2).max(120),
  suburb: z.string().min(2).max(80),
  state: z.literal("VIC"),
  coordinates: z.strictObject({
    longitude: z.number().min(144.9).max(145.0),
    latitude: z.number().min(-37.9).max(-37.7),
  }),
  entrance: z.strictObject({
    description: z.string().min(5).max(200),
    streetName: z.string().min(2).max(100),
  }),
  floors: z.array(mallFloorSchema).min(1),
  shops: z.array(mallShopUnitSchema),
  quests: z.array(mallFloorQuestSchema),
  collectibles: z.array(mallCollectibleSchema),
});
export type MallData = z.infer<typeof mallDataSchema>;

/** Genuine Melbourne Central Mall layout and directory */
export const MELBOURNE_CENTRAL_MALL: MallData = {
  id: "melbourne-central",
  name: "Melbourne Central",
  suburb: "Melbourne CBD",
  state: "VIC",
  coordinates: { longitude: 144.962750, latitude: -37.810537 },
  entrance: {
    description: "Main glass atrium entrance under the historic Shot Tower cone",
    streetName: "La Trobe St & Swanston St",
  },
  floors: [
    { id: "lg", name: "Lower Ground - Food Hall", level: -1, description: "Fast bites, bubble tea and underground train concourse access." },
    { id: "g", name: "Ground Floor - Shot Tower Square", level: 0, description: "Central plaza, landmark Coop's Shot Tower and artisanal cafes." },
    { id: "l1", name: "Level 1 - Fashion & Cafes", level: 1, description: "Specialty coffee corners, fashion boutiques and walkway to Emporium." },
    { id: "l2", name: "Level 2 - Dining Precinct", level: 2, description: "Sit-down Asian dining, ramen bars and dumpling houses." },
    { id: "l3", name: "Level 3 - Entertainment & Desserts", level: 3, description: "Cinema concourse, dessert lounges and cocktail venues." },
  ],
  shops: [
    { id: "mc-lg-01", mallId: "melbourne-central", floorId: "lg", unitNumber: "LG-04", name: "Dragon Dumpling House", category: "restaurant", cuisine: "Chinese" },
    { id: "mc-lg-02", mallId: "melbourne-central", floorId: "lg", unitNumber: "LG-12", name: "Bao Bun Express", category: "takeaway", cuisine: "Taiwanese" },
    { id: "mc-lg-03", mallId: "melbourne-central", floorId: "lg", unitNumber: "LG-18", name: "Matcha Mist", category: "dessert", cuisine: "Japanese Drinks" },
    { id: "mc-g-01", mallId: "melbourne-central", floorId: "g", unitNumber: "G-01", name: "Shot Tower Roasters", category: "cafe", cuisine: "Coffee & Pastries" },
    { id: "mc-g-02", mallId: "melbourne-central", floorId: "g", unitNumber: "G-15", name: "Laneway Crepes", category: "kiosk", cuisine: "French" },
    { id: "mc-l1-01", mallId: "melbourne-central", floorId: "l1", unitNumber: "L1-08", name: "Komorebi Tea House", category: "cafe", cuisine: "Japanese Tea" },
    { id: "mc-l2-01", mallId: "melbourne-central", floorId: "l2", unitNumber: "L2-02", name: "Hakata Tonkotsu Lab", category: "restaurant", cuisine: "Ramen" },
    { id: "mc-l2-02", mallId: "melbourne-central", floorId: "l2", unitNumber: "L2-11", name: "Siam Spice Kitchen", category: "restaurant", cuisine: "Thai" },
    { id: "mc-l3-01", mallId: "melbourne-central", floorId: "l3", unitNumber: "L3-05", name: "Sweet Cloud Souffle", category: "dessert", cuisine: "Pancakes & Desserts" },
  ],
  quests: [
    { id: "mc-q1", mallId: "melbourne-central", floorId: "g", title: "Shot Tower Discovery", description: "Visit the historic Shot Tower square and check in at Shot Tower Roasters.", rewardXp: 75, targetUnitId: "mc-g-01" },
    { id: "mc-q2", mallId: "melbourne-central", floorId: "l2", title: "Noodle Master Exploration", description: "Discover the Level 2 dining precinct and sample Hakata Tonkotsu Lab.", rewardXp: 120, targetUnitId: "mc-l2-01" },
  ],
  collectibles: [
    { id: "mc-c1", mallId: "melbourne-central", floorId: "g", name: "Golden Pocket Watch of Melbourne Central", rarity: "rare", description: "Commemorates the iconic pocket watch in the central atrium." },
    { id: "mc-c2", mallId: "melbourne-central", floorId: "l3", name: "Starlight Neon Badge", rarity: "uncommon", description: "Found under the glowing entertainment concourse lights." },
  ],
};

/** Genuine QV Village layout and directory */
export const QV_VILLAGE_MALL: MallData = {
  id: "qv-village",
  name: "QV Village",
  suburb: "Melbourne CBD",
  state: "VIC",
  coordinates: { longitude: 144.965715, latitude: -37.810689 },
  entrance: {
    description: "Pedestrian laneway entrance connecting Swanston, Lonsdale and Russell Streets",
    streetName: "Corner Lonsdale St & Swanston St",
  },
  floors: [
    { id: "qv-b1", name: "Urban Market (Basement 1)", level: -1, description: "Supermarket, Asian grocers and quick lane snacks." },
    { id: "qv-g", name: "QV Square (Ground Level)", level: 0, description: "Open-air European-style central square and casual eateries." },
    { id: "qv-l1", name: "Level 1 - Laneway Dining", level: 1, description: "Contemporary casual dining overlooking Albert Coates Lane." },
    { id: "qv-l2", name: "Level 2 - Food & Lifestyle", level: 2, description: "Specialty food vendors and lifestyle services." },
  ],
  shops: [
    { id: "qv-b1-01", mallId: "qv-village", floorId: "qv-b1", unitNumber: "B1-02", name: "Tokyo Bread Bar", category: "takeaway", cuisine: "Japanese Bakery" },
    { id: "qv-g-01", mallId: "qv-village", floorId: "qv-g", unitNumber: "G-06", name: "Square Espresso", category: "cafe", cuisine: "Australian Specialty Coffee" },
    { id: "qv-g-02", mallId: "qv-village", floorId: "qv-g", unitNumber: "G-10", name: "Gelato Gusto", category: "dessert", cuisine: "Artisanal Gelato" },
    { id: "qv-l1-01", mallId: "qv-village", floorId: "qv-l1", unitNumber: "L1-04", name: "Papa Rich Nyonya", category: "restaurant", cuisine: "Malaysian" },
    { id: "qv-l2-01", mallId: "qv-village", floorId: "qv-l2", unitNumber: "L2-01", name: "Grill & Flame Yakitori", category: "restaurant", cuisine: "Japanese Grill" },
  ],
  quests: [
    { id: "qv-q1", mallId: "qv-village", floorId: "qv-g", title: "Open-Air Laneway Walk", description: "Cross the open central square and grab a coffee at Square Espresso.", rewardXp: 80, targetUnitId: "qv-g-01" },
  ],
  collectibles: [
    { id: "qv-c1", mallId: "qv-village", floorId: "qv-g", name: "Albert Coates Laneway Token", rarity: "uncommon", description: "Found along the historic hospital courtyard stones." },
  ],
};

const mallRegistry = new Map<string, MallData>([
  [MELBOURNE_CENTRAL_MALL.id, MELBOURNE_CENTRAL_MALL],
  [QV_VILLAGE_MALL.id, QV_VILLAGE_MALL],
]);

export function getMallById(id: string): MallData | null {
  return mallRegistry.get(id) ?? null;
}

export function getAllMalls(): MallData[] {
  return Array.from(mallRegistry.values());
}

export function registerMall(mall: MallData): void {
  mallDataSchema.parse(mall);
  mallRegistry.set(mall.id, mall);
}

function haversineMetres(coord1: { longitude: number; latitude: number }, coord2: { longitude: number; latitude: number }) {
  const R = 6371000;
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const lat1 = coord1.latitude * Math.PI / 180;
  const lat2 = coord2.latitude * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getMallByCoordinate(coord: { longitude: number; latitude: number }, thresholdMetres = 120): MallData | null {
  let closest: MallData | null = null;
  let minDistance = Infinity;
  for (const mall of mallRegistry.values()) {
    const d = haversineMetres(coord, mall.coordinates);
    if (d <= thresholdMetres && d < minDistance) {
      closest = mall;
      minDistance = d;
    }
  }
  return closest;
}

export function getMallShopsByFloor(mallId: string, floorId: string): MallShopUnit[] {
  const mall = getMallById(mallId);
  return mall ? mall.shops.filter(shop => shop.floorId === floorId) : [];
}

export function getMallQuestsByFloor(mallId: string, floorId: string): MallFloorQuest[] {
  const mall = getMallById(mallId);
  return mall ? mall.quests.filter(quest => quest.floorId === floorId) : [];
}

export function getMallCollectiblesByFloor(mallId: string, floorId: string): MallCollectible[] {
  const mall = getMallById(mallId);
  return mall ? mall.collectibles.filter(collectible => collectible.floorId === floorId) : [];
}
