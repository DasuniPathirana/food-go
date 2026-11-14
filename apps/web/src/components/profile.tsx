"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Compass,
  ChevronDown,
  Flag,
  Leaf,
  LockKeyhole,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import type { CatalogueState } from "@/lib/catalogue-contracts";
import { useSavedVenues } from "@/lib/preferences";
import { SignOutButton } from "./auth-form";
import { CatalogueStatus } from "./catalogue-status";
import { GameProgress } from "./game-progress";
import { AvatarWardrobe } from "./avatar-customizer";
import { CommunityFeed } from "./community-feed";
import passportStyles from "./passport-wall.module.css";

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
  catalogue,
}: {
  account?: { displayName: string; email: string | null; phone?: string | null } | null;
  catalogue: CatalogueState;
}) {
  const { saved, toggle } = useSavedVenues(catalogue.mode);
  const [message, setMessage] = useState("");
  const savedCount = saved.length;

  function clearSavedExamples() {
    saved.forEach((id) => toggle(id));
    setMessage(
      "Your saved places have been cleared from this browser.",
    );
  }

  return (
    <>
      <div className="page-intro">
        <div>
          <h1>Your food passport</h1>
          <p>Your food stories, saved places and exploration.</p>
        </div>
        <Link className="secondary-button" href="/">
          <Compass size={17} />
          Find a place
          <ArrowRight size={16} />
        </Link>
      </div>
      <CatalogueStatus catalogue={catalogue} />
      <div className="profile-grid">
        <section className="profile-card" aria-labelledby="guest-profile-title">
          <span className="avatar">
            <UserRound size={28} />
          </span>
          <p>
            {account ? "Signed in" : "Browsing without an account"}
          </p>
          <h2 id="guest-profile-title">
            {account?.displayName || "Guest explorer"}
          </h2>
          <p>
            {account
              ? "Your verified account is recognised by the account service. Bookmarks stay on this browser while account collection sync is being built."
              : "You can explore and save places on this browser. Account access will open when the account service is ready."}
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
              <h2 id="passport-summary-title">Your activity</h2>
            </div>
            <BookOpen size={24} />
          </div>
          <div className="stat-grid" aria-label="Guest explorer summary">
            <div className="stat-card">
              <Bookmark size={19} />
              <strong>{savedCount}</strong>
              <span>Saved places</span>
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
      {account ? <section className={passportStyles.connectedWall} aria-label="My personal wall"><CommunityFeed initialWall="me" presentation="passport" basePath="/feed" /></section> : <section className={passportStyles.guestWall} aria-labelledby="personal-wall-title"><h2 id="personal-wall-title"><MessagesSquare size={22} />My wall</h2><p>Sign in to keep your food stories and shared discoveries together. Private thoughts stay visible only to you.</p><div><Link href="/auth/sign-in" className="primary-button">Sign in<ArrowRight size={16} /></Link><Link href="/demo/passport" className="secondary-button">Try the example passport<ArrowRight size={16} /></Link></div></section>}
      <details className={passportStyles.details}>
        <summary><BookOpen size={18} /><span>Avatar, progress and browser preferences</span><ChevronDown size={17} /></summary>
        <div className={passportStyles.detailsBody}>
      <AvatarWardrobe />
      {account && <GameProgress />}
      <section aria-labelledby="achievements-title">
        <div className="section-heading">
          <div>
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
            <h2 id="browser-preferences-title">Manage saved places</h2>
          </div>
          <button
            className="secondary-button"
            onClick={clearSavedExamples}
            disabled={saved.length === 0}
          >
            <Trash2 size={16} />
            Clear saved places
          </button>
        </div>
        <p>
          Only your venue bookmarks are managed here. This does not delete an
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
        </div>
      </details>
    </>
  );
}
