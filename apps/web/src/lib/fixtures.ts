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
    dish: "The good morning toast",
    description:
      "Slow mornings, seasonal plates and a little neighbourhood warmth. Discover a fresh take on the classic Australian brunch.",
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
    dish: "A very good margherita",
    description:
      "A welcoming local table for wood-fired favourites, good company and the simple joy of sharing a pizza.",
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
    dish: "The coffee & croissant ritual",
    description:
      "Your pause in the city. Find small-batch coffee, flaky pastries and a quiet corner to enjoy them.",
    accent: "coffee",
  },
];

export const quests = [
  {
    id: "morning-person",
    title: "Become a morning person",
    category: "THE BRUNCH TRAIL",
    description:
      "Three local cafes. Three delicious reasons to get up a little earlier.",
    venues: 3,
    points: 150,
    image: "/images/brunch.jpg",
    difficulty: "Easy going",
  },
  {
    id: "little-italy",
    title: "A little taste of Italy",
    category: "CUISINE ADVENTURE",
    description:
      "Find the neighbourhood tables bringing a little Italian warmth to Melbourne.",
    venues: 3,
    points: 200,
    image: "/images/pizza.jpg",
    difficulty: "Take your time",
  },
  {
    id: "small-rituals",
    title: "The small rituals",
    category: "COFFEE & BAKERY",
    description:
      "A great coffee, a fresh pastry and a new favourite corner of the city.",
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
