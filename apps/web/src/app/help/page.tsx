import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  MapPin,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";

export const metadata: Metadata = { title: "Help & information" };

export default function HelpPage() {
  return (
    <>
      <div className="page-intro">
        <div>
          <div className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</div>
          <h1>Good to know before you go.</h1>
          <p>
            A few things about this early Food Go preview and what comes next.
          </p>
        </div>
        <Link className="secondary-button" href="/">
          Back to exploring
          <ArrowRight size={17} />
        </Link>
      </div>
      <div className="inline-notice">
        <CircleHelp size={20} />
        <p>
          This is a foundation preview. The venues, dishes, trails and
          achievement designs are examples. They are not live offers, verified
          listings or completed experiences.
        </p>
      </div>
      <div className="help-grid">
        <section className="help-card">
          <BookOpen size={25} />
          <h2>Explore a little</h2>
          <p>
            Try venue search, category filters and the example map. Save a
            place, browse dish ideas, or add a trail to your session plan.
          </p>
          <p>
            Bookmarks stay on this browser. Trail plans last for the current
            quests page session.
          </p>
          <Link className="text-button" href="/food-dex">
            Browse the FoodDex
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className="help-card">
          <MapPin size={25} />
          <h2>Your location stays yours</h2>
          <p>
            The example map does not track your location or confirm a visit.
            Melbourne is the starting example area.
          </p>
          <p>
            Live exploration will request location permission when it is needed
            and provide suburb or postcode search as an alternative.
          </p>
          <Link className="text-button" href="/venue-dex">
            See how places are collected
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className="help-card">
          <ShieldCheck size={25} />
          <h2>A save is not a check-in</h2>
          <p>
            Saved places and dishes are a planning list. Verified visits will
            need secure check-ins. A verified dish will need its own
            confirmation.
          </p>
          <p>
            This preview cannot award points, verify a visit, or create a public
            explorer ranking.
          </p>
          <Link className="text-button" href="/quests">
            Look at example trails
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className="help-card">
          <UserRound size={25} />
          <h2>Accounts and privacy</h2>
          <p>
            You are browsing as a guest. Account registration, sign-in, account
            deletion and public profile controls are still in development.
          </p>
          <p>
            Your saved example bookmarks can be cleared from the guest passport.
            A final privacy policy and account controls are required before real
            accounts launch.
          </p>
          <Link className="text-button" href="/profile">
            Manage saved examples
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className="help-card">
          <Store size={25} />
          <h2>For restaurant owners</h2>
          <p>
            Try the venue onboarding draft to see the information a listing
            needs. Creating a draft does not verify ownership or publish a
            venue.
          </p>
          <p>
            Business verification, staff access and an owner dashboard will be
            connected in a later milestone.
          </p>
          <Link className="text-button" href="/partner">
            Preview venue onboarding
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className="help-card">
          <CircleHelp size={25} />
          <h2>What comes next</h2>
          <p>
            The next stage connects real accounts and verified venue onboarding,
            followed by marketplace tools and secure exploration.
          </p>
          <p>
            Bookings, dining payments, live offers and customer support services
            are not operational in this preview.
          </p>
          <Link className="text-button" href="/">
            Keep exploring the preview
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
