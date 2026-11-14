import { Discovery } from "@/components/discovery";
import { GeographicExplore } from "@/components/geographic-explore";
import { MapModeNav } from "@/components/map-mode-nav";
import styles from "@/components/geographic-explore.module.css";
import { getCatalogue } from "@/lib/catalogue-server";
import { loadCatalogue } from "@/lib/catalogue";
export default async function Page({ searchParams }: { searchParams: Promise<{ map?: string; view?: string }> }) {
  const [catalogue, query] = await Promise.all([getCatalogue(), searchParams]);
  if (query.view === "catalogue") return <Discovery catalogue={catalogue} />;
  if (query.map === "adventure") return <>
    <div className={styles.adventureBar}><MapModeNav geographic={false} basePath="/" /></div>
    <Discovery catalogue={catalogue.mode === "demo" ? catalogue : await loadCatalogue({mode: "demo"})} />
  </>;
  return <GeographicExplore basePath="/" venues={catalogue.venues} catalogueUnavailable={catalogue.status === "unavailable"} />;
}
