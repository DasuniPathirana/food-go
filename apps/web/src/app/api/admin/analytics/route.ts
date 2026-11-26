import { readOperatorConfig } from "@/lib/operator";
import { createAuthClient } from "@/lib/auth/server";
import { authJson } from "@/lib/auth/http";

export async function GET() {
  const config = readOperatorConfig(process.env);
  if (!config.configured) return authJson({ error: "Operator portal unavailable." }, 503);
  try {
    const client = await createAuthClient(config);
    const { data, error } = await client.rpc("food_go_operator_analytics").abortSignal(AbortSignal.timeout(10000));
    if (error) {
      return authJson(
        { error: error.code === "42501" ? "Operator authenticator verification required." : "Analytics temporarily unavailable." },
        error.code === "42501" ? 403 : 503
      );
    }
    return authJson(data);
  } catch {
    return authJson({ error: "Analytics temporarily unavailable." }, 503);
  }
}
