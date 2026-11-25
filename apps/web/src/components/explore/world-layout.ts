/**
 * Coordinate contract for the Explore world.
 *
 * The Explore scene is a stylised illustration of inner Melbourne, not a survey
 * map. Real coordinates are projected into one fixed 1800 x 1150 world so that
 * the artwork, the venue markers, the explorer and the discovery rings all share
 * the same geometry. Keep this file free of React and of artwork so both the
 * scene and the static illustration can import it.
 */

export const WORLD = { width: 1800, height: 1150 } as const;

export type WorldPoint = { x: number; y: number };

/** WGS84 window covering the CBD, the Yarra and the eastern gardens. */
export const MAP_BOUNDS = {
  west: 144.943,
  east: 144.98,
  north: -37.8055,
  south: -37.8265,
} as const;

const longitudeSpan = MAP_BOUNDS.east - MAP_BOUNDS.west;
const latitudeSpan = MAP_BOUNDS.north - MAP_BOUNDS.south;

export function projectToWorld(point: { longitude: number; latitude: number }): WorldPoint {
  return {
    x: ((point.longitude - MAP_BOUNDS.west) / longitudeSpan) * WORLD.width,
    y: ((MAP_BOUNDS.north - point.latitude) / latitudeSpan) * WORLD.height,
  };
}

export function clampWorld(point: WorldPoint): WorldPoint {
  return {
    x: Math.min(WORLD.width - 24, Math.max(24, point.x)),
    y: Math.min(WORLD.height - 24, Math.max(24, point.y)),
  };
}

/** Reverse the projection so a tapped ground point can become a walk request. */
export function unprojectFromWorld(point: WorldPoint): { longitude: number; latitude: number } {
  return {
    longitude: MAP_BOUNDS.west + (point.x / WORLD.width) * longitudeSpan,
    latitude: MAP_BOUNDS.north - (point.y / WORLD.height) * latitudeSpan,
  };
}

export type Street = {
  id: string;
  name: string;
  /** x for north-south streets, y for east-west streets. */
  at: number;
  width: number;
};

/**
 * Street centrelines, projected from real Melbourne road coordinates so markers
 * and walking stay in the same relationship to each other as they do on site.
 */
export const STREETS: { vertical: Street[]; horizontal: Street[] } = {
  vertical: [
    { id: "elizabeth", name: "Elizabeth St", at: projectToWorld({ longitude: 144.9595, latitude: -37.816 }).x, width: 46 },
    { id: "swanston", name: "Swanston St", at: projectToWorld({ longitude: 144.9629, latitude: -37.816 }).x, width: 68 },
    { id: "russell", name: "Russell St", at: projectToWorld({ longitude: 144.9674, latitude: -37.816 }).x, width: 44 },
    { id: "exhibition", name: "Exhibition St", at: projectToWorld({ longitude: 144.9715, latitude: -37.816 }).x, width: 44 },
    { id: "spring", name: "Spring St", at: projectToWorld({ longitude: 144.974, latitude: -37.816 }).x, width: 48 },
  ],
  horizontal: [
    { id: "latrobe", name: "La Trobe St", at: projectToWorld({ longitude: 144.962, latitude: -37.809 }).y, width: 44 },
    { id: "lonsdale", name: "Lonsdale St", at: projectToWorld({ longitude: 144.962, latitude: -37.8118 }).y, width: 44 },
    { id: "bourke", name: "Bourke St", at: projectToWorld({ longitude: 144.962, latitude: -37.8136 }).y, width: 52 },
    { id: "collins", name: "Collins St", at: projectToWorld({ longitude: 144.962, latitude: -37.8168 }).y, width: 56 },
    { id: "flinders", name: "Flinders St", at: projectToWorld({ longitude: 144.962, latitude: -37.8185 }).y, width: 54 },
  ],
};

export const MAIN_AVENUE = STREETS.vertical.find(street => street.id === "swanston")!;
export const MAIN_CROSS_STREET = STREETS.horizontal.find(street => street.id === "collins")!;

/** River banks. The water fills the band between the two curves. */
export const RIVER = {
  north: 792,
  south: 986,
  northBank:
    "M-40 812 C 220 764 470 826 760 794 C 1030 764 1280 740 1520 766 C 1660 782 1750 806 1840 794",
  southBank:
    "M-40 998 C 220 950 470 1012 760 980 C 1030 950 1280 926 1520 952 C 1660 968 1750 992 1840 980",
  highlight:
    "M-40 858 C 240 818 470 866 760 838 C 1040 812 1270 792 1520 816 C 1670 830 1760 848 1840 840",
} as const;

/** Bridges across the Yarra, drawn as stone decks with lamps. */
export const BRIDGES = [
  { id: "princes", name: "Princes Bridge", x: MAIN_AVENUE.at, width: 104 },
  { id: "queens", name: "Queens Bridge", x: 300, width: 86 },
] as const;

/** Paved public space where a manual explorer starts. */
export const PLAZA = {
  id: "city-square",
  x: MAIN_AVENUE.at + 8,
  y: MAIN_CROSS_STREET.at + 26,
  width: 176,
  height: 92,
} as const;

export type Garden = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pond?: { x: number; y: number; rx: number; ry: number };
};

