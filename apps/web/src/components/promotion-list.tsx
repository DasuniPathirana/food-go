"use client";

import Link from "next/link";
import { ArrowRight, Store, Clock } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import styles from "./deals.module.css";

export function PromotionList({ result, limit }: { result: PromotionResult; limit?: number }) {
  if (result.status === "unavailable") return <p role="status" className={styles.note}>Offers are temporarily unavailable. Please try again later.</p>;
  const deals = result.promotions.slice(0, limit);
  if (!deals.length) return <section className={styles.offerEmpty}><h2>No matching offers yet</h2><p>Approved restaurant offers will appear here. Try another category or explore nearby venues.</p><Link href="/">Explore Melbourne <ArrowRight size={16}/></Link></section>;
  return <div className={styles.dealsContainer}><div className={styles.dealCardsList}>
    {deals.map(deal => <article className={styles.premiumDealCard} key={deal.id}>
      <div className={styles.dealVenueMini} aria-hidden="true"><div className={styles.miniPinBadge}><Store size={14}/></div>
        <div className={styles.miniBuildingGraphic}><div className={styles.miniBuildingRoof}/><div className={styles.miniBuildingFacade}><div className={styles.miniAwning}/><div className={styles.miniDoor}/></div></div>
      </div>
      <div className={styles.dealInfoCol}>
        <h3 className={styles.dealVenueTitle}>{deal.venueName}</h3>
        <p className={styles.dealRatingRow}>{deal.suburb}</p>
        <div className={styles.dealOfferHighlight}><strong className={styles.dealDiscountText}>{deal.title}</strong><span className={styles.dealOfferDetail}>{deal.description}</span></div>
        <small><Clock size={12} aria-hidden="true"/> Until {new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Australia/Melbourne" }).format(new Date(deal.endsAt))}</small>
      </div>
      <div className={styles.dealActionCol}><Link className={styles.redeemButton} href={`/venues/${encodeURIComponent(deal.venueSlug)}`}>View offer <ArrowRight size={13}/></Link></div>
    </article>)}
  </div></div>;
}
