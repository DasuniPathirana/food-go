import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { readAuthConfig } from "./config";

export type AuthCookieUpdate = {
  name: string;
  value: string;
  options: CookieOptions;
};

/** Refresh before rendering and preserve the same refreshed cookies on the response. */
export async function refreshAuthSession(
  request: NextRequest,
  forwardedHeaders: Headers,
): Promise<AuthCookieUpdate[]> {
  const config = readAuthConfig(process.env);
  if (!config.configured) return [];
  const projectRef = new URL(config.supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  if (
    !request.cookies
      .getAll()
      .some(
        ({ name }) =>
          name === storageKey ||
          (name.startsWith(`${storageKey}.`) &&
            /^\d+$/u.test(name.slice(storageKey.length + 1))),
      )
  )
    return [];
  const pending = new Map<string, AuthCookieUpdate>();
  const client = createServerClient(config.supabaseUrl, config.publishableKey, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.secureCookies,
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (updates) => {
        for (const { name, value, options } of updates) {
          request.cookies.set(name, value);
          pending.set(name, {
            name,
            value,
            options: {
              ...options,
              httpOnly: true,
              sameSite: "lax",
              secure: config.secureCookies,
              path: "/",
            },
          });
        }
        forwardedHeaders.set("cookie", request.cookies.toString());
      },
    },
  });
  try {
    await client.auth.getUser();
  } catch {
    /* The page or API still verifies identity and fails closed. */
  }
  return [...pending.values()];
}
