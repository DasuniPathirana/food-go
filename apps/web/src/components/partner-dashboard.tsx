"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, RefreshCw, Store } from "lucide-react";
import { partnerVenueSchema, type PartnerVenue } from "@/lib/partner/contracts";

const statusCopy: Record<PartnerVenue["status"], string> = {
  draft: "Private draft",
  pending: "Awaiting review",
  published: "Published",
  suspended: "Publication paused",
};

export function PartnerDashboard() {
  const [venues, setVenues] = useState<PartnerVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    let sessionExpired = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    setLoading(true);
    setError("");
    async function load() {
      try {
        const response = await fetch("/api/partner/venues", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        sessionExpired = response.status === 401;
        if (!response.ok) throw new Error("Venue request failed");
        const body: unknown = await response.json();
        const rows = typeof body === "object" && body !== null && "data" in body ? partnerVenueSchema.array().max(200).safeParse(body.data) : null;
        if (!rows?.success) throw new Error("Your venues could not be loaded. Please try again.");
        if (active) setVenues(rows.data);
      } catch {
        if (active) setError(sessionExpired
          ? "Your session has expired. Sign in again to see your venues."
          : timedOut
            ? "Loading took too long. Check your connection and try again."
            : "Your venues could not be loaded. Please try again.");
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [version]);

  return <>
    <div className="page-intro"><div><h1>Your venues</h1><p>Keep track of your private drafts and listing status.</p></div><Link href="/partner/onboarding" className="primary-button"><Plus size={17} />Add a venue</Link></div>
    <section className="content-panel" aria-label="Your venue listings" aria-busy={loading}>
      {loading ? <p role="status">Loading your venues...</p> : error ? <div className="empty-state"><h2>We could not load your venues</h2><p role="alert">{error}</p><div className="form-actions"><button className="primary-button" onClick={() => setVersion(value => value + 1)}><RefreshCw size={16} />Try again</button><Link href="/auth/sign-in" className="secondary-button">Sign in</Link></div></div> : venues.length ? <div className="partner-list">
        {venues.map(venue => <article key={venue.id} className="partner-list-row"><div><h2>{venue.name}</h2><p>{venue.suburb}, {venue.state}</p><p className="field-hint">Saved {new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Australia/Sydney" }).format(new Date(venue.updatedAt))}</p></div><div><strong>{statusCopy[venue.status]}</strong><p>{venue.ownershipVerified ? "Ownership verified" : "Ownership review required"}</p></div></article>)}
      </div> : <div className="empty-state"><Store size={32} /><h2>Your first venue starts here</h2><p>Save your business details privately. A draft is visible only to your organisation until ownership and publication are approved.</p><Link href="/partner/onboarding" className="primary-button">Create a private draft<ArrowRight size={17} /></Link></div>}
    </section>
    <div className="inline-notice"><p>Draft creation and account access are connected. Editing saved details, submitting ownership evidence and operator approval are the next workflows. Saving a draft does not publish a venue or send a message.</p></div>
  </>;
}
