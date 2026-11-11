import { z } from "zod";

const email = z
  .string()
  .trim()
  .max(254)
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));
const strongPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .refine((value) => [...value].length >= 12, "Use at least 12 characters.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Use a password of 72 bytes or fewer.",
  );

export const signInSchema = z.strictObject({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});
export const registerSchema = z.strictObject({
  displayName: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(80)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/u.test(value),
      "Enter a name without control characters.",
    ),
  email,
  password: strongPassword,
});
export const forgotPasswordSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({ password: strongPassword });
export const signOutSchema = z.strictObject({});

const callbackDestinations = new Set([
  "/profile",
  "/partner",
  "/partner/onboarding",
  "/auth/reset-password",
]);
export function safeAuthDestination(value: string | null | undefined): string {
  return value && callbackDestinations.has(value) ? value : "/profile";
}

export type AuthMode =
  | "sign-in"
  | "register"
  | "forgot-password"
  | "reset-password";

export function publicAuthError(status?: number): {
  status: number;
  message: string;
} {
  if (status === 429)
    return {
      status: 429,
      message: "Too many attempts. Wait a little before trying again.",
    };
  if (status && status >= 500)
    return {
      status: 503,
      message:
        "Account services are temporarily unavailable. Try again shortly.",
    };
  return {
    status: 400,
    message:
      "We could not complete that request. Check your details or request a new email link.",
  };
}
