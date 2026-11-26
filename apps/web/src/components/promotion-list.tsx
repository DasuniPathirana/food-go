"use client";

import Link from "next/link";
import { ArrowRight, Clock, Gift, Store, X } from "lucide-react";
import { useState } from "react";
import type { PublicPromotion, PromotionResult } from "@/lib/promotions";
import styles from "./deals.module.css";

type ClaimReceipt = {
  claimId: string;
  claimCode: string;
  title: string;
  venueName: string;
  venueSlug: string;
  expiresAt: string;
};

export function PromotionList({
  result,
  limit,
  onClaimed,
}: {
  result: PromotionResult;
  limit?: number;
  onClaimed?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [claimErr, setClaimErr] = useState("");
  const [receipt, setReceipt] = useState<ClaimReceipt | null>(null);

  if (result.status === "unavailable") {
    return (
      <p role="status" className={styles.note}>
        Approved offers are temporarily unavailable. Please try again shortly.
      </p>
    );
  }

  const deals = result.promotions.slice(0, limit);
  if (!deals.length) {
    return (
      <section className={styles.offerEmpty}>
        <div>
          <h3>No approved offers in this category yet</h3>
          <p>
            Verified restaurant deals appear here as soon as they are published and Admin approved. Explore nearby food spots on the 3D map in the meantime.
          </p>
          <Link href="/">
            Explore Melbourne <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    );
  }

  async function redeemDeal(deal: PublicPromotion) {
    setBusyId(deal.id);
    setClaimErr("");
    try {
      const res = await fetch("/api/deals/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", promotionId: deal.id }),
      });
      if (res.status === 401) {
        window.location.href = `/auth/sign-in?next=${encodeURIComponent("/deals")}`;
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not claim this deal.");
      setReceipt({
        claimId: data.claim?.id ?? deal.id,
        claimCode: data.claim?.claimCode ?? "FOOD-PASS",
        title: deal.badgeText ? `${deal.badgeText} - ${deal.title}` : deal.title,
        venueName: deal.venueName,
        venueSlug: deal.venueSlug,
        expiresAt: deal.endsAt,
      });
      onClaimed?.();
    } catch (err) {
      setClaimErr(err instanceof Error ? err.message : "Could not claim this offer.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.dealsContainer}>
      {claimErr && (
        <p role="alert" style={{ color: "#991b1b", fontWeight: 700, marginBottom: 10 }}>
          {claimErr}
        </p>
      )}
      <div className={styles.dealCardsList}>
        {deals.map(deal => (
          <article className={styles.premiumDealCard} key={deal.id}>
            <div className={styles.dealVenueThumb}>
              {deal.venueImage && !deal.venueImage.includes("placeholder") ? (
                <img src={deal.venueImage} alt={deal.venueName} />
              ) : (
                <Store size={32} color="#8af4d8" />
              )}
              <span className={styles.miniPinBadge} aria-hidden="true">
                <Store size={13} />
              </span>
            </div>

            <div className={styles.dealInfoCol}>
              <h3 className={styles.dealVenueTitle}>{deal.venueName}</h3>
              <p className={styles.dealSuburb}>
                {deal.suburb} | {deal.kind === "cafe" ? "Cafe Offer" : deal.kind === "food" ? "Food Deal" : "Restaurant Deal"}
              </p>
              <strong className={styles.dealDiscountText}>
                {deal.badgeText || deal.title}
              </strong>
              <span className={styles.dealOfferDetail}>
                {deal.badgeText ? `${deal.title} - ${deal.description}` : deal.description}
              </span>
              <small style={{ color: "#b7f5e3", display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <Clock size={12} aria-hidden="true" /> Until{" "}
                {new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeZone: "Australia/Melbourne" }).format(
                  new Date(deal.endsAt),
                )}
              </small>
            </div>

            <div className={styles.dealActionCol}>
              {deal.imageUrl && <img src={deal.imageUrl} alt={deal.title} className={styles.dealDishPhoto} />}
              <button
                type="button"
                className={styles.redeemButton}
                disabled={busyId === deal.id}
                onClick={() => void redeemDeal(deal)}
              >
                {busyId === deal.id ? "Claiming..." : "Redeem"} <ArrowRight size={14} />
              </button>
              <Link
                href={`/venues/${encodeURIComponent(deal.venueSlug)}`}
                style={{ color: "#b7f5e3", fontSize: 12, fontWeight: 700, textDecoration: "underline" }}
              >
                View restaurant
              </Link>
            </div>
          </article>
        ))}
      </div>

      {receipt && (
        <div className={styles.voucherOverlay} role="dialog" aria-modal="true" aria-label="Reward voucher">
          <div className={styles.voucherModal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#08786e" }}>
                <Gift size={18} /> Food Go Offer Pass
              </span>
              <button type="button" onClick={() => setReceipt(null)} aria-label="Close voucher" style={{ border: 0, background: "transparent", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            <h3 style={{ margin: 0 }}>{receipt.venueName}</h3>
            <p style={{ margin: 0, fontWeight: 700 }}>{receipt.title}</p>
            <div className={styles.voucherCodeBox}>{receipt.claimCode}</div>
            <p style={{ margin: 0, fontSize: 13, color: "#4b6875" }}>
              Show this claim pass at the restaurant counter to redeem in person. No online payment required in Stage 1. Also saved to your Passport.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href={`/venues/${encodeURIComponent(receipt.venueSlug)}`} className="primary-button" style={{ flex: 1, justifyContent: "center" }}>
                Open Restaurant
              </Link>
              <button type="button" className="secondary-button" onClick={() => setReceipt(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
