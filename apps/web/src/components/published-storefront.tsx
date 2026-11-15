import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPromotions, getRestaurants } from "@/lib/catalogue-server";
import { PromotionList } from "./deals";
import { RestaurantDirectory } from "./restaurant-directory";
import style from "./deals.module.css";

export async function PublishedStorefront() {
  const [promotions, restaurants] = await Promise.all([getPromotions(), getRestaurants()]);
  return <div className={style.storefront}>
    <section aria-labelledby="current-promotions">
      <div className={style.sectionHeading}><h2 id="current-promotions">Promotions</h2><Link href="/deals">All deals <ArrowRight size={16} /></Link></div>
      <PromotionList result={promotions} limit={3} />
    </section>
    <RestaurantDirectory venues={restaurants.venues} hasMore={restaurants.hasMore} unavailable={restaurants.status === "unavailable"} />
  </div>;
}
