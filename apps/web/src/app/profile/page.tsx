import type { Metadata } from "next";
import { ExplorerProfile } from "@/components/profile";
import { getAuthState } from "@/lib/auth/server";
import { getCatalogue } from "@/lib/catalogue-server";

export const metadata: Metadata = { title: "My passport" };

export default async function ProfilePage() {
  const [account, catalogue] = await Promise.all([getAuthState(), getCatalogue()]);
  return <ExplorerProfile account={account.user} catalogue={catalogue} />;
}
