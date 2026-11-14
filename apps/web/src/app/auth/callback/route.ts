import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readAuthConfig } from "@/lib/auth/config";
import { safeAuthDestination } from "@/lib/auth/contracts";
import { createAuthClient } from "@/lib/auth/server";
import {
  createRecoveryPermission,
  recoveryCookieName,
  recoveryCookieLifetime,
} from "@/lib/auth/recovery";

export async function GET(request: Request) {
  const config = readAuthConfig(process.env);
  if (!config.configured)
    return new Response("Account services are not connected yet.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id");
  const failure = () =>
    NextResponse.redirect(
      new URL("/auth/sign-in?notice=link-expired", config.origin),
      { status: 303, headers: { "Cache-Control": "no-store" } },
    );
  if (
    !code ||
    code.length > 2048 ||
    (flowId !== null && !/^[a-zA-Z0-9_-]{1,128}$/u.test(flowId))
  )
    return failure();
  try {
    const client = await createAuthClient(config);
    const { data, error } = await client.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (error || !data.user || !data.session) return failure();
    const verification = await client.auth.getUser();
    if (verification.error || !verification.data.user?.email_confirmed_at) {
      await client.auth.signOut({ scope: "local" });
      return failure();
    }
    const store = await cookies();
    const recoveryOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: config.secureCookies,
      path: "/api/auth/reset-password",
    };
    let next = safeAuthDestination(url.searchParams.get("next"));
    if ("redirectType" in data && data.redirectType === "recovery") {
      store.set(
        recoveryCookieName,
        createRecoveryPermission(
          verification.data.user.id,
          config.cookieSecret,
        ),
        { ...recoveryOptions, maxAge: recoveryCookieLifetime },
      );
      next = "/auth/reset-password";
    } else {
      store.set(recoveryCookieName, "", { ...recoveryOptions, maxAge: 0 });
      if (next === "/auth/reset-password") next = "/profile";
    }
    return NextResponse.redirect(new URL(next, config.origin), {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return failure();
  }
}
