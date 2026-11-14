import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/venue-detail";
import { loadCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Example venue preview" };

export default async function ExampleVenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catalogue = await loadCatalogue({ mode: "demo" }, { query: "", limit: 1 }, { venueKey: id });
  const venue = catalogue.venues[0];
  if (!venue) notFound();
  return <VenueDetail venue={venue} mode="demo" />;
}
