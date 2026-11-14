import type { Metadata } from "next";
import { FoodDex } from "@/components/collections";
import { getCatalogue } from "@/lib/catalogue-server";

export const metadata: Metadata = { title: "FoodDex" };

export default async function FoodDexPage() {
  return <FoodDex catalogue={await getCatalogue()} />;
}
