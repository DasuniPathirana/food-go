import "server-only";
import { authJson, readAuthRequest } from "./auth/http";
import { journeyClient, journeyFailure } from "./journey-server";
import { adventureActionSchema, adventureStateSchema } from "./adventure-contracts";

export async function readAdventure() {
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_adventure").abortSignal(AbortSignal.timeout(10000));
    if (result.error) return journeyFailure(result.error.code);
    const parsed = adventureStateSchema.safeParse(result.data);
    return parsed.success ? authJson(parsed.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
export async function changeAdventure(request: Request) {
  const input = await readAuthRequest(request, adventureActionSchema);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_adventure", { p_action: input.data }).abortSignal(AbortSignal.timeout(10000));
    if (result.error) return journeyFailure(result.error.code);
    const parsed = adventureStateSchema.safeParse(result.data?.state);
    if (!parsed.success) return journeyFailure();
    return authJson({ state: parsed.data,
      ...(typeof result.data.code === "string" && /^[a-f0-9]{32}$/u.test(result.data.code) && { code: result.data.code }),
      ...(typeof result.data.expiresAt === "string" && { expiresAt: result.data.expiresAt }),
    });
  } catch { return journeyFailure(); }
}
