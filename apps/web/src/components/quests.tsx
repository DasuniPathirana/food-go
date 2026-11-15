"use client";
import Link from "next/link";
import { useJourney } from "./journey-provider";
import { venueHref, type CatalogueState } from "@/lib/catalogue-contracts";

export function QuestCollection({ catalogue }: { catalogue: CatalogueState }) {
  const journey = useJourney();
  const count = journey?.data?.visits.length ?? 0;
  return <><header className="page-intro"><div><h1>Food trails</h1><p>Make your next three stops a discovery.</p></div></header>
    <section className="content-panel"><h2>Three places discovered</h2><p>Collect a venue-issued visit code at three different places to earn 100 bonus XP.</p>
      <progress aria-label="Three-place challenge" value={Math.min(count, 3)} max={3}/>
      <p>{Math.min(count, 3)} of 3 places collected · {count >= 3 ? "Bonus earned" : "Challenge in progress"}</p>
      <Link className="primary-button" href="/collect">Collect a visit</Link>
    </section><section><h2>Choose your next stop</h2>
      {catalogue.status === "unavailable" ? <p>Places are temporarily unavailable. Please try again shortly.</p> :
        catalogue.venues.length ? <div className="venue-grid">{catalogue.venues.map(venue => <article key={venue.id} className="content-panel">
          <h3><Link href={venueHref(venue)}>{venue.name}</Link></h3><p>{venue.cuisine} · {venue.suburb}</p>
          <p>{journey?.data?.visits.some(v => v.id === venue.id) ? "Visit collected" : "Ready to discover"}</p>
          <Link href={venueHref(venue)}>View place and directions</Link>
        </article>)}</div> : <p>Published places will appear here as restaurant owners join.</p>}
    </section></>;
}
