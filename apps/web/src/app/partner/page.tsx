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
            Start a venue draft
            <ArrowRight size={17} />
          </Link>
          <Link href="/partner/dashboard" className="text-button">View my venues <ArrowRight size={16} /></Link>
          <span className="partner-preview-caption">
            Your dashboard brings your listing, menu, promotions and customer discoveries together.
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
            Save and edit your business details, manage dishes and submit promotions from your dashboard.
          </p>
        </article>
        <article>
          <span className="benefit-icon">
            <Compass size={23} strokeWidth={1.6} />
          </span>
          <h2>Join food trails</h2>
          <p>
            Give customers a short-lived visit QR and separate dish codes to collect discoveries.
          </p>
        </article>
        <article>
          <span className="benefit-icon">
            <ShieldCheck size={23} strokeWidth={1.6} />
          </span>
          <h2>Verify your business</h2>
          <p>
            Register as a restaurant owner and submit your listing for independent ownership review.
          </p>
        </article>
      </section>
    </div>
  );
}
