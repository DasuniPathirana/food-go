import type { Metadata } from "next";
import { QuestCollection } from "@/components/quests";
import { getCatalogue } from "@/lib/catalogue-server";

export const metadata: Metadata = { title: "Quests & trails" };

export default async function QuestsPage() {
  return <QuestCollection catalogue={await getCatalogue()} />;
}
