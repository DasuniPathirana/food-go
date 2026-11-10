"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Compass,
  MapPin,
  ShieldCheck,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { venues } from "@/lib/fixtures";
import { useSavedVenues } from "@/lib/preferences";
import { VenueCard } from "./venue-card";

export function FoodDex() {
  const { saved, toggle } = useSavedVenues();
  const [view, setView] = useState<"discover" | "saved" | "verified">(
    "discover",
  );
  const savedDishes = venues.filter((venue) => saved.includes(venue.id));
  const visibleDishes = view === "saved" ? savedDishes : venues;

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">A LITTLE TASTE OF EVERYTHING</div>
          <h1>Every flavour has a story.</h1>
          <p>
            Keep a few good ideas for your next meal. Your food story starts
            here.
          </p>
        </div>
        <Link className="secondary-button" href="/">
          <Compass size={17} />
          Find a new flavour
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="stat-grid" aria-label="Your food collection summary">
        <div className="stat-card">
          <BookOpen size={20} />
          <strong>0</strong>
          <span>Verified dishes</span>
        </div>
        <div className="stat-card">
          <Bookmark size={20} />
          <strong>{savedDishes.length}</strong>
          <span>Saved dish ideas</span>
        </div>
        <div className="stat-card">
          <UtensilsCrossed size={20} />
          <strong>0</strong>
          <span>Cuisines experienced</span>
        </div>
      </div>
      <div className="inline-notice">
        <ShieldCheck size={19} />
        <p>
          Your saved places also keep their example signature dishes here.
          Saving is for planning. A verified food discovery will need separate
          confirmation that you experienced the dish.
        </p>
      </div>
      <section aria-labelledby="food-collection-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FOLLOW YOUR CURIOSITY</div>
            <h2 id="food-collection-title">Your next good bite</h2>
          </div>
          <div className="view-toggle" aria-label="Food collection view">
            <button
              onClick={() => setView("discover")}
              className={view === "discover" ? "selected" : ""}
              aria-pressed={view === "discover"}
            >
              Discover
            </button>
            <button
              onClick={() => setView("saved")}
              className={view === "saved" ? "selected" : ""}
              aria-pressed={view === "saved"}
            >
              Saved ({savedDishes.length})
            </button>
            <button
              onClick={() => setView("verified")}
              className={view === "verified" ? "selected" : ""}
              aria-pressed={view === "verified"}
            >
              Verified
            </button>
          </div>
        </div>
        {view === "verified" ? (
          <div className="empty-state">
            <CheckCircle2 size={34} />
            <h3>Good things are still ahead.</h3>
            <p>
              Your verified dishes will live here when food verification is
              available. For now, discover a few examples and make a little
              list.
            </p>
            <button
              className="primary-button"
              onClick={() => setView("discover")}
            >
              Discover dish ideas
              <ArrowRight size={17} />
            </button>
          </div>
        ) : visibleDishes.length === 0 ? (
          <div className="empty-state">
            <Bookmark size={34} />
            <h3>A little room for your next favourite.</h3>
            <p>
              Save an example dish to keep it in your planning list on this
              browser.
            </p>
            <button
              className="primary-button"
              onClick={() => setView("discover")}
            >
              Find a dish idea
              <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <div className="venue-grid">
            {visibleDishes.map((venue) => (
              <article className="venue-card collection-card" key={venue.id}>
                <div className="venue-image">
                  <Link
                    href={`/venues/${venue.id}`}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Image
                      src={venue.image}
                      alt={venue.imageAlt}
                      width={600}
                      height={380}
                      sizes="(max-width: 640px) 100vw, (max-width: 1100px) 45vw, 30vw"
                    />
                  </Link>
                  <span className="photo-label">Dish idea</span>
                  <button
                    className={`save-button ${saved.includes(venue.id) ? "is-saved" : ""}`}
                    aria-label={`${saved.includes(venue.id) ? "Unsave" : "Save"} ${venue.dish}`}
                    aria-pressed={saved.includes(venue.id)}
                    onClick={() => toggle(venue.id)}
                  >
                    <Bookmark
                      size={18}
                      fill={saved.includes(venue.id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <div className="venue-body">
                  <div className="venue-type">{venue.cuisine}</div>
                  <h3>
                    <Link href={`/venues/${venue.id}`}>
                      {venue.dish}
                      <ArrowUpRight size={18} />
                    </Link>
                  </h3>
                  <p className="venue-location">
                    <MapPin size={13} />
                    {venue.name}, {venue.suburb}
                  </p>
                  <div className="venue-dish">
                    <span>
                      <BookOpen size={14} />
                      An example for your wishlist
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function VenueDex() {
  const { saved, toggle } = useSavedVenues();
  const [view, setView] = useState<"saved" | "visited">("saved");
  const savedVenues = venues.filter((venue) => saved.includes(venue.id));

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">GOOD PLACES, WORTH REMEMBERING</div>
          <h1>A few places for your story.</h1>
          <p>
            Keep your next stops close. Build a collection of the places you
            experience.
          </p>
        </div>
        <Link className="secondary-button" href="/">
          <Compass size={17} />
          Explore places
          <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="stat-grid" aria-label="Your venue collection summary">
        <div className="stat-card">
          <Bookmark size={20} />
          <strong>{savedVenues.length}</strong>
          <span>Saved places</span>
        </div>
        <div className="stat-card">
          <Store size={20} />
          <strong>0</strong>
          <span>Verified visits</span>
        </div>
        <div className="stat-card">
          <MapPin size={20} />
          <strong>0</strong>
          <span>Neighbourhoods visited</span>
        </div>
      </div>
      <div className="inline-notice">
        <ShieldCheck size={19} />
        <p>
          A saved place is a plan, not a visit. Venue check-ins and dish
          discoveries will be verified separately. Your saved examples are kept
          on this browser.
        </p>
      </div>
      <section aria-labelledby="venue-collection-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A LITTLE LIST TO LOOK FORWARD TO</div>
            <h2 id="venue-collection-title">Your places</h2>
          </div>
          <div className="view-toggle" aria-label="Venue collection view">
            <button
              onClick={() => setView("saved")}
              className={view === "saved" ? "selected" : ""}
              aria-pressed={view === "saved"}
            >
              Saved ({savedVenues.length})
            </button>
            <button
              onClick={() => setView("visited")}
              className={view === "visited" ? "selected" : ""}
              aria-pressed={view === "visited"}
            >
              Visited
            </button>
          </div>
        </div>
        {view === "visited" ? (
          <div className="empty-state">
            <Store size={34} />
            <h3>Your first stop is still to come.</h3>
            <p>
              Verified visits will appear here when secure check-ins are
              connected. Saving or viewing an example venue does not record a
              visit.
            </p>
            <Link className="primary-button" href="/">
              Find a place to explore
              <ArrowRight size={17} />
            </Link>
          </div>
        ) : savedVenues.length > 0 ? (
          <div className="venue-grid">
            {savedVenues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                saved
                onSave={() => toggle(venue.id)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Bookmark size={34} />
            <h3>Leave a little room for discovery.</h3>
            <p>
              Tap the bookmark on a place that catches your eye. We will keep
              the example in your planning list on this browser.
            </p>
            <Link className="primary-button" href="/">
              Find your first favourite
              <ArrowRight size={17} />
            </Link>
          </div>
        )}
      </section>
      {view === "saved" && savedVenues.length === 0 && (
        <section aria-labelledby="venue-suggestions-title">
          <div className="section-heading">
            <div>
              <div className="eyebrow">SOMETHING TO GET YOU STARTED</div>
              <h2 id="venue-suggestions-title">A few example places</h2>
            </div>
          </div>
          <div className="venue-grid">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                saved={saved.includes(venue.id)}
                onSave={() => toggle(venue.id)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
