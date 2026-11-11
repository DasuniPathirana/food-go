"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  MapPin,
  Search,
  Map,
  LayoutGrid,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { cities, filterVenues, venues, type Venue } from "@/lib/fixtures";
import { useSavedVenues } from "@/lib/preferences";
import { IllustratedMap } from "./illustrated-map";
import { VenueCard } from "./venue-card";

const categories = [
  "All discoveries",
  "Cafes",
  "Restaurants",
  "Food markets",
  "Vegetarian",
];
const cityRegions: Record<string, string> = {
  Melbourne: "Victoria",
  Sydney: "New South Wales",
  Brisbane: "Queensland",
  Perth: "Western Australia",
  Adelaide: "South Australia",
  Hobart: "Tasmania",
  Canberra: "Australian Capital Territory",
  Darwin: "Northern Territory",
};

function PlaceRow({
  venue,
  index,
  selected,
  onSelect,
  saved,
  onSave,
}: {
  venue: Venue;
  index: number;
  selected: boolean;
  onSelect: () => void;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className={`place-row ${selected ? "is-selected" : ""}`}>
      <button
        className="place-photo"
        onClick={onSelect}
        aria-label={`Select ${venue.name} on the map`}
        aria-pressed={selected}
      >
        <Image
          src={venue.image}
          alt={venue.imageAlt}
          width={280}
          height={280}
          sizes="120px"
        />
        <span>{String(index + 1).padStart(2, "0")}</span>
      </button>
      <Link className="place-row-copy" href={`/venues/${venue.id}`}>
        <p className="place-category">{venue.cuisine}</p>
        <h3>
          {venue.name} <ArrowRight size={15} />
        </h3>
        <p className="place-suburb">
          {venue.suburb} <span>·</span>{" "}
          {venue.type === "cafe" ? "Cafe" : "Restaurant"}
        </p>
        <p className="place-signature">Try the {venue.dish.toLowerCase()}.</p>
      </Link>
      <button
        className={`row-save ${saved ? "is-saved" : ""}`}
        onClick={onSave}
        aria-label={`${saved ? "Unsave" : "Save"} ${venue.name}`}
        aria-pressed={saved}
      >
        <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

export function Discovery() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Melbourne");
  const [category, setCategory] = useState("All discoveries");
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState(venues[0].id);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { saved, toggle } = useSavedVenues();
  const filtered = filterVenues(query, category, city);
  const selectedId = filtered.some((venue) => venue.id === selected)
    ? selected
    : filtered[0]?.id;
  function reset() {
    setCity("Melbourne");
    setQuery("");
    setCategory("All discoveries");
  }
  return (
    <>
      <section className="discovery-intro">
        <div>
          <p className="edition-label">
            <span className="edition-mark" />
            Your neighbourhood food guide
          </p>
          <h1>Where are we eating?</h1>
          <p>Find a place for lunch, or save a few for the weekend.</p>
        </div>
        <Link href="/quests" className="intro-trail-link">
          <span>Make an afternoon of it</span>
          <strong>
            Pick a food trail <ArrowRight size={17} />
          </strong>
        </Link>
      </section>
      <section className="discovery-controls" aria-label="Find a place">
        <div className="search-bar">
          <label className="discovery-search">
            <Search size={20} />
            <input
              type="search"
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search venues, dishes or suburbs"
              placeholder="Search a place, dish or suburb"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X size={18} />
              </button>
            )}
          </label>
          <label className="city-field">
            <MapPin size={18} />
            <select
              aria-label="Choose your city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            >
              {cities.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <button
            className="discovery-filter-button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="extra-filter-options"
          >
            <SlidersHorizontal size={18} />
            <span>Filters</span>
          </button>
          <div className="view-toggle" aria-label="Discovery view">
            <button
              aria-label="Map"
              aria-pressed={view === "map"}
              className={view === "map" ? "selected" : ""}
              onClick={() => setView("map")}
            >
              <Map size={17} />
              <span>Map</span>
            </button>
            <button
              aria-label="List"
              aria-pressed={view === "list"}
              className={view === "list" ? "selected" : ""}
              onClick={() => setView("list")}
            >
              <LayoutGrid size={17} />
              <span>List</span>
            </button>
          </div>
        </div>
        <div className="category-row">
          <div className="category-options">
            {categories.map((title) => (
              <button
                key={title}
                className={category === title ? "selected" : ""}
                aria-pressed={category === title}
                onClick={() => setCategory(title)}
              >
                {category === title && <Check size={13} />}{" "}
                {title === "All discoveries" ? "Everything" : title}
              </button>
            ))}
          </div>
        </div>
        <div
          id="extra-filter-options"
          className="filter-panel"
          hidden={!filtersOpen}
        >
          <p>
            Search by cuisine or suburb, then choose a category. This preview
            contains three example venues in Melbourne.
          </p>
          <button className="text-button" onClick={reset}>
            Reset filters <X size={15} />
          </button>
        </div>
      </section>
      <section className="discovery-results" aria-label="Places to explore">
        <div className="results-heading">
          <h2>
            {city}
            <span>{cityRegions[city]}, Australia</span>
          </h2>
          <p aria-live="polite">
            {filtered.length} example{" "}
            {filtered.length === 1 ? "place" : "places"}
            {category !== "All discoveries" ? ` · ${category}` : ""}
          </p>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Search size={27} />
            <h3>
              {city !== "Melbourne"
                ? `No examples in ${city} yet`
                : "No places match that search"}
            </h3>
            <p>
              {city !== "Melbourne"
                ? "The app supports Australian cities. Live venues will appear after owners join and are verified."
                : "Try a different dish or suburb, or clear the category filter."}
            </p>
            <button className="primary-button" onClick={reset}>
              Explore Melbourne examples <ArrowRight size={16} />
            </button>
          </div>
        ) : view === "map" ? (
          <div className="discovery-map-layout">
            <IllustratedMap
              venues={filtered}
              selected={selectedId}
              onSelect={setSelected}
            />
            <div className="nearby-places">
              <div className="nearby-heading">
                <span>Places to try</span>
                <span>Save for later</span>
              </div>
              {filtered.map((venue, index) => (
                <PlaceRow
                  key={venue.id}
                  venue={venue}
                  index={index}
                  selected={selectedId === venue.id}
                  onSelect={() => setSelected(venue.id)}
                  saved={saved.includes(venue.id)}
                  onSave={() => toggle(venue.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="venue-grid discovery-list">
            {filtered.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                saved={saved.includes(venue.id)}
                onSave={() => toggle(venue.id)}
              />
            ))}
          </div>
        )}
      </section>
      <section className="weekend-section" aria-labelledby="weekend-title">
        <div className="section-heading">
          <div>
            <p className="edition-label">When you have a bit more time</p>
            <h2 id="weekend-title">A plan for your next day off</h2>
          </div>
          <Link href="/quests" className="text-button">
            All food trails <ArrowRight size={17} />
          </Link>
        </div>
        <div className="weekend-grid">
          <Link href="/quests" className="weekend-story">
            <div>
              <span className="story-number">01 / Brunch</span>
              <h3>
                A slower start
                <br />
                in Fitzroy.
              </h3>
              <p>Put a few cafes on your list and make a morning of it.</p>
              <span className="story-link">
                See the brunch trail <ArrowRight size={16} />
              </span>
            </div>
            <Image
              src="/images/brunch.jpg"
              alt="Avocado toast and fresh greens"
              width={500}
              height={450}
              sizes="(max-width:600px) 40vw, 25vw"
            />
          </Link>
          <Link href="/quests" className="weekend-story story-pizza">
            <div>
              <span className="story-number">02 / Carlton</span>
              <h3>
                Pizza is always
                <br />a good plan.
              </h3>
              <p>Explore the Italian food trail, one table at a time.</p>
              <span className="story-link">
                See the Italian trail <ArrowRight size={16} />
              </span>
            </div>
            <Image
              src="/images/pizza.jpg"
              alt="Pizza with tomato and basil"
              width={500}
              height={450}
              sizes="(max-width:600px) 40vw, 25vw"
            />
          </Link>
        </div>
      </section>
    </>
  );
}
