import "server-only";
import { cookies } from "next/headers";
import {
  signInSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signOutSchema,
  publicAuthError,
} from "./contracts";
import { authJson, readAuthRequest } from "./http";
import { createAuthClient } from "./server";
import { canResetPassword, recoveryCookieName } from "./recovery";

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
