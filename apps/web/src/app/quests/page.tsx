import type { Metadata } from "next";
import { QuestBoard } from "@/components/adventure/quest-board";
import { getAuthState } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Quests & trails" };

export default async function QuestsPage() {
  const account = await getAuthState();
  return <QuestBoard signedIn={Boolean(account.user)}/>;
}
