import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding";
import Link from "next/link";
import { getAuthState } from "@/lib/auth/server";
import { readPartnerConfig } from "@/lib/partner/contracts";

export const metadata: Metadata = { title: "Build your venue draft" };

export default async function OnboardingPage() {
  const connected = readPartnerConfig(process.env).configured;
  const account = await getAuthState();
  if (connected && !account.user) return <section className="empty-state"><h1>Sign in to save your venue</h1><p>Verify your email address or Australian mobile number to create a private venue draft.</p><Link href="/auth/sign-in" className="primary-button">Sign in</Link></section>;
  return <Onboarding connected={connected} />;
}