/** Green space the buildings must leave clear. */
export const GARDENS: Garden[] = [
  {
    id: "royal-gardens",
    name: "Royal Gardens",
    x: 1524,
    y: 44,
    width: 252,
    height: 596,
    pond: { x: 1650, y: 300, rx: 62, ry: 40 },
  },
  {
    id: "yarra-park",
    name: "Yarra Park",
    x: 40,
    y: 1054,
    width: 470,
    height: 88,
  },
  {
    id: "carlton-gardens",
    name: "Carlton Gardens",
    x: 616,
    y: 44,
    width: 210,
    height: 118,
  },
];

export type Landmark = {
  id: string;
  name: string;
  kind: "station" | "market" | "hall" | "tower" | "bar" | "plaza" | "bridge";
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Named structures the illustration must draw. The map markers and the quest
 * copy refer to these by id, so keep ids stable.
 */
export const LANDMARKS: Landmark[] = [
  { id: "flinders-station", name: "Flinders Street Station", kind: "station", x: 1074, y: 726, width: 268, height: 60 },
  { id: "queen-victoria-market", name: "Queen Victoria Market", kind: "market", x: 624, y: 62, width: 168, height: 96 },
  { id: "royal-exhibition", name: "Royal Exhibition Building", kind: "hall", x: 1600, y: 118, width: 148, height: 104 },
  { id: "melbourne-central", name: "Melbourne Central", kind: "tower", x: 912, y: 246, width: 118, height: 84 },
  { id: "collins-place", name: "Collins Place", kind: "tower", x: 1300, y: 556, width: 96, height: 74 },
  { id: "federation-square", name: "Federation Square", kind: "plaza", x: 1372, y: 728, width: 150, height: 60 },
  { id: "laneway-bar", name: "Laneway Bar", kind: "bar", x: 700, y: 470, width: 74, height: 66 },
];

/** Where a manual explorer begins: Swanston and Collins, facing the river. */
export const START_POINT: WorldPoint = projectToWorld({ longitude: 144.9671462327242, latitude: -37.81681344435442 });

/**
 * Public landmark reference points used to orient the map when no restaurant is
 * published nearby. These are real city landmarks, not Food Go partner venues,
 * and they never carry offers, encounters or verified visit claims.
 */
export const LANDMARK_PLACES = [
  { id: "flinders-street-station", name: "Flinders Street Station", area: "Melbourne CBD", longitude: 144.9671, latitude: -37.8183 },
  { id: "state-library-victoria", name: "State Library Victoria", area: "Melbourne CBD", longitude: 144.9645, latitude: -37.8096 },
  { id: "chinatown", name: "Chinatown", area: "Melbourne CBD", longitude: 144.9666, latitude: -37.8115 },
  { id: "degraves-street", name: "Degraves Street", area: "Melbourne CBD", longitude: 144.9656, latitude: -37.8171 },
  { id: "hosier-lane", name: "Hosier Lane", area: "Melbourne CBD", longitude: 144.9693, latitude: -37.8167 },
  { id: "southbank-promenade", name: "Southbank Promenade", area: "Southbank", longitude: 144.966, latitude: -37.8205 },
  { id: "royal-exhibition-building", name: "Royal Exhibition Building", area: "Carlton", longitude: 144.9715, latitude: -37.8047 },
  { id: "princess-theatre", name: "Princess Theatre", area: "Melbourne CBD", longitude: 144.9725, latitude: -37.8105 },
  { id: "old-melbourne-gaol", name: "Old Melbourne Gaol", area: "Melbourne CBD", longitude: 144.965, latitude: -37.808 },
  { id: "sea-life-melbourne", name: "SEA LIFE Melbourne", area: "Melbourne CBD", longitude: 144.9585, latitude: -37.8207 },
  { id: "queen-victoria-market", name: "Queen Victoria Market", area: "Melbourne CBD", longitude: 144.9572, latitude: -37.8075 },
  { id: "melbourne-central", name: "Melbourne Central", area: "Melbourne CBD", longitude: 144.9628, latitude: -37.8105 },
] as const;

/** Street name plates. Position is the centre of the text. */
export const STREET_LABELS: { id: string; text: string; x: number; y: number; rotate?: number }[] = [
  { id: "swanston-label", text: "Swanston St", x: MAIN_AVENUE.at + 14, y: 560, rotate: -90 },
  { id: "russell-label", text: "Russell St", x: projectToWorld({ longitude: 144.9674, latitude: -37.816 }).x + 12, y: 366, rotate: -90 },
  { id: "elizabeth-label", text: "Elizabeth St", x: projectToWorld({ longitude: 144.9595, latitude: -37.816 }).x + 10, y: 300, rotate: -90 },
  { id: "spring-label", text: "Spring St", x: projectToWorld({ longitude: 144.974, latitude: -37.816 }).x + 12, y: 486, rotate: -90 },
  { id: "collins-label", text: "Collins St", x: 520, y: MAIN_CROSS_STREET.at - 12 },
  { id: "flinders-label", text: "Flinders St", x: 640, y: STREETS.horizontal.find(street => street.id === "flinders")!.at - 12 },
  { id: "bourne-label", text: "Bourke St", x: 1236, y: STREETS.horizontal.find(street => street.id === "bourke")!.at - 12 },
  { id: "latrobe-label", text: "La Trobe St", x: 900, y: STREETS.horizontal.find(street => street.id === "latrobe")!.at - 12 },
  { id: "yarra-label", text: "Yarra River", x: 470, y: 902, rotate: -4 },
];
