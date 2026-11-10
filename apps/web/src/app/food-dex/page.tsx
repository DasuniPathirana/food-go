import type { Metadata } from "next";
import { FoodDex } from "@/components/collections";

export const metadata: Metadata = { title: "FoodDex" };

export default function FoodDexPage() {
  return <FoodDex />;
}
