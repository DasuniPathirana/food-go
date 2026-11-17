"use client";

import { useId, useRef, useState } from "react";
import { Search, Store, Utensils } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import { PromotionList } from "./promotion-list";
import styles from "./deals.module.css";

const categories = [{ id: "food", name: "Food Deals", description: "Meals, drinks and combos worth heading out for.", icon: Utensils },
  { id: "restaurant", name: "Restaurant Deals", description: "Dining offers for the whole table.", icon: Store }] as const;

export function DealCategories({ result }: { result: PromotionResult }) {
  const [kind, setKind] = useState<"food" | "restaurant">("food"), [query, setQuery] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]), id = useId();
  const current = categories.find(item => item.id === kind)!;
  const promotions = result.promotions.filter(promo => promo.kind === kind && `${promo.title} ${promo.description} ${promo.venueName} ${promo.suburb}`.toLocaleLowerCase("en-AU").includes(query.trim().toLocaleLowerCase("en-AU")))
    .sort((first, second) => Date.parse(first.endsAt) - Date.parse(second.endsAt));
  return <>
    <div className={styles.dealTabs} role="tablist" aria-label="Deal categories">{categories.map((category, index) => <button key={category.id} ref={node => { tabs.current[index] = node; }} type="button"
      role="tab" id={`${id}-${category.id}-tab`} aria-controls={`${id}-panel`} aria-selected={kind === category.id} tabIndex={kind === category.id ? 0 : -1}
      onClick={() => setKind(category.id)} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
        setKind(categories[next].id); tabs.current[next]?.focus();
      }}><category.icon size={24}/><span><strong>{category.name}</strong><small>{category.id === "food" ? "By the plate" : "For the occasion"}</small></span><b>{result.promotions.filter(promo => promo.kind === category.id).length}</b></button>)}</div>
    <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${kind}-tab`} tabIndex={0}>
      <div className={styles.dealToolbar}><div><h2>{current.name}</h2><p>{current.description}</p></div><label className={styles.dealSearch}><Search size={18}/><span className={styles.srOnly}>Search {current.name}</span><input value={query} maxLength={100} placeholder="Find an offer or restaurant" type="search" onChange={event => setQuery(event.target.value)}/></label></div>
      <PromotionList result={{ status: result.status, promotions }}/>
    </section>
  </>;
}
