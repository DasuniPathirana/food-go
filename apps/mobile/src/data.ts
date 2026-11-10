export type Venue = {
  id: string;
  name: string;
  neighbourhood: string;
  category: "Cafe" | "Restaurant";
  cuisine: string;
  dish: string;
  colour: string;
  plate: "brunch" | "pasta" | "bowl";
  mapX: number;
  mapY: number;
};

// Fictional fixtures only. No venue, visit or dish claim is verified.
export const venues: Venue[] = [
  {
    id: "fern",
    name: "Fern & Fig",
    neighbourhood: "Fitzroy",
    category: "Cafe",
    cuisine: "Modern Australian",
    dish: "Garden brunch bowl",
    colour: "#e7ebd9",
    plate: "brunch",
    mapX: 211,
    mapY: 86,
  },
  {
    id: "terra",
    name: "Terra Kitchen",
    neighbourhood: "Carlton",
    category: "Restaurant",
    cuisine: "Italian",
    dish: "Handmade basil pasta",
    colour: "#f1e6d5",
    plate: "pasta",
    mapX: 112,
    mapY: 137,
  },
  {
    id: "little",
    name: "Little Harvest",
    neighbourhood: "Collingwood",
    category: "Cafe",
    cuisine: "Seasonal Australian",
    dish: "Roasted harvest bowl",
    colour: "#e8e4db",
    plate: "bowl",
    mapX: 274,
    mapY: 165,
  },
];

export const quests = [
  {
    id: "brunch",
    title: "The slow morning trail",
    description:
      "Discover three neighbourhood cafes, one good morning at a time.",
    category: "CAFE CULTURE",
    count: 3,
  },
  {
    id: "world",
    title: "A world on your plate",
    description: "Try dishes from four different cuisines across your city.",
    category: "CUISINE ADVENTURE",
    count: 4,
  },
  {
    id: "local",
    title: "Find your new local",
    description: "Get to know two independent venues in one neighbourhood.",
    category: "NEIGHBOURHOOD",
    count: 2,
  },
];
