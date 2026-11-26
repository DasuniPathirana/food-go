import type { Metadata } from "next";
import { getAuthState } from "@/lib/auth/server";
import { Outback } from "@/components/adventure/outback";

export const metadata: Metadata = { title: "Outback - Coming Soon" };
export default async function OutbackPage() {
  const account = await getAuthState();
  return <Outback signedIn={Boolean(account.user)}/>;
}
