"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight, Gift, Star, Utensils, Croissant, Coffee, Store } from "lucide-react";
import type { PromotionResult } from "@/lib/promotions";
import styles from "./deals.module.css";

const FEATURED_DEALS = [
  {
    id: "featured-ovenhouse",
    venueName: "The Ovenhouse",
    venueSlug: "the-ovenhouse",
    rating: 4.8,
    distance: "180 m",
    discount: "20% OFF",
    offerDetail: "on mains this week",
    image: "/images/brunch.jpg",
    dishAlt: "Roasted chicken with fresh vegetables",
    buildingType: "ovenhouse",
    icon: Utensils,
    iconColor: "#f6c944",
  },
  {
    id: "featured-riverside",
    venueName: "Riverside Bakery",
    venueSlug: "riverside-bakery",
    rating: 4.7,
    distance: "320 m",
    discount: "Buy 1 Get 1",
    offerDetail: "on selected pastries",
    image: "/images/pizza.jpg",
    dishAlt: "Freshly baked golden croissants",
    buildingType: "bakery",
    icon: Store,
    iconColor: "#f6c944",
  },
  {
    id: "featured-cafe-alba",
    venueName: "Café Alba",
    venueSlug: "cafe-alba",
    rating: 4.6,
    distance: "450 m",
    discount: "$2 OFF",
    offerDetail: "any coffee & cake combo",
    image: "/images/coffee.jpg",
    dishAlt: "Artisanal latte with chocolate layer cake",
    buildingType: "cafe",
    icon: Coffee,
    iconColor: "#f6c944",
  },
];

export function PromotionList({ result, limit }: { result: PromotionResult; limit?: number }) {
  const dealsToDisplay = result.promotions.length > 0
    ? result.promotions.slice(0, limit)
    : FEATURED_DEALS;

  return (
    <div className={styles.dealsContainer}>
      <div className={styles.dealCardsList}>
        {dealsToDisplay.map((deal) => {
          const isFeatured = "discount" in deal;
          const venueName = deal.venueName;
          const rating = isFeatured ? deal.rating : 4.8;
          const distance = isFeatured ? deal.distance : "CBD";
          const discount = isFeatured ? deal.discount : "Special Offer";
          const detail = isFeatured ? deal.offerDetail : deal.title;
          const image = isFeatured ? deal.image : "/images/brunch.jpg";
          const dishAlt = isFeatured ? deal.dishAlt : deal.title;
          const Icon = isFeatured ? deal.icon : Utensils;

          return (
            <article className={styles.premiumDealCard} key={deal.id}>
              {/* Left Column: Miniature Venue Visual & Badge */}
              <div className={styles.dealVenueMini}>
                <div className={styles.miniPinBadge}>
                  <Icon size={14} className={styles.miniPinIcon} />
                </div>
                <div className={styles.miniBuildingGraphic} aria-hidden="true">
                  <div className={styles.miniBuildingRoof} />
                  <div className={styles.miniBuildingFacade}>
                    <div className={styles.miniAwning} />
                    <div className={styles.miniDoor} />
                  </div>
                </div>
              </div>

              {/* Middle Column: Venue Details, Rating, Discount Offer */}
              <div className={styles.dealInfoCol}>
                <div className={styles.dealVenueMeta}>
                  <h3 className={styles.dealVenueTitle}>{venueName}</h3>
                  <div className={styles.dealRatingRow}>
                    <Star size={12} className={styles.dealStarIcon} fill="#f6c944" />
                    <span>{rating}</span>
                    <span className={styles.dealDotSep}>·</span>
                    <span>{distance}</span>
                  </div>
                </div>

                <div className={styles.dealOfferHighlight}>
                  <strong className={styles.dealDiscountText}>{discount}</strong>
                  <span className={styles.dealOfferDetail}>{detail}</span>
                </div>
              </div>

              {/* Right Column: Appetizing Dish Visual with Radial Glow + Redeem CTA */}
              <div className={styles.dealActionCol}>
                <div className={styles.dishGlowContainer}>
                  <div className={styles.dishSunburst} aria-hidden="true" />
                  <div className={styles.dishPhotoWrapper}>
                    <Image
                      src={image}
                      alt={dishAlt}
                      width={90}
                      height={90}
                      className={styles.dishPhoto}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.redeemButton}
                  onClick={() => alert(`Offer "${discount}" redeemed for ${venueName}!`)}
                  aria-label={`Redeem ${discount} at ${venueName}`}
                >
                  <span>Redeem</span>
                  <ArrowRight size={13} strokeWidth={2.4} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* FoodGo Rewards Progress Banner */}
      <section className={styles.rewardsCard} aria-label="FoodGo Rewards Progress">
        <div className={styles.rewardsIconWrapper}>
          <Gift size={24} className={styles.rewardsGiftIcon} />
        </div>
        <div className={styles.rewardsTextCol}>
          <h2 className={styles.rewardsTitle}>FoodGo Rewards</h2>
          <p className={styles.rewardsSubtitle}>Earn more with every deal you redeem.</p>
          <div className={styles.rewardsProgressRow}>
            <div className={styles.rewardsProgressBar}>
              <div className={styles.rewardsProgressFill} style={{ width: "0%" }} />
            </div>
            <span className={styles.rewardsCounter}>0 / 5</span>
          </div>
        </div>
        <ChevronRight size={18} className={styles.rewardsChevron} />
      </section>
    </div>
  );
}
