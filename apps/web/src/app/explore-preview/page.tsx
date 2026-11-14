import type { Metadata } from "next";
import { Discovery } from "@/components/discovery";
import { loadCatalogue } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Explore the example neighbourhood" };

/** Explicit opt-in preview; never a fallback for the connected public catalogue. */
export default async function ExplorePreviewPage() {
  return <Discovery catalogue={await loadCatalogue({ mode: "demo" })} />;
}
