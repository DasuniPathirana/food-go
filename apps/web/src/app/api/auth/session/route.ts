import { readAuthConfig } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/server";
import { authJson } from "@/lib/auth/http";
import { hasVerifiedIdentity } from "@/lib/auth/contracts";
import { australianMobile } from "@/lib/phone-number";
import { ageStatusSchema } from "@/lib/age-contracts";

// Refresh cookies in a writable route. This response never returns tokens.
export async function GET() {
  const config = readAuthConfig(process.env);
  if (!config.configured)
    return authJson({ configured: false, user: null }, 503);
  try {
    const client = await createAuthClient(config);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || !hasVerifiedIdentity(data.user))
      return authJson({ configured: true, user: null });
    const raw: unknown = data.user.user_metadata?.display_name;
    const result = await client.rpc("food_go_age_status").abortSignal(AbortSignal.timeout(5000));
    const age = result.error ? null : ageStatusSchema.safeParse(result.data);
    return authJson({
      configured: true,
      user: {
        id: data.user.id,
        ageStatus: age?.success ? age.data : null,
        displayName:
          typeof raw === "string" && raw.trim()
            ? raw.trim().slice(0, 80)
            : "Food explorer",
        phone: data.user.phone_confirmed_at ? australianMobile(data.user.phone) : null,
      },
    });
  } catch {
    return authJson(
      { error: "Account services are temporarily unavailable." },
      503,
    );
  }
}
