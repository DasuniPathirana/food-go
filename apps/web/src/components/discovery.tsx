"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  MapPin,
  Search,
  Map,
  LayoutGrid,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { cities } from "@/lib/fixtures";
import { filterCatalogue, type CatalogueState } from "@/lib/catalogue-contracts";
import { useSavedVenues } from "@/lib/preferences";
import { AdventureMap, AdventureVenueSheet } from "./adventure-map";
import mapStyles from "./adventure-map.module.css";
import { VenueCard } from "./venue-card";
import { CatalogueStatus } from "./catalogue-status";
import { ConnectedDiscovery } from "./connected-discovery";

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

export function Discovery({ catalogue }: { catalogue: CatalogueState }) {
  if (catalogue.mode === "supabase") return <ConnectedDiscovery catalogue={catalogue} />;
  return <DemoDiscovery catalogue={catalogue} />;
}

function DemoDiscovery({ catalogue }: { catalogue: CatalogueState }) {
  const venues = catalogue.venues;
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Melbourne");
  const [category, setCategory] = useState("All discoveries");
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { saved, toggle } = useSavedVenues();
  const filtered = city === "Melbourne" ? filterCatalogue(venues, query, category) : [];
  const selectedId = filtered.some((venue) => venue.id === selected)
    ? selected
    : undefined;
  function reset() {
    setCity("Melbourne");
    setQuery("");
    setCategory("All discoveries");
    setSelected(undefined);
  }
  const overlay = <>
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
            contains fictional venues and a multi-shop arcade in Melbourne.
          </p>
          <button className="text-button" onClick={reset}>
            Reset filters <X size={15} />
          </button>
        </div>
      </section>
    </>;
  const empty = <div className={mapStyles.sheetEmpty}><h2>{city !== "Melbourne" ? `No examples in ${city} yet` : "No places match that search"}</h2><p>Try another dish or suburb, or explore the Melbourne examples.</p><button className="text-button" onClick={reset}>Reset filters <ArrowRight size={15} /></button></div>;
  return <>
    {view === "map" ? <AdventureMap demoVenues={filtered} selected={selectedId} onSelect={setSelected} overlay={overlay} resultsLabel={`Places to explore (${filtered.length})`}
      sheet={filtered.length ? <AdventureVenueSheet venues={filtered} saved={saved} onSave={toggle} title="Worth a little detour." example /> : empty} /> : <>
      {overlay}
      <section className="discovery-results" aria-label="Places to explore">
        <div className="results-heading"><h2>{city}<span>{cityRegions[city]}, Australia</span></h2><p role="status">{filtered.length} example {filtered.length === 1 ? "place" : "places"}</p></div>
        {filtered.length ? <div className="venue-grid discovery-list">{filtered.map((venue) => <VenueCard key={venue.id} venue={venue} saved={saved.includes(venue.id)} onSave={() => toggle(venue.id)} />)}</div> : empty}
      </section>
    </>}
    <CatalogueStatus catalogue={catalogue} />
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
  </>;
}
