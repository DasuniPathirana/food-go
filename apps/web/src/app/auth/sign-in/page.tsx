import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getAuthState } from "@/lib/auth/server";
import { signInDestination } from "@/lib/auth-return";
export const metadata: Metadata = { title: "Sign in" };
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await getAuthState();
  const query = await searchParams;
  const destination = signInDestination(query.next);
  if (state.user) redirect(destination || (state.user.accountType === "partner" ? "/partner/dashboard" : "/"));
  const notice =
    query.notice === "link-expired" || query.notice === "password-updated"
      ? query.notice
      : undefined;
  return (
    <AuthForm mode="sign-in" configured={state.configured} notice={notice} destination={destination} />
  );
}
