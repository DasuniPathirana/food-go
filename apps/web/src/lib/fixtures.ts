export type Venue = {
  id: string;
  name: string;
  suburb: string;
  address: string;
  cuisine: string;
  type: "cafe" | "restaurant" | "market";
  tags: string[];
  image: string;
  imageAlt: string;
  dish: string;
  description: string;
  accent: string;
};

/** Fictional venues. Never merge fixtures into a production venue database. */
export const venues: Venue[] = [
  {
    id: "finch-and-field",
    name: "Finch & Field",
    suburb: "Fitzroy",
    address: "Example address, Fitzroy VIC 3065",
    cuisine: "Modern Australian",
    type: "cafe",
    tags: ["Brunch", "Vegetarian"],
    image: "/images/brunch.jpg",
    imageAlt: "Avocado toast with fresh greens on a ceramic plate",
    dish: "Avocado toast",
    description:
      "A neighbourhood cafe serving breakfast, seasonal bowls and coffee. Start with the avocado toast.",
    accent: "brunch",
  },
  {
    id: "ciao-carlton",
    name: "Ciao, Carlton",
    suburb: "Carlton",
    address: "Example address, Carlton VIC 3053",
    cuisine: "Italian",
    type: "restaurant",
    tags: ["Pizza", "Vegetarian"],
    image: "/images/pizza.jpg",
    imageAlt: "Freshly baked pizza topped with tomatoes, cheese and basil",
    dish: "Margherita pizza",
    description:
      "An Italian restaurant example with wood-fired pizza and a seasonal menu. The margherita is the signature dish.",
    accent: "pizza",
  },
  {
    id: "small-hours",
    name: "Small Hours",
    suburb: "Melbourne CBD",
    address: "Example address, Melbourne VIC 3000",
    cuisine: "Cafe & bakery",
    type: "cafe",
    tags: ["Coffee", "Bakery"],
    image: "/images/coffee.jpg",
    imageAlt: "A golden croissant and a cup of coffee on a cafe table",
    dish: "Coffee and croissant",
    description:
      "A city cafe example for coffee, pastries and a quick breakfast. Add it to a morning food trail.",
    accent: "coffee",
  },
];

export const quests = [
  {
    id: "morning-person",
    title: "The Fitzroy brunch round",
    category: "Brunch trail",
    description:
      "Plan a morning around Fitzroy's cafes. Choose a few stops and leave room for breakfast.",
    venues: 3,
    points: 150,
    image: "/images/brunch.jpg",
    difficulty: "Easy going",
  },
  {
    id: "little-italy",
    title: "Lunch around Carlton",
    category: "Italian food trail",
    description:
      "Plan a few Italian food stops around Carlton, with time for a pizza.",
    venues: 3,
    points: 200,
    image: "/images/pizza.jpg",
    difficulty: "Take your time",
  },
  {
    id: "small-rituals",
    title: "Coffee and a bakery stop",
    category: "Cafe trail",
    description: "Find a coffee stop and a bakery to try on the same morning.",
    venues: 2,
    points: 100,
    image: "/images/coffee.jpg",
    difficulty: "Easy going",
  },
];

export const cities = [
  "Melbourne",
  "Sydney",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Hobart",
  "Canberra",
  "Darwin",
];

export function filterVenues(
  query: string,
  category: string,
  city = "Melbourne",
) {
  if (city !== "Melbourne") return [];
  const search = query.trim().toLocaleLowerCase("en-AU");
  return venues.filter((venue) => {
    const matchesSearch =
      `${venue.name} ${venue.suburb} ${venue.cuisine} ${venue.tags.join(" ")} ${venue.dish}`
        .toLocaleLowerCase("en-AU")
        .includes(search);
    const matchesCategory =
      category === "All discoveries" ||
      (category === "Cafes" && venue.type === "cafe") ||
      (category === "Restaurants" && venue.type === "restaurant") ||
      (category === "Food markets" && venue.type === "market") ||
      (category === "Vegetarian" && venue.tags.includes("Vegetarian"));
    return matchesSearch && matchesCategory;
  });
}
