import { Discovery } from "@/components/discovery";
import { Suspense } from "react";
import { PublishedStorefront } from "@/components/published-storefront";
import { GeographicExplore } from "@/components/geographic-explore";
import { ExploreScreen } from "@/components/explore/explore-screen";
import { getCatalogue } from "@/lib/catalogue-server";
import { getAuthState } from "@/lib/auth/server";
export default async function Page({ searchParams }: { searchParams: Promise<{ map?: string; view?: string }> }) {
  const [catalogue, query, auth] = await Promise.all([getCatalogue(), searchParams, getAuthState()]);
  if (query.view === "catalogue") return <Discovery catalogue={catalogue} />;
  const explorationAvailable = process.env.FOOD_GO_EXPLORATION_ENABLED === "true";
  const encountersAvailable = process.env.FOOD_GO_ENCOUNTERS_ENABLED === "true";
  // The illustrated city is the default Explore surface. The surveyed geographic
  // map stays one link away for real street and satellite context.
  return <>{query.map === "geographic"
    ? <GeographicExplore key={auth.user?.id ?? "visitor"} accountKey={auth.user?.id} signedIn={!!auth.user}
      explorationAvailable={explorationAvailable} encountersAvailable={encountersAvailable}
      basePath="/" venues={catalogue.venues} catalogueUnavailable={catalogue.status === "unavailable"} />
    : <ExploreScreen key={auth.user?.id ?? "visitor"} accountKey={auth.user?.id} signedIn={!!auth.user}
      explorationAvailable={explorationAvailable} encountersAvailable={encountersAvailable}
      venues={catalogue.venues} catalogueUnavailable={catalogue.status === "unavailable"} />}
    <Suspense fallback={null}><PublishedStorefront /></Suspense></>;
}
