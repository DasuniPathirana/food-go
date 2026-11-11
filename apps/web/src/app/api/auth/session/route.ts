import { readAuthConfig } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/server";
import { authJson } from "@/lib/auth/http";

// Refresh cookies in a writable route. This response never returns tokens.
export async function GET() {
  const config = readAuthConfig(process.env);
  if (!config.configured)
    return authJson({ configured: false, user: null }, 503);
  try {
    const client = await createAuthClient(config);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user?.email_confirmed_at)
      return authJson({ configured: true, user: null });
    const raw: unknown = data.user.user_metadata?.display_name;
    return authJson({
      configured: true,
      user: {
        id: data.user.id,
        displayName:
          typeof raw === "string" && raw.trim()
            ? raw.trim().slice(0, 80)
            : "Food explorer",
      },
    });
  } catch {
    return authJson(
      { error: "Account services are temporarily unavailable." },
      503,
    );
  }
}
