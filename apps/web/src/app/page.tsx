import { Discovery } from "@/components/discovery";
import { Suspense } from "react";
import { PublishedStorefront } from "@/components/published-storefront";
import { GeographicExplore } from "@/components/geographic-explore";
import { getCatalogue } from "@/lib/catalogue-server";
export default async function Page({ searchParams }: { searchParams: Promise<{ map?: string; view?: string }> }) {
  const [catalogue, query] = await Promise.all([getCatalogue(), searchParams]);
  if (query.view === "catalogue") return <Discovery catalogue={catalogue} />;
  return <><GeographicExplore basePath="/" venues={catalogue.venues} catalogueUnavailable={catalogue.status === "unavailable"} /><Suspense fallback={null}><PublishedStorefront /></Suspense></>;
}
