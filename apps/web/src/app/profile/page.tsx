import type { Metadata } from "next";
import { ExplorerProfile } from "@/components/profile";
import { getAuthState } from "@/lib/auth/server";

export const metadata: Metadata = { title: "My passport" };

export default async function ProfilePage() {
  const account = await getAuthState();
  return <ExplorerProfile account={account.user} />;
}
