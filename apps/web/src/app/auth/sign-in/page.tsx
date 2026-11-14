import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getAuthState } from "@/lib/auth/server";
export const metadata: Metadata = { title: "Sign in" };
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = await getAuthState();
  if (state.user) redirect("/profile");
  const query = await searchParams;
  const notice =
    query.notice === "link-expired" || query.notice === "password-updated"
      ? query.notice
      : undefined;
  return (
    <AuthForm mode="sign-in" configured={state.configured} notice={notice} />
  );
}
