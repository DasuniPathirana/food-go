import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding";

export const metadata: Metadata = { title: "Build your venue draft" };

export default function OnboardingPage() {
  return <Onboarding />;
}
