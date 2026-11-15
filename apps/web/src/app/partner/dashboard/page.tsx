import type { Metadata } from "next";
import Link from "next/link";
import { PartnerDashboard } from "@/components/partner-dashboard";
import { getAuthState } from "@/lib/auth/server";
import { readPartnerConfig } from "@/lib/partner/contracts";

export const metadata: Metadata = { title: "Your partner venues" };
export default async function PartnerDashboardPage() {
  if (!readPartnerConfig(process.env).configured) return <section className="empty-state"><h1>Restaurant accounts are temporarily unavailable</h1><p>Please try again shortly.</p></section>;
  const account = await getAuthState();
  if (!account.user) return <section className="empty-state"><h1>Sign in to see your venues</h1><p>Your private drafts belong to your organisation. Verify your email address or Australian mobile number to continue.</p><Link href="/auth/sign-in" className="primary-button">Sign in</Link></section>;
  return <PartnerDashboard />;
}
