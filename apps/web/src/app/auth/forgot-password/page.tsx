import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getAuthPresentation } from "@/lib/auth/server";
export const metadata: Metadata = { title: "Reset your password" };
export default function ForgotPasswordPage() {
  return (
    <AuthForm
      mode="forgot-password"
      configured={getAuthPresentation().configured}
    />
  );
}
