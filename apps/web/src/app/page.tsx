import { Discovery } from "@/components/discovery";
import { Suspense } from "react";
import { PublishedStorefront } from "@/components/published-storefront";
import { GeographicExplore } from "@/components/geographic-explore";
import { getCatalogue } from "@/lib/catalogue-server";
import { getAuthState } from "@/lib/auth/server";
export default async function Page({ searchParams }: { searchParams: Promise<{ map?: string; view?: string }> }) {
  const [catalogue, query, auth] = await Promise.all([getCatalogue(), searchParams, getAuthState()]);
  if (query.view === "catalogue") return <Discovery catalogue={catalogue} />;
  return <><GeographicExplore key={auth.user?.id ?? "visitor"} accountKey={auth.user?.id} signedIn={!!auth.user}
    explorationAvailable={process.env.FOOD_GO_EXPLORATION_ENABLED === "true"} encountersAvailable={process.env.FOOD_GO_ENCOUNTERS_ENABLED === "true"}
    basePath="/" venues={catalogue.venues} catalogueUnavailable={catalogue.status === "unavailable"} /><Suspense fallback={null}><PublishedStorefront /></Suspense></>;
}
