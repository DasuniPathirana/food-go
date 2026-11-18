import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";
import { geographicDiscoveryActionSchema, geographicDiscoverySchema } from "@/lib/geographic-discovery";

function unavailable() {
  return authJson({ error: "Saving exploration is not enabled yet. You can use a session preview." }, 503);
}
async function execute(action: unknown = { action: "read" }) {
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_geographic_exploration", { p_action: action })
      .abortSignal(AbortSignal.timeout(10000));
    if (result.error) return journeyFailure(result.error.code);
    const state = geographicDiscoverySchema.safeParse(result.data);
    return state.success ? authJson(state.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
export async function GET() {
  if (process.env.FOOD_GO_EXPLORATION_ENABLED !== "true") return unavailable();
  return execute();
}
export async function POST(request: Request) {
  if (process.env.FOOD_GO_EXPLORATION_ENABLED !== "true") return unavailable();
  const input = await readAuthRequest(request, geographicDiscoveryActionSchema);
  return input.ok ? execute(input.data) : input.response;
}
