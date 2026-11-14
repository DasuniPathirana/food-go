import Link from "next/link";
import { Footprints, Globe2 } from "lucide-react";
import styles from "./geographic-explore.module.css";

export function MapModeNav({ geographic, basePath }: { geographic: boolean; basePath: string }) {
  return <nav aria-label="Explore maps" className={styles.modeNav}>
    <Link href={`${basePath}?map=real`} aria-current={geographic ? "page" : undefined} scroll={false}><Globe2 size={17} />Real map</Link>
    <Link href={`${basePath}?map=adventure`} aria-current={!geographic ? "page" : undefined} scroll={false}><Footprints size={17} />Adventure</Link>
  </nav>;
}
