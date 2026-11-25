import type { Metadata } from "next";
import { getAuthState } from "@/lib/auth/server";
import { EncounterWorkspace } from "@/components/encounter-workspace";

export const metadata: Metadata = { title: "Restaurant encounters", robots: { index: false, follow: false } };
export default async function EncountersPage() {
  const account = await getAuthState();
  return <EncounterWorkspace key={account.user?.id ?? "visitor"} mode="manage" signedIn={!!account.user}
    accountKey={account.user?.id} enabled={process.env.FOOD_GO_ENCOUNTERS_ENABLED === "true"}/>;
}
