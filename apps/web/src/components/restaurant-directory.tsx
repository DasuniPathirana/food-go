import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Store } from "lucide-react";
import type { CatalogueVenue } from "@/lib/catalogue-contracts";
import style from "./deals.module.css";

export function RestaurantDirectory({ venues, unavailable = false, hasMore = false, demo = false }: {
  venues: readonly CatalogueVenue[]; unavailable?: boolean; hasMore?: boolean; demo?: boolean;
}) {
  const restaurants = venues.filter(venue => venue.type === "restaurant" && venue.source === (demo ? "demo" : "supabase"));
  return <section aria-labelledby="restaurant-directory">
    <div className={style.sectionHeading}><h2 id="restaurant-directory">{demo ? "Example restaurants" : "Restaurants"}</h2>
      {hasMore && <Link href="/?view=catalogue">Search the catalogue <ArrowUpRight size={15} /></Link>}
    </div>
    {unavailable ? <p className={style.availability} role="status">Restaurants are temporarily unavailable. Please try again shortly.</p>
      : restaurants.length ? <div className={style.directory}>{restaurants.map(venue => (
        <Link key={venue.id} className={style.directoryEntry} href={demo ? `/demo/venue/${encodeURIComponent(venue.id)}` : `/venues/${encodeURIComponent(venue.slug)}`}>
          {venue.image === "/images/venue-placeholder.svg" ? <span className={style.restaurantIcon}><Store size={25} aria-hidden="true" /></span>
            : <Image src={venue.image} width={64} height={64} alt="" />}
          <span><strong>{venue.name}</strong><small>{venue.cuisine} · {venue.suburb}</small></span><ArrowUpRight size={16} />
        </Link>
      ))}</div> : <p className={style.availability}>No restaurants have published a listing yet.</p>}
  </section>;
}
