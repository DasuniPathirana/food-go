import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { readAuthConfig, type AuthConfig } from "./config";
import { hasVerifiedIdentity } from "./contracts";
import { australianMobile } from "../phone-number";

export type SafeAccount = {
  id: string;
  displayName: string;
  email: string | null;
  phone?: string | null;
};
export type AuthState = { configured: boolean; user: SafeAccount | null };

export function getAuthPresentation() {
  return { configured: readAuthConfig(process.env).configured };
}

export function getPhoneAuthPresentation() {
  return {
    configured:
      readAuthConfig(process.env).configured &&
      process.env.FOOD_GO_PHONE_AUTH_ENABLED === "true",
  };
}

export async function createAuthClient(
  config: AuthConfig,
  allowCookieWrites = true,
) {
  const store = await cookies();
  return createServerClient(config.supabaseUrl, config.publishableKey, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.secureCookies,
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (updates) => {
        for (const { name, value, options } of updates) {
          if (allowCookieWrites)
            store.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: config.secureCookies,
              path: "/",
            });
          else {
            // Server Components cannot persist refresh cookies. API/callback paths do.
            // The global proxy persists refreshes before this render runs.
            try {
              store.set(name, value, {
                ...options,
                httpOnly: true,
                sameSite: "lax",
                secure: config.secureCookies,
                path: "/",
              });
            } catch {
              /* Read-only render context. */
            }
          }
        }
      },
    },
  });
}

export const getAuthState = cache(async (): Promise<AuthState> => {
  const config = readAuthConfig(process.env);
  if (!config.configured) return { configured: false, user: null };
  try {
    const client = await createAuthClient(config, false);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || !hasVerifiedIdentity(data.user))
      return { configured: true, user: null };
    const rawName: unknown = data.user.user_metadata?.display_name;
    return {
      configured: true,
      user: {
        id: data.user.id,
        displayName:
          typeof rawName === "string" && rawName.trim()
            ? rawName.trim().slice(0, 80)
            : "Food explorer",
        email: data.user.email ?? null,
        phone: data.user.phone_confirmed_at ? australianMobile(data.user.phone) : null,
      },
    };
  } catch {
    return { configured: true, user: null };
  }
});
