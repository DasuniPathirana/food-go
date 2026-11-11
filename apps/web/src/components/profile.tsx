"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Compass,
  Flag,
  Leaf,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { venues } from "@/lib/fixtures";
import { useSavedVenues } from "@/lib/preferences";
import { SignOutButton } from "./auth-form";

const achievements = [
  {
    title: "The first good bite",
    description: "For your first verified dish discovery.",
    icon: Leaf,
  },
  {
    title: "Neighbourhood curious",
    description: "For verified visits to a few local places.",
    icon: MapPin,
  },
  {
    title: "A trail of your own",
    description: "For completing your first verified quest.",
    icon: Flag,
  },
];

export function ExplorerProfile({
  account,
}: {
  account?: { displayName: string; email: string | null } | null;
}) {
  const { saved, toggle } = useSavedVenues();
  const [message, setMessage] = useState("");
  const savedCount = venues.filter((venue) => saved.includes(venue.id)).length;

  function clearSavedExamples() {
    saved.forEach((id) => toggle(id));
    setMessage(
      "Your saved example places have been cleared from this browser.",
    );
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">Your Food Go account</div>
          <h1>Your food passport</h1>
          <p>Your saved places, verified visits and completed food trails.</p>
        </div>
        <Link className="secondary-button" href="/">
          <Compass size={17} />
          Find a place
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="profile-grid">
        <section className="profile-card" aria-labelledby="guest-profile-title">
          <span className="avatar">
            <UserRound size={28} />
          </span>
          <div className="eyebrow">
            {account ? "Signed in" : "Browsing without an account"}
          </div>
          <h2 id="guest-profile-title">
            {account?.displayName || "Guest explorer"}
          </h2>
          <p>
            {account
              ? "Your identity is confirmed by the account service. Example bookmarks are still stored on this browser while collection sync is being built."
              : "You can explore and save examples on this browser. Connect the account service to enable sign-in."}
          </p>
          <Link className="text-button" href="/help">
            How this preview works
            <ArrowRight size={16} />
          </Link>
          {account ? (
            <SignOutButton />
          ) : (
            <Link href="/auth/sign-in" className="primary-button">
              Sign in <ArrowRight size={16} />
            </Link>
          )}
        </section>
        <section
          className="content-panel"
          aria-labelledby="passport-summary-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">Collection summary</div>
              <h2 id="passport-summary-title">Your activity</h2>
            </div>
            <BookOpen size={24} />
          </div>
          <div className="stat-grid" aria-label="Guest explorer summary">
            <div className="stat-card">
              <Bookmark size={19} />
              <strong>{savedCount}</strong>
              <span>Saved examples</span>
            </div>
            <div className="stat-card">
              <MapPin size={19} />
              <strong>0</strong>
              <span>Verified visits</span>
            </div>
            <div className="stat-card">
              <Flag size={19} />
              <strong>0</strong>
              <span>Completed quests</span>
            </div>
          </div>
          <p>
            Saving a place helps you plan. It does not create a verified visit,
            an explorer level, or a public profile.
          </p>
        </section>
      </div>
      <section aria-labelledby="achievements-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Achievements</div>
            <h2 id="achievements-title">Badges to work towards</h2>
          </div>
        </div>
        <div className="badge-grid">
          {achievements.map(({ title, description, icon: Icon }) => (
            <article className="badge-tile is-locked" key={title}>
              <span className="leaf-disc">
                <Icon size={25} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span>
                <LockKeyhole size={13} />
                Not earned
              </span>
            </article>
          ))}
        </div>
        <p className="inline-notice">
          <ShieldCheck size={19} />
          These are example achievement designs. No badges or levels have been
          awarded.
        </p>
      </section>
      <section
        className="content-panel"
        aria-labelledby="browser-preferences-title"
      >
        <div className="section-heading">
          <div>
            <div className="eyebrow">Browser preferences</div>
            <h2 id="browser-preferences-title">Manage saved examples</h2>
          </div>
          <button
            className="secondary-button"
            onClick={clearSavedExamples}
            disabled={saved.length === 0}
          >
            <Trash2 size={16} />
            Clear saved examples
          </button>
        </div>
        <p>
          Only your example bookmarks are managed here. This does not delete an
          account. Account deletion will be available when real accounts are
          connected.
        </p>
        {message && (
          <p className="inline-notice" role="status">
            {message}
          </p>
        )}
        <Link className="text-button" href="/help">
          Read about privacy in this preview
          <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
