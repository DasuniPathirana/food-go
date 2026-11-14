import type { Metadata } from "next";
import { ConnectedDeals } from "@/components/deals";

export const metadata: Metadata = { title: "Deals" };

export default function DealsPage() {
  return <ConnectedDeals />;
}
