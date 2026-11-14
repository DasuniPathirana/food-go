import "server-only";
import { cookies } from "next/headers";
import {
  signInSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signOutSchema,
  publicAuthError,
  phoneCodeRequestSchema,
  phoneCodeVerifySchema,
} from "./contracts";
import { authJson, readAuthRequest } from "./http";
import { createAuthClient } from "./server";
import { canResetPassword, recoveryCookieName } from "./recovery";
import { australianMobile } from "../phone-number";

type AuthClientFactory = typeof createAuthClient;

function phoneProviderStatus(error: { status?: number; code?: string }) {
  if (error.status === 429 || ["over_sms_send_rate_limit", "over_request_rate_limit"].includes(error.code ?? "")) return 429;
  if (["signup_disabled", "user_not_found", "phone_exists", "user_already_exists", "user_banned",
    "otp_expired", "invalid_credentials", "phone_not_confirmed", "validation_failed"].includes(error.code ?? "")) return 400;
  if (
    error.status === 401 || error.status === 403 ||
    (error.status && error.status >= 500) ||
    ["phone_provider_disabled", "provider_disabled", "otp_disabled", "sms_send_failed", "captcha_failed",
      "hook_timeout", "hook_timeout_after_retry", "hook_payload_over_size_limit",
      "hook_payload_invalid_content_type", "request_timeout", "unexpected_failure"].includes(error.code ?? "")
  ) return 503;
  return 400;
}

