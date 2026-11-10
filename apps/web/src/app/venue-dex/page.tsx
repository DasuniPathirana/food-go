import type { Metadata } from "next";
import { VenueDex } from "@/components/collections";

export const metadata: Metadata = { title: "VenueDex" };

export default function VenueDexPage() {
  return <VenueDex />;
}
