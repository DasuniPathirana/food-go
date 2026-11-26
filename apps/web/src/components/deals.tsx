"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import { DealCategories } from "./deal-categories";
import styles from "./deals.module.css";

export { PromotionList } from "./promotion-list";

export function ConnectedDeals({ result }: { result: PromotionResult }) {
  return (
    <div className={styles.page}>
      <header className={styles.dealsHero}>
        <div className={styles.dealsHeroCopy}>
          <span className={styles.dealEyebrow}>GOOD FOOD. LOCAL REWARDS.</span>
          <h1>Deals</h1>
          <p>
            Discover Admin-approved offers, special savings, and local venue rewards across the Melbourne Pilot zone.
          </p>
        </div>
        <div className={styles.heroCouponArt} aria-hidden="true">
          %
        </div>
      </header>

      <DealCategories result={result} />

      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#4b6875" }}>
          Are you a restaurant owner in Melbourne? Submit offers from your Owner Portal for Admin approval.
        </p>
        <Link href="/partner/dashboard" className="secondary-button">
          Manage Partner Deals <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

// Compatibility aliases until demo cleanup removes legacy references
export function DemoDeals() {
  return null;
}

export function DemoPromoStrip() {
  return null;
}
