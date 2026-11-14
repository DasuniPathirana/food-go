import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PhoneAuthForm } from "@/components/phone-auth-form";
import { getAuthState, getPhoneAuthPresentation } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Sign in with your mobile" };

export default async function PhoneSignInPage() {
  if ((await getAuthState()).user) redirect("/profile");
  return <PhoneAuthForm configured={getPhoneAuthPresentation().configured} />;
}
