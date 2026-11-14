import type { Metadata } from "next";
import Link from "next/link";
import { getCatalogueMode } from "@/lib/catalogue-server";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  MapPin,
  MessagesSquare,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";

export const metadata: Metadata = { title: "Help & information" };

export default function HelpPage() {
  const demo = getCatalogueMode() === "demo";
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
          {demo ? "The venue catalogue contains fictional examples. The dishes, trails and achievement designs are previews. They are not live offers or completed experiences."
            : "The venue catalogue reads published, ownership-approved listings. Available menu items come from those venues. Trails and achievement designs remain examples, and do not award verified progress."}
        </p>
      </div>
      <div className="help-grid">
        <section className="help-card">
          <BookOpen size={25} />
          <h2>Explore a little</h2>
          <p>
            {demo ? "Try venue search, category filters and the example map. Save a place, browse dish ideas, or add an example trail to your session plan."
              : "Search venue names, suburbs and cuisines, or filter by state and venue type. Save a place or an available menu item. Only approved public listings appear."}
          </p>
          <p>
            Venue bookmarks and dish wishlists are separate and stay on this browser. They do not sync with an account or another device. Example trail plans last for the current quests page session.
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
            {demo ? "The example map does not track your location or confirm a visit. Melbourne is the starting example area."
              : "Explore keeps an interactive illustrated neighbourhood alongside published venue results. The illustration is not geographic data and does not track you. Published venues with a complete address offer links to Google Maps or Apple Maps."}
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
          <MessagesSquare size={25} />
          <h2>Share around the table</h2>
          <p>The Feed has a public wall and personal walls for food stories, thoughts, likes, comments and shares. Public submissions wait for review. Only you can see your private and pending posts on your wall.</p>
          <p>Post options include reporting and blocking. The separate community preview uses fictional people and stories; its changes stay on this browser and can be reset.</p>
          <Link className="text-button" href="/feed">Open the Feed <ArrowRight size={16} /></Link>
        </section>
        <section className="help-card">
          <UserRound size={25} />
          <h2>Accounts and privacy</h2>
          <p>
            Browsing is available without an account. Account access opens when the account service is ready. Public profile controls and account lifecycle safeguards are being completed.
          </p>
          <p>
            Your venue bookmarks can be cleared from the passport.
            A final privacy policy and account controls are required before real
            accounts launch.
          </p>
          <Link className="text-button" href="/profile">
            Manage saved places
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className="help-card">
          <Store size={25} />
          <h2>For restaurant owners</h2>
          <p>
            Use the venue form to prepare the information a listing needs. Creating a draft does not verify ownership or publish a venue.
          </p>
          <p>
            Ownership review and partner operations are being connected. Only a reviewed and approved listing can appear in the public catalogue.
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
