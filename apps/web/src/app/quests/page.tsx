import type { Metadata } from "next";
import { QuestCollection } from "@/components/quests";

export const metadata: Metadata = { title: "Quests & trails" };

export default function QuestsPage() {
  return <QuestCollection />;
}
