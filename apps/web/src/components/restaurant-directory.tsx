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
    {unavailable ? <div className={style.directoryEmpty} role="status"><Store size={27} aria-hidden="true"/><div><h3>Restaurants are temporarily unavailable</h3><p>Please try again shortly. You can keep exploring the map.</p></div></div>
      : restaurants.length ? <div className={style.directory}>{restaurants.map(venue => (
        <Link key={venue.id} className={style.directoryEntry} href={demo ? `/demo/venue/${encodeURIComponent(venue.id)}` : `/venues/${encodeURIComponent(venue.slug)}`}>
          <span className={style.directoryPhoto}>{venue.image === "/images/venue-placeholder.svg" ? <span className={style.restaurantIcon}><Store size={32} aria-hidden="true" /></span>
            : <Image src={venue.image} width={420} height={250} sizes="(max-width:590px) 100vw, (max-width:900px) 45vw, 30vw" alt="" />}</span>
          <span className={style.directoryInfo}><strong>{venue.name}</strong><small>{venue.cuisine} · {venue.suburb}</small></span><ArrowUpRight className={style.directoryArrow} size={18} />
        </Link>
      ))}</div> : <div className={style.directoryEmpty}><Store size={27} aria-hidden="true"/><div><h3>Room at the table.</h3><p>No restaurants have published a listing yet. Approved places will appear here.</p><Link href="/partner">List your restaurant <ArrowUpRight size={15}/></Link></div></div>}
  </section>;
}
