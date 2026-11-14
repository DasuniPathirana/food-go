"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Compass, MapPin, Percent, Ticket, Zap } from "lucide-react";
import styles from "./deals.module.css";

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
        <Link className={styles.mapLink} href="/demo/explore">
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

export function ConnectedDeals() {
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>Deals near you</h1>
          <p>Local offers and discoveries from venues in your neighbourhood.</p>
        </div>
        <Link className="secondary-button" href="/">
          <Compass size={17} />
          Find a place
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="profile-grid">
        <section className="content-panel" aria-labelledby="deals-title">
          <div className="section-heading">
            <div>
              <h2 id="deals-title">Available deals</h2>
            </div>
            <Ticket size={24} />
          </div>
          <div className="stat-grid" aria-label="Deals summary">
            <div className="stat-card">
              <Ticket size={19} />
              <strong>{DEMO_DEALS.length}</strong>
              <span>Deals available</span>
            </div>
            <div className="stat-card">
              <MapPin size={19} />
              <strong>6</strong>
              <span>Venues offering</span>
            </div>
            <div className="stat-card">
              <Percent size={19} />
              <strong>50%</strong>
              <span>Best discount</span>
            </div>
          </div>
        </section>
      </div>
      <section style={{ marginTop: "24px" }}>
        {DEMO_DEALS.map((deal) => (
          <article
            key={deal.id}
            style={{
              display: "flex",
              gap: "16px",
              padding: "16px 0",
              borderBottom: "1px solid var(--line, #dddcd4)",
              alignItems: "center",
            }}
          >
            <div
              style={{
                flex: "0 0 80px",
                height: "60px",
                borderRadius: "8px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Image
                src={deal.image}
                alt=""
                width={80}
                height={60}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{deal.title}</h3>
              <p style={{ margin: "2px 0 0", fontSize: "14px", color: "var(--muted, #414141)" }}>
                {deal.venue} · {deal.suburb}
              </p>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "5px",
                background: "var(--primary, #c73527)",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              <Ticket size={14} />
              {deal.discount}
            </span>
          </article>
        ))}
      </section>
      <p className="inline-notice" style={{ marginTop: "20px" }}>
        <Ticket size={19} />
        These are example deal designs. No real discounts or vouchers are issued in this preview.
      </p>
    </>
  );
}
