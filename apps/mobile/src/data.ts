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
    name: "Finch & Field",
    neighbourhood: "Fitzroy",
    category: "Cafe",
    cuisine: "Modern Australian",
    dish: "The good morning toast",
    colour: "#e7ebd9",
    plate: "brunch",
    mapX: 258,
    mapY: 112,
  },
  {
    id: "terra",
    name: "Ciao, Carlton",
    neighbourhood: "Carlton",
    category: "Restaurant",
    cuisine: "Italian",
    dish: "A very good margherita",
    colour: "#f1e6d5",
    plate: "pasta",
    mapX: 110,
    mapY: 82,
  },
  {
    id: "little",
    name: "Small Hours",
    neighbourhood: "Melbourne CBD",
    category: "Cafe",
    cuisine: "Cafe and bakery",
    dish: "The coffee and croissant ritual",
    colour: "#e8e4db",
    plate: "bowl",
    mapX: 172,
    mapY: 245,
  },
];

export const quests = [
  {
    id: "brunch",
    title: "The brunch round",
    description:
      "Plan three cafe stops around Melbourne for coffee and brunch.",
    category: "Cafe trail",
    count: 3,
  },
  {
    id: "world",
    title: "Around the Italian table",
    description:
      "A route through local Italian food, from pizza to a coffee stop.",
    category: "Italian food",
    count: 3,
  },
  {
    id: "local",
    title: "Coffee and something baked",
    description: "Two stops for a coffee and a pastry in the city.",
    category: "Coffee and bakery",
    count: 2,
  },
];
