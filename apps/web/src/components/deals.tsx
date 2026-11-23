import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Compass, MapPin, Percent, Ticket, Zap } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import styles from "./deals.module.css";
import { PromotionList } from "./promotion-list";
import { DealCategories } from "./deal-categories";
export { PromotionList } from "./promotion-list";

const DEMO_DEALS = [
  {
    id: "deal-1",
    title: "Half-price flat white",
    venue: "Morning Brew Cafe",
    suburb: "Fitzroy",
    image: "/images/coffee.jpg",
    discount: "50% off",
    description: "Start your morning right with a perfectly crafted flat white at half price. Available before 10 am on weekdays.",
    expiry: "Ends 30 Nov",
    category: "cafe",
  },
  {
    id: "deal-2",
    title: "Buy one get one free pizza",
    venue: "Stone and Fire",
    suburb: "Carlton",
    image: "/images/pizza.jpg",
    discount: "2 for 1",
    description: "Grab a mate and enjoy two wood-fired pizzas for the price of one. Available for dine-in every Tuesday.",
    expiry: "Ends 15 Dec",
    category: "pizza",
  },
  {
    id: "deal-3",
    title: "Free dessert with any main",
    venue: "Garden Terrace",
    suburb: "South Yarra",
    image: "/images/brunch.jpg",
    discount: "Free dessert",
    description: "Treat yourself to a complimentary dessert when you order any main course. Perfect for date night.",
    expiry: "Ends 20 Dec",
    category: "restaurant",
  },
  {
    id: "deal-4",
    title: "20% off your first order",
    venue: "Noodle House",
    suburb: "Melbourne CBD",
    image: "/images/venue-placeholder.svg",
    discount: "20% off",
    description: "New to Noodle House? Enjoy 20% off your entire first visit. Show this deal at the counter.",
    expiry: "Ongoing",
    category: "restaurant",
  },
  {
    id: "deal-5",
    title: "Lunch special: $12 bowls",
    venue: "Pho Corner",
    suburb: "Richmond",
    image: "/images/brunch.jpg",
    discount: "$12 bowls",
    description: "Any regular pho bowl for just twelve dollars between 11 am and 2 pm. Dine-in only.",
    expiry: "Weekdays only",
    category: "restaurant",
  },
  {
    id: "deal-6",
    title: "Happy hour bites",
    venue: "Rooftop Social",
    suburb: "Collingwood",
    image: "/images/coffee.jpg",
    discount: "30% off",
    description: "Thirty percent off all share plates during happy hour, 4 pm to 6 pm daily. Great views included.",
    expiry: "Ends 31 Dec",
    category: "cafe",
  },
] as const;

export function DemoDeals() {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1>Deals</h1>
          <p>Discover delicious offers from local venues near you.</p>
        </div>
        <Link className={styles.mapLink} href="/demo/explore?map=adventure">
          <Compass size={17} /> Find a place <Zap size={15} />
        </Link>
      </header>
      <div className={styles.summary} aria-label="Deal summary">
        <span>
          <Ticket /> <strong>{DEMO_DEALS.length}</strong> deals available
        </span>
        <span>
          <MapPin /> <strong>6</strong> venues offering
        </span>
        <span>
          <Percent /> <strong>Up to 50%</strong> off
        </span>
      </div>
      <div className={styles.collection}>
        {DEMO_DEALS.map((deal) => (
          <article className={styles.dealCard} key={deal.id}>
            <div className={styles.dealPhoto}>
              <Image
                src={deal.image}
                alt={deal.title}
                width={500}
                height={350}
                sizes="(max-width: 620px) 135px, (max-width: 900px) 46vw, 32vw"
              />
            </div>
            <div className={styles.dealInfo}>
              <h2>{deal.title}</h2>
              <p>{deal.venue}</p>
              <small>{deal.suburb}</small>
            </div>
            <div className={styles.stub}>
              <span>
                <Clock size={14} />
                {deal.expiry}
              </span>
              <strong>
                <Ticket size={14} />
                {deal.discount}
              </strong>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.note}>
        These are example deals for demonstration. No real discounts or vouchers are issued.
      </p>
    </div>
  );
}

export function ConnectedDeals({ result }: { result: PromotionResult }) {
  return (
    <div className={styles.page}>
      <header className={`${styles.heading} ${styles.connectedHeading}`}>
        <div className={styles.headingContent}>
          <span className={styles.dealEyebrow}>Good food. Local rewards.</span>
          <h1 className={styles.dealPageTitle}>Deals</h1>
          <p className={styles.dealSubtitle}>
            Discover tasty offers, special savings, and rewards from your favourite local spots.
          </p>
        </div>
        <div className={styles.heroTicketIllustration} aria-hidden="true">
          <div className={styles.heroPedestal}>
            <div className={styles.heroTicketAura} />
            <div className={styles.heroTicketBadge}>
              <span className={styles.heroPercentSign}>%</span>
            </div>
            <div className={styles.heroPedestalBase} />
          </div>
        </div>
      </header>

      <DealCategories result={result} />
    </div>
  );
}

export function DemoPromoStrip() {
  const promo = DEMO_DEALS[0];
  return <section className={styles.previewStrip} aria-labelledby="example-promotions">
    <div className={styles.sectionHeading}><h2 id="example-promotions">Example promotions</h2>
      <Link href="/demo/deals">All demo deals <ArrowRight size={16} /></Link></div>
    <div className={styles.promotion}><div className={styles.ticketIcon}><Ticket size={21} aria-hidden="true" /></div>
      <div><h3>{promo.title}</h3><p>{promo.venue} · {promo.suburb}</p><small>Example offer · {promo.discount}</small></div></div>
  </section>;
}
