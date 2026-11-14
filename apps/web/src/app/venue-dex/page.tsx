import type { Metadata } from "next";
import { VenueDex } from "@/components/collections";
import { getCatalogue } from "@/lib/catalogue-server";

export const metadata: Metadata = { title: "VenueDex" };

export default async function VenueDexPage() {
  return <VenueDex catalogue={await getCatalogue()} />;
}
