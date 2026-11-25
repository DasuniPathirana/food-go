import { notFound } from "next/navigation";
import { getCatalogueVenue, getPromotions } from "@/lib/catalogue-server";
import { CatalogueStatus } from "@/components/catalogue-status";
import { VenueDetail } from "@/components/venue-detail";
export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const catalogue = await getCatalogueVenue(id);
  if (catalogue.status === "unavailable") return <CatalogueStatus catalogue={catalogue} />;
  const venue = catalogue.venues[0];
  if (!venue) notFound();
  const result = await getPromotions();
  const offers = result.promotions.filter(offer => offer.venueId === venue.id);
  return <><VenueDetail venue={venue} mode={catalogue.mode} />
    <section className="content-panel" aria-labelledby="venue-offers">
      <h2 id="venue-offers">Current offers</h2>
      {result.status === "unavailable" ? <p>Offers are temporarily unavailable.</p> : !offers.length ? <p>No active offers from this venue yet.</p> : offers.map(offer =>
        <article className="content-panel" id={`offer-${offer.id}`} key={offer.id}>
          <h3>{offer.title}</h3><p>{offer.description}</p>
          <p>Available until {new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Melbourne" }).format(new Date(offer.endsAt))} Melbourne time.</p>
          <p>Ask the venue about this offer. A listing is not a redeemed voucher.</p>
        </article>)}
      <a className="secondary-button" href="/inventory">View collected offers and redemption codes</a>
    </section></>;
}
