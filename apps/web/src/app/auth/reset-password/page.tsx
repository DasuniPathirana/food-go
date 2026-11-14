import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { getAuthPresentation } from "@/lib/auth/server";
export const metadata: Metadata = { title: "Choose a new password" };
export default function ResetPasswordPage() {
  return (
    <AuthForm
      mode="reset-password"
      configured={getAuthPresentation().configured}
    />
  );
}
