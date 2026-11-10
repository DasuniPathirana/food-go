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
          <span className="eyebrow">
            FOR THE PLACES THAT MAKE A NEIGHBOURHOOD
          </span>
          <h1>
            A good place
            <br />
            deserves to be found.
          </h1>
          <p>
            Bring your food, your story and your little corner of Australia to
            curious explorers. Start with a simple venue draft.
          </p>
          <Link href="/partner/onboarding" className="primary-button">
            Build your venue draft
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
            <span className="eyebrow">YOUR PLACE. YOUR STORY.</span>
            <h2>
              Something good
              <br />
              is growing here.
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
          <h2>One place for your story</h2>
          <p>
            Bring your venue details together in one clear draft, ready for a
            future shared marketplace.
          </p>
        </article>
        <article>
          <span className="benefit-icon">
            <Compass size={23} strokeWidth={1.6} />
          </span>
          <h2>Choose how you take part</h2>
          <p>
            Explore how your venue could join neighbourhood food discoveries and
            future adventures.
          </p>
        </article>
        <article>
          <span className="benefit-icon">
            <ShieldCheck size={23} strokeWidth={1.6} />
          </span>
          <h2>A thoughtful first step</h2>
          <p>
            Try the experience with fictional details. Account creation and
            ownership verification are still to come.
          </p>
        </article>
      </section>
    </div>
  );
}
