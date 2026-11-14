import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getAuthPresentation } from "@/lib/auth/server";
export const metadata: Metadata = { title: "Create an account" };
export default function RegisterPage() {
  return (
    <AuthForm mode="register" configured={getAuthPresentation().configured} />
  );
}
