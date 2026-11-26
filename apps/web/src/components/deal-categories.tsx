"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Coffee, Gift, Search, Store, Utensils } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import { useJourney } from "./journey-provider";
import { PromotionList } from "./promotion-list";
import styles from "./deals.module.css";

const categories = [
  { id: "food", name: "Food Deals", subtitle: "Meals & combos", icon: Utensils },
  { id: "restaurant", name: "Restaurant Deals", subtitle: "Dine & save", icon: Store },
  { id: "cafe", name: "Cafe Offers", subtitle: "Drinks & treats", icon: Coffee },
] as const;

export function DealCategories({ result }: { result: PromotionResult }) {
  const journey = useJourney();
  const [kind, setKind] = useState<"all" | "food" | "restaurant" | "cafe">("all");
  const [query, setQuery] = useState("");
  const [rewardsProgress, setRewardsProgress] = useState({ totalClaims: 0, cycleCount: 0, cycleTarget: 5 });
  const [claimsVersion, setClaimsVersion] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  useEffect(() => {
    if (!journey?.signedIn) return;
    fetch("/api/deals/claim", { cache: "no-store", credentials: "same-origin" })
      .then(async res => (res.ok ? await res.json() : null))
      .then(data => {
        if (data?.rewardsProgress) setRewardsProgress(data.rewardsProgress);
      })
      .catch(() => {});
  }, [claimsVersion, journey?.signedIn]);

  const promotions = result.promotions
    .filter(
      promo =>
        (kind === "all" || promo.kind === kind) &&
        `${promo.title} ${promo.badgeText ?? ""} ${promo.description} ${promo.venueName} ${promo.suburb}`
          .toLocaleLowerCase("en-AU")
          .includes(query.trim().toLocaleLowerCase("en-AU")),
    )
    .sort((first, second) => Date.parse(first.endsAt) - Date.parse(second.endsAt));

  return (
    <div className={styles.categoriesWrapper}>
      <div className={styles.dealTabsThree} role="tablist" aria-label="Deal categories">
        {categories.map((category, index) => {
          const isSelected = kind === category.id;
          const liveCount = result.promotions.filter(p => p.kind === category.id).length;
          const Icon = category.icon;

          return (
            <button
              key={category.id}
              ref={node => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-${category.id}-tab`}
              aria-controls={`${id}-panel`}
              aria-selected={isSelected}
              className={`${styles.categoryTabBtn} ${isSelected ? styles.categoryTabSelected : ""}`}
              onClick={() => setKind(curr => (curr === category.id ? "all" : category.id))}
            >
              <div className={styles.tabIconBox}>
                <Icon size={20} />
              </div>
              <div className={styles.tabTextBox}>
                <div className={styles.tabTitleRow}>
                  <strong>{category.name}</strong>
                  <span className={styles.tabBadgeCount}>{liveCount}</span>
                </div>
                <small>{category.subtitle}</small>
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.dealSearchSection}>
        <div className={styles.dealSearchBox}>
          <Search size={18} color="#08786e" aria-hidden="true" />
          <input
            type="search"
            value={query}
            maxLength={100}
            placeholder="Find an offer or restaurant"
            className={styles.dealSearchInput}
            onChange={event => setQuery(event.target.value)}
            aria-label="Find an offer or restaurant"
          />
        </div>
        <button
          type="button"
          className={`${styles.allResetBtn} ${kind === "all" ? styles.allResetBtnActive : ""}`}
          onClick={() => setKind("all")}
        >
          All Deals ({result.promotions.length})
        </button>
      </div>

      <section id={`${id}-panel`} role="tabpanel" tabIndex={0}>
        <PromotionList
          result={{ status: result.status, promotions }}
          onClaimed={() => setClaimsVersion(v => v + 1)}
        />
      </section>

      <Link href="/profile?tab=deals" className={styles.rewardsBanner} style={{ textDecoration: "none" }}>
        <span className={styles.tabIconBox} style={{ background: "rgba(255, 212, 77, 0.2)", color: "#ffd44d" }}>
          <Gift size={22} />
        </span>
        <div className={styles.rewardsProgressWrap}>
          <strong style={{ fontSize: 17, color: "#ffd44d" }}>FoodGo Rewards</strong>
          <span style={{ fontSize: 13, color: "#d5f6ee" }}>
            Earn more with every Admin-approved deal you redeem ({rewardsProgress.cycleCount} / {rewardsProgress.cycleTarget} this cycle)
          </span>
          <div className={styles.rewardsBarTrack}>
            <div
              className={styles.rewardsBarFill}
              style={{
                width: `${Math.min(100, Math.round((rewardsProgress.cycleCount / rewardsProgress.cycleTarget) * 100))}%`,
              }}
            />
          </div>
        </div>
        <span style={{ fontWeight: 900, fontSize: 15, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {rewardsProgress.cycleCount} / {rewardsProgress.cycleTarget} <ChevronRight size={18} />
        </span>
      </Link>
    </div>
  );
}
