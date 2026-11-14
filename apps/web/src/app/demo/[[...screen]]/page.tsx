import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoAdventure } from "@/components/demo-adventure";
import { loadCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Food Go adventure demo", robots: { index: false, follow: false } };
export default async function DemoPage({ params, searchParams }: {
  params: Promise<{ screen?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const segments = (await params).screen || ["explore"];
  const allowed = ["explore", "food-dex", "venue-dex", "deals", "quests", "passport", "rewards", "feed", "venue"];
  if (!allowed.includes(segments[0]) || segments.length > (segments[0] === "venue" ? 2 : 1) || (segments[0] === "venue" && !segments[1])) notFound();
  const catalogue = await loadCatalogue({ mode: "demo" });
  if (segments[0] === "venue" && !catalogue.venues.some((venue) => venue.id === segments[1])) notFound();
  const query = await searchParams;
  return <DemoAdventure screen={segments[0]} venueId={segments[1]} venues={catalogue.venues}
    initialWall={typeof query.wall === "string" ? query.wall : "public"} initialPost={typeof query.post === "string" ? query.post : undefined} />;
}
