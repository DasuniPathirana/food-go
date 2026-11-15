import type { Metadata } from "next";
import { ConnectedDeals } from "@/components/deals";
import { getPromotions } from "@/lib/catalogue-server";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  return <ConnectedDeals result={await getPromotions()} />;
}
