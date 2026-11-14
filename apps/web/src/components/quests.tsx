"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookmarkCheck,
  Clock3,
  Flag,
  MapPin,
  Route,
  ShieldCheck,
} from "lucide-react";
import { quests } from "@/lib/fixtures";

export function QuestCollection() {
  const [planned, setPlanned] = useState<string[]>([]);
  const [view, setView] = useState<"all" | "planned">("all");
  const visibleQuests =
    view === "planned"
      ? quests.filter((quest) => planned.includes(quest.id))
      : quests;

  function togglePlan(id: string) {
    setPlanned((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">Food trails</div>
          <h1>A reason to try somewhere new</h1>
          <p>Pick a route, save the stops and plan a day around the food.</p>
        </div>
        <Link className="secondary-button" href="/">
          <MapPin size={17} />
          Browse places
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="stat-grid" aria-label="Your adventure summary">
        <div className="stat-card">
          <Route size={20} />
          <strong>{quests.length}</strong>
          <span>Example trails</span>
        </div>
        <div className="stat-card">
          <BookmarkCheck size={20} />
          <strong>{planned.length}</strong>
          <span>In your session plan</span>
        </div>
        <div className="stat-card">
          <Flag size={20} />
          <strong>0</strong>
          <span>Verified completions</span>
        </div>
      </div>
      <div className="inline-notice">
        <ShieldCheck size={19} />
        <p>
          Try planning an example trail. Plans last for this page session and do
          not record visits, complete quests, or award points. Verified progress
          will be added with secure check-ins.
        </p>
      </div>
      <section aria-labelledby="quests-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Choose a route</div>
            <h2 id="quests-title">Food trails to try</h2>
          </div>
          <div className="view-toggle" aria-label="Adventure view">
            <button
              onClick={() => setView("all")}
              className={view === "all" ? "selected" : ""}
              aria-pressed={view === "all"}
            >
              All trails
            </button>
            <button
              onClick={() => setView("planned")}
              className={view === "planned" ? "selected" : ""}
              aria-pressed={view === "planned"}
            >
              My plan ({planned.length})
            </button>
          </div>
        </div>
        {visibleQuests.length === 0 ? (
          <div className="empty-state">
            <Route size={34} />
            <h3>Choose your first trail</h3>
            <p>
              Choose an example trail and add it to this session's plan. You can
              remove it whenever you like.
            </p>
            <button className="primary-button" onClick={() => setView("all")}>
              Browse example trails
              <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <div className="venue-grid">
            {visibleQuests.map((quest) => {
              const isPlanned = planned.includes(quest.id);
              return (
                <article className="quest-card" key={quest.id}>
                  <div className="quest-image">
                    <Image
                      src={quest.image}
                      alt={
                        quest.id === "morning-person"
                          ? "Fresh brunch with avocado toast and greens"
                          : quest.id === "little-italy"
                            ? "Pizza topped with basil and tomatoes"
                            : "Coffee with a freshly baked croissant"
                      }
                      width={600}
                      height={380}
                      sizes="(max-width: 640px) 100vw, (max-width: 1100px) 45vw, 30vw"
                    />
                    <span className="photo-label">Example trail</span>
                  </div>
                  <div className="quest-body">
                    <div className="eyebrow">{quest.category}</div>
                    <h3>{quest.title}</h3>
                    <p>{quest.description}</p>
                    <div className="quest-meta">
                      <span>
                        <MapPin size={15} />
                        {quest.venues} planned stops
                      </span>
                      <span>
                        <Clock3 size={15} />
                        {quest.difficulty}
                      </span>
                    </div>
                    <div className="quest-progress">
                      <span>0 of {quest.venues} visits verified</span>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${quest.title} verified visits`}
                        aria-valuenow={0}
                        aria-valuemin={0}
                        aria-valuemax={quest.venues}
                      />
                    </div>
                    <button
                      className={
                        isPlanned ? "secondary-button" : "primary-button"
                      }
                      onClick={() => togglePlan(quest.id)}
                      aria-pressed={isPlanned}
                      aria-label={`${isPlanned ? "Remove" : "Add"} ${quest.title} ${isPlanned ? "from" : "to"} your plan`}
                    >
                      {isPlanned ? (
                        <BookmarkCheck size={17} />
                      ) : (
                        <Route size={17} />
                      )}
                      {isPlanned ? "Remove from my plan" : "Add to my plan"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="inline-notice" role="status">
          {planned.length === 0
            ? "No example trails planned yet."
            : `${planned.length} example ${planned.length === 1 ? "trail is" : "trails are"} in your plan for this session.`}
        </p>
      </section>
    </>
  );
}
