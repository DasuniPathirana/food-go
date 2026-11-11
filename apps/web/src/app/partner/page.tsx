import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Compass,
  Leaf,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = { title: "For restaurant partners" };

export default function PartnerPage() {
  return (
    <div className="partner-page">
      <section className="partner-hero">
        <div className="partner-hero-copy">
          <span className="eyebrow">For restaurant and cafe owners</span>
          <h1>
            Put your place
            <br />
            on the map.
          </h1>
          <p>
            Bring your food, your story and your little corner of Australia to
            curious explorers. Start with a simple venue draft.
          </p>
          <Link href="/partner/onboarding" className="primary-button">
            Try the venue form
            <ArrowRight size={17} />
          </Link>
          <span className="partner-preview-caption">
            An early look at self-service onboarding. Nothing is published.
          </span>
        </div>
        <div className="partner-hero-art" aria-hidden="true">
          <div className="partner-orbit orbit-one" />
          <div className="partner-orbit orbit-two" />
          <span className="partner-art-leaf">
            <Leaf size={70} strokeWidth={1} />
          </span>
          <div className="partner-example-card">
            <span className="eyebrow">Venue profile preview</span>
            <h2>
              Your venue,
              <br />
              ready to explore.
            </h2>
            <span>
              <Compass size={16} />
              Made for local discovery
            </span>
          </div>
        </div>
      </section>
      <section
        className="partner-benefits"
        aria-label="A simpler start for venue owners"
      >
        <article>
          <span className="benefit-icon">
            <ClipboardList size={23} strokeWidth={1.6} />
          </span>
          <h2>Manage your own listing</h2>
          <p>
            Bring your venue details together in one clear draft, ready for a
            future shared marketplace.
          </p>
        </article>
        <article>
          <span className="benefit-icon">
            <Compass size={23} strokeWidth={1.6} />
          </span>
          <h2>Join food trails</h2>
          <p>
            Explore how your venue could join neighbourhood food discoveries and
            future adventures.
          </p>
        </article>
        <article>
          <span className="benefit-icon">
            <ShieldCheck size={23} strokeWidth={1.6} />
          </span>
          <h2>Verify your business</h2>
          <p>
            Try the experience with fictional details. Account creation and
            ownership verification are still to come.
          </p>
        </article>
      </section>
    </div>
  );
}
