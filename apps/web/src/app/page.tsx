import { Discovery } from "@/components/discovery";
import { Suspense } from "react";
import { PublishedStorefront } from "@/components/published-storefront";
import { GeographicExplore } from "@/components/geographic-explore";
import { ExploreScreen } from "@/components/explore/explore-screen";
import { getCatalogue, getPilotCatalogue } from "@/lib/catalogue-server";
import { getAuthState } from "@/lib/auth/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ map?: string; view?: string }> }) {
  const query = await searchParams;
  const [catalogue, auth] = await Promise.all([query.view === "catalogue" ? getCatalogue() : getPilotCatalogue(), getAuthState()]);
  if (query.view === "catalogue") {
    return (
      <>
        <Discovery catalogue={catalogue} />
        <Suspense fallback={null}>
          <PublishedStorefront />
        </Suspense>
      </>
    );
  }
  const explorationAvailable = process.env.FOOD_GO_EXPLORATION_ENABLED === "true";
  const encountersAvailable = process.env.FOOD_GO_ENCOUNTERS_ENABLED === "true";

  // The primary game world is the surveyed Melbourne geographic explorer,
  // featuring real road/path networks, 3D buildings, vegetation and pilot boundary.
  // The illustrated map preview remains accessible via ?map=illustrated.
  if (query.map === "illustrated" || query.view === "illustrated") {
    return (
      <>
        <ExploreScreen
          key={auth.user?.id ?? "visitor"}
          accountKey={auth.user?.id}
          signedIn={!!auth.user}
          explorationAvailable={explorationAvailable}
          encountersAvailable={encountersAvailable}
          venues={catalogue.venues}
          catalogueUnavailable={catalogue.status === "unavailable"}
        />
        <Suspense fallback={null}>
          <PublishedStorefront />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <GeographicExplore
        key={auth.user?.id ?? "visitor"}
        accountKey={auth.user?.id}
        signedIn={!!auth.user}
        explorationAvailable={explorationAvailable}
        encountersAvailable={encountersAvailable}
        basePath="/"
        catalogueHasMore={catalogue.hasMore}
        venues={catalogue.venues}
        catalogueUnavailable={catalogue.status === "unavailable"}
      />
      <Suspense fallback={null}>
        <PublishedStorefront />
      </Suspense>
    </>
  );
}