function phoneFailure(status?: number) {
  if (status === 429)
    return Response.json(
      { error: "Too many attempts. Wait a little before requesting another code." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  if (status && status >= 500)
    return authJson({ error: "Phone sign-in is temporarily unavailable. Try again shortly." }, 503);
  return authJson({ error: "That code could not be verified. Check it or request a new code." }, 400);
}

export async function requestPhoneCode(
  request: Request,
  createClient: AuthClientFactory = createAuthClient,
) {
  const input = await readAuthRequest(request, phoneCodeRequestSchema);
  if (!input.ok) return input.response;
  if (process.env.FOOD_GO_PHONE_AUTH_ENABLED !== "true")
    return authJson({ error: "Phone sign-in is not connected yet." }, 503);
  try {
    const client = await createClient(input.config);
    const { error } = await client.auth.signInWithOtp({
      phone: input.data.phone,
      options: { channel: "sms", shouldCreateUser: true },
    });
    if (error) {
      const status = phoneProviderStatus(error);
      if (status !== 400) return phoneFailure(status);
    }
    // Existing and new-number responses stay identical. Supabase's signup
    // setting controls whether a new account may actually be created.
    return authJson({
      message: "If this number can be used, a sign-in code will arrive shortly.",
      retryAfter: 60,
    });
  } catch {
    return phoneFailure(503);
  }
}

export async function verifyPhoneCode(
  request: Request,
  createClient: AuthClientFactory = createAuthClient,
) {
  const input = await readAuthRequest(request, phoneCodeVerifySchema);
  if (!input.ok) return input.response;
  if (process.env.FOOD_GO_PHONE_AUTH_ENABLED !== "true")
    return authJson({ error: "Phone sign-in is not connected yet." }, 503);
  try {
    const client = await createClient(input.config);
    const verification = await client.auth.verifyOtp({
      phone: input.data.phone,
      token: input.data.token,
      type: "sms",
    });
    if (verification.error) return phoneFailure(phoneProviderStatus(verification.error));
    if (!verification.data.session) return phoneFailure();
    const { data, error } = await client.auth.getUser();
    if (
      error || !data.user?.phone_confirmed_at ||
      !data.user.phone || !/^\+?614\d{8}$/u.test(data.user.phone) ||
      australianMobile(data.user.phone) !== input.data.phone
    ) {
      await client.auth.signOut({ scope: "local" });
      return phoneFailure();
    }
    return authJson({ redirectTo: "/profile" });
  } catch {
    return phoneFailure(503);
  }
}

function failure(status?: number) {
  const error = publicAuthError(status);
  return authJson({ error: error.message }, error.status);
}

export async function signIn(request: Request) {
  const input = await readAuthRequest(request, signInSchema);
  if (!input.ok) return input.response;
  try {
    const client = await createAuthClient(input.config);
    const { error } = await client.auth.signInWithPassword(input.data);
    if (error) return failure(error.status);
    const { data, error: userError } = await client.auth.getUser();
    if (userError || !data.user?.email_confirmed_at) {
      await client.auth.signOut({ scope: "local" });
      return failure();
    }
    return authJson({ redirectTo: "/profile" });
  } catch {
    return failure(503);
  }
}

export async function register(request: Request) {
  const input = await readAuthRequest(request, registerSchema);
  if (!input.ok) return input.response;
  try {
    const client = await createAuthClient(input.config);
    const { data, error } = await client.auth.signUp({
      email: input.data.email,
      password: input.data.password,
      options: {
        data: { display_name: input.data.displayName },
        emailRedirectTo: `${input.config.origin}/auth/callback?next=/profile`,
      },
    });
    // Email confirmation must be enabled by the project owner. Do not retain an
    // auto-confirmed session if the provider project is configured incorrectly.
    if (data.session) {
      await client.auth.signOut({ scope: "local" });
      return authJson(
        {
          error:
            "Account setup is not complete. Please try again after email confirmation is configured.",
        },
        503,
      );
    }
    if (error?.status === 429 || (error?.status && error.status >= 500))
      return failure(error.status);
    // Use the same public result for existing and newly registered addresses.
    return authJson({
      message:
        "If this address can be used, you will receive an email to finish creating your account. Open it in this browser.",
    });
  } catch {
    return failure(503);
  }
}

export async function forgotPassword(request: Request) {
  const input = await readAuthRequest(request, forgotPasswordSchema);
  if (!input.ok) return input.response;
  try {
    const client = await createAuthClient(input.config);
    const { error } = await client.auth.resetPasswordForEmail(
      input.data.email,
      {
        redirectTo: `${input.config.origin}/auth/callback?next=/auth/reset-password`,
      },
    );
    if (error?.status === 429 || (error?.status && error.status >= 500))
      return failure(error.status);
    return authJson({
      message:
        "If an account matches that address, a reset email will arrive shortly. Open its link in this browser.",
    });
  } catch {
    return failure(503);
  }
}

export async function resetPassword(request: Request) {
  const input = await readAuthRequest(request, resetPasswordSchema);
  if (!input.ok) return input.response;
  try {
    const client = await createAuthClient(input.config);
    const { data, error } = await client.auth.getUser();
    const store = await cookies();
    if (
      error ||
      !data.user ||
      !canResetPassword(
        store.get(recoveryCookieName)?.value,
        data.user.id,
        input.config.cookieSecret,
      )
    )
      return authJson(
        {
          error:
            "Open a new password reset email link before changing your password.",
        },
        401,
      );
    const update = await client.auth.updateUser({
      password: input.data.password,
    });
    if (update.error) return failure(update.error.status);
    store.set(recoveryCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: input.config.secureCookies,
      path: "/api/auth/reset-password",
      maxAge: 0,
    });
    // The password update has already succeeded. Do not silently claim that
    // other sessions were signed out if the provider rejects revocation.
    let revocationFailed = false;
    try {
      const result = await client.auth.signOut({ scope: "global" });
      revocationFailed = Boolean(result.error);
    } catch {
      revocationFailed = true;
    }
    if (revocationFailed)
      return authJson(
        {
          error:
            "Your password was updated, but signing out other sessions could not be confirmed. Please sign out and sign in again.",
        },
        503,
      );
    return authJson({
      message:
        "Your password has been updated. Sign in with your new password.",
      redirectTo: "/auth/sign-in?notice=password-updated",
    });
  } catch {
    return failure(503);
  }
}

export async function signOut(request: Request) {
  const input = await readAuthRequest(request, signOutSchema);
  if (!input.ok) return input.response;
  try {
    const client = await createAuthClient(input.config);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return failure(error.status);
    const store = await cookies();
    store.set(recoveryCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: input.config.secureCookies,
      path: "/api/auth/reset-password",
      maxAge: 0,
    });
    return authJson({ redirectTo: "/" });
  } catch {
    return failure(503);
  }
}
