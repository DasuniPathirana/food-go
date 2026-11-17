import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import styles from "./deals.module.css";

const expiry = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Melbourne" });

export function PromotionList({ result, limit }: { result: PromotionResult; limit?: number }) {
  if (result.status === "unavailable") return <div role="status" className={styles.offerEmpty} data-compact={limit !== undefined}><div><h3>Offers are taking a moment.</h3><p>Please try again shortly. You can keep exploring the map.</p>{limit === undefined && <Link href="/">Browse the map <ArrowRight size={15}/></Link>}</div></div>;
  if (!result.promotions.length) return <div className={styles.offerEmpty} data-compact={limit !== undefined}><div><h3>A little room for a good deal.</h3><p>No active offers match this view. Approved restaurant offers will appear here.</p>{limit === undefined && <Link href="/">Find your next place <ArrowRight size={15}/></Link>}</div></div>;
  return <div className={styles.promotionGrid}>{result.promotions.slice(0, limit).map(promo =>
    <article className={styles.promotion} key={promo.id} data-kind={promo.kind}>
      <div className={styles.promotionBody}><span className={styles.offerKind}>{promo.kind === "food" ? "Food Deal" : "Restaurant Deal"}</span><h3>{promo.title}</h3><p>{promo.description}</p>
        <Link href={`/venues/${encodeURIComponent(promo.venueSlug)}`}>{promo.venueName}<ArrowRight size={14} /></Link>
        <small className={styles.offerExpiry}><Clock size={13}/><span>{promo.suburb} · Ends <time dateTime={promo.endsAt}>{expiry.format(new Date(promo.endsAt))}</time> Melbourne time</span></small>
      </div>
    </article>)}</div>;
}
