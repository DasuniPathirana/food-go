import { notFound } from "next/navigation";
import { venues } from "@/lib/fixtures";
import { VenueDetail } from "@/components/venue-detail";
export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = venues.find((item) => item.id === id);
  if (!venue) notFound();
  return <VenueDetail venue={venue} />;
}
