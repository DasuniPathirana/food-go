import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding";
import Link from "next/link";
import { getAuthState } from "@/lib/auth/server";
import { readPartnerConfig } from "@/lib/partner/contracts";

export const metadata: Metadata = { title: "Build your venue draft" };

export default async function OnboardingPage() {
  const connected = readPartnerConfig(process.env).configured;
  const account = await getAuthState();
  if (!account.user || !connected) return <section className="empty-state"><h1>Sign in to register your restaurant</h1><p>Confirm your email address or mobile number to manage your listing.</p><Link href="/auth/sign-in?next=/partner/dashboard" className="primary-button">Sign in</Link></section>;
  return <Onboarding connected />;
}
