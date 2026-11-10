"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Map,
  Coffee,
  UtensilsCrossed,
  Leaf,
  Store,
  Compass,
  Route,
  X,
} from "lucide-react";
import { cities, filterVenues, venues } from "@/lib/fixtures";
import { useSavedVenues } from "@/lib/preferences";
import { VenueCard } from "./venue-card";
import { IllustratedMap } from "./illustrated-map";

const categories = [
  { title: "All discoveries", icon: Compass },
  { title: "Cafes", icon: Coffee },
  { title: "Restaurants", icon: UtensilsCrossed },
  { title: "Food markets", icon: Store },
  { title: "Vegetarian", icon: Leaf },
];

export function Explore() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Melbourne");
  const [category, setCategory] = useState("All discoveries");
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState(venues[0].id);
  const [showFilters, setShowFilters] = useState(false);
  const { saved, toggle } = useSavedVenues();
  const filtered = filterVenues(query, category, city);
  const selectedVenue =
    filtered.find((venue) => venue.id === selected) || filtered[0];
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">FOLLOW YOUR APPETITE</div>
          <h1>Find your next favourite.</h1>
          <p>Find local flavours. Collect new experiences. Make a day of it.</p>
        </div>
        <label className="location-select">
          <MapPin size={18} />
          <span>
            <span className="field-caption">EXPLORING IN</span>
            <select
              aria-label="Choose your city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              {cities.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <section className="discovery-hero" aria-label="Featured food adventure">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span />
            SOMETHING GOOD IS AROUND THE CORNER
          </div>
          <h2>
            Go a little further.
            <br />
            Find a new favourite.
          </h2>
          <p>
            Your neighbourhood has a few delicious secrets.
            <br className="desktop-break" /> Let’s see what you can discover.
          </p>
          <Link href="/quests" className="primary-button">
            Find your first adventure
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="hero-image">
          <Image
            src="/images/brunch.jpg"
            alt="A colourful brunch plate with avocado toast and fresh greens"
            width={1200}
            height={700}
            priority
            sizes="(max-width: 640px) 100vw, 50vw"
          />
          <div className="hero-image-caption">
            <span className="hero-caption-icon">
              <Leaf size={19} />
            </span>
            <span>
              A fresh take on your everyday.
              <small>A little taste of what’s out there</small>
            </span>
            <ArrowUpRight size={19} />
          </div>
        </div>
        <span className="hero-decoration" aria-hidden="true" />
      </section>
      <section className="nearby-section" aria-labelledby="nearby-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">GOOD THINGS, CLOSE BY</div>
            <h2 id="nearby-title">A few places to get you started</h2>
          </div>
          <div className="view-toggle" aria-label="Discovery view">
            <button
              onClick={() => setView("list")}
              className={view === "list" ? "selected" : ""}
              aria-pressed={view === "list"}
            >
              <LayoutGrid size={16} />
              <span>List</span>
            </button>
            <button
              onClick={() => setView("map")}
              className={view === "map" ? "selected" : ""}
              aria-pressed={view === "map"}
            >
              <Map size={16} />
              <span>Map</span>
            </button>
          </div>
        </div>
        <div className="discovery-toolbar">
          <label className="search-input">
            <Search size={18} />
            <input
              type="search"
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="A dish, a cuisine, a favourite suburb..."
              aria-label="Search venues, dishes or suburbs"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </label>
          <button
            className={`filter-button ${showFilters ? "selected" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="extra-filter-options"
          >
            <SlidersHorizontal size={17} />
            Filters
            {category !== "All discoveries" && (
              <span className="filter-count">1</span>
            )}
          </button>
        </div>
        <div className="discovery-filters" id="discovery-filters">
          {categories.map(({ title, icon: Icon }) => (
            <button
              key={title}
              className={`category-chip ${category === title ? "selected" : ""}`}
              onClick={() => setCategory(title)}
              aria-pressed={category === title}
            >
              <Icon size={15} />
              {title}
            </button>
          ))}
        </div>
        <div
          className="filter-panel"
          id="extra-filter-options"
          hidden={!showFilters}
        >
          <p>
            <strong>Make it your kind of discovery.</strong> Choose a category
            above and combine it with a cuisine or suburb search. Example venues
            are currently available in Melbourne.
          </p>
          <button
            className="text-button"
            onClick={() => {
              setCategory("All discoveries");
              setQuery("");
            }}
          >
            Reset filters
            <X size={14} />
          </button>
        </div>
        <div className="results-meta" aria-live="polite">
          <span>
            {filtered.length} example{" "}
            {filtered.length === 1 ? "venue" : "venues"} in {city}
          </span>
          <span>Independently curious. Locally inspired.</span>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Compass size={32} />
            <h3>
              {city === "Melbourne"
                ? "A little further off the beaten path."
                : `Good things are coming to ${city}.`}
            </h3>
            <p>
              {city === "Melbourne"
                ? "Try another dish, suburb or category to find an example venue."
                : "This preview has Melbourne examples. Other cities will appear as verified venues join."}
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setCity("Melbourne");
                setQuery("");
                setCategory("All discoveries");
              }}
            >
              Explore Melbourne examples
              <ArrowRight size={16} />
            </button>
          </div>
        ) : view === "list" ? (
          <div className="venue-grid">
            {filtered.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                saved={saved.includes(venue.id)}
                onSave={() => toggle(venue.id)}
              />
            ))}
          </div>
        ) : (
          <div className="map-view">
            <IllustratedMap
              venues={filtered}
              selected={selectedVenue?.id}
              onSelect={setSelected}
            />
            {selectedVenue && (
              <VenueCard
                venue={selectedVenue}
                saved={saved.includes(selectedVenue.id)}
                onSave={() => toggle(selectedVenue.id)}
              />
            )}
          </div>
        )}
      </section>
      <Link href="/quests" className="trail-banner">
        <span className="trail-icon">
          <Route size={27} />
        </span>
        <div>
          <span className="eyebrow">
            TURN A GOOD MEAL INTO A LITTLE ADVENTURE
          </span>
          <h3>One neighbourhood. A whole new food story.</h3>
          <p>
            Follow a food trail and discover a few new favourites along the way.
          </p>
        </div>
        <span className="trail-link">
          Explore the trails
          <ArrowRight size={18} />
        </span>
      </Link>
    </>
  );
}
