"use client";

import { useId, useRef, useState } from "react";
import { Coffee, Search, SlidersHorizontal, Store, Utensils } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import { PromotionList } from "./promotion-list";
import styles from "./deals.module.css";

const categories = [
  { id: "food", name: "Food Deals", count: 12, subtitle: "Meals & combos", icon: Utensils },
  { id: "restaurant", name: "Restaurant Deals", count: 8, subtitle: "Dine & save", icon: Store },
  { id: "cafe", name: "Café Offers", count: 6, subtitle: "Drinks & treats", icon: Coffee },
] as const;

export function DealCategories({ result }: { result: PromotionResult }) {
  const [kind, setKind] = useState<"food" | "restaurant" | "cafe">("restaurant");
  const [query, setQuery] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const promotions = result.promotions
    .filter(
      (promo) =>
        (promo.kind === kind || (kind === "cafe" && promo.kind === "food")) &&
        `${promo.title} ${promo.description} ${promo.venueName} ${promo.suburb}`
          .toLocaleLowerCase("en-AU")
          .includes(query.trim().toLocaleLowerCase("en-AU"))
    )
    .sort((first, second) => Date.parse(first.endsAt) - Date.parse(second.endsAt));

  return (
    <div className={styles.categoriesWrapper}>
      {/* 3 Illustrated Category Pills */}
      <div className={styles.dealTabs} role="tablist" aria-label="Deal categories">
        {categories.map((category, index) => {
          const isSelected = kind === category.id;
          const liveCount = result.promotions.filter((p) => p.kind === category.id).length;
          const displayCount = liveCount > 0 ? liveCount : category.count;
          const Icon = category.icon;

          return (
            <button
              key={category.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-${category.id}-tab`}
              aria-controls={`${id}-panel`}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={`${styles.categoryTabBtn} ${isSelected ? styles.categoryTabSelected : ""}`}
              onClick={() => setKind(category.id)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                    ? categories.length - 1
                    : event.key === "ArrowLeft"
                    ? (index - 1 + categories.length) % categories.length
                    : (index + 1) % categories.length;
                setKind(categories[next].id);
                tabs.current[next]?.focus();
              }}
            >
              <div className={styles.tabIconBox}>
                <Icon size={20} className={styles.tabIcon} />
              </div>
              <div className={styles.tabTextBox}>
                <div className={styles.tabTitleRow}>
                  <strong>{category.name}</strong>
                  <span className={styles.tabBadgeCount}>{displayCount}</span>
                </div>
                <small>{category.subtitle}</small>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search Input with Filter Button */}
      <div className={styles.dealSearchSection}>
        <div className={styles.dealSearchBox}>
          <Search size={18} className={styles.dealSearchIcon} aria-hidden="true" />
          <input
            type="search"
            value={query}
            maxLength={100}
            placeholder="Find an offer or restaurant"
            className={styles.dealSearchInput}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Find an offer or restaurant"
          />
          <button
            type="button"
            className={styles.dealFilterBtn}
            aria-label="Filter deals"
            onClick={() => {}}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
      </div>

      {/* Promotions List */}
      <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${kind}-tab`} tabIndex={0}>
        <PromotionList result={{ status: result.status, promotions }} />
      </section>
    </div>
  );
}
