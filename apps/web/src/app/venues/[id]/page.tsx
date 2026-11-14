import { notFound } from "next/navigation";
import { getCatalogueVenue } from "@/lib/catalogue-server";
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
  return <VenueDetail venue={venue} mode={catalogue.mode} />;
}
