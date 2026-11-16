import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";
import { customerAction, journeySchema } from "@/lib/journey";

export async function GET() {
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_customer_journey").abortSignal(AbortSignal.timeout(10000));
    if (result.error) return journeyFailure(result.error.code);
    const parsed = journeySchema.safeParse(result.data);
    return parsed.success ? authJson(parsed.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
export async function POST(request: Request) {
  const input = await readAuthRequest(request, customerAction);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_customer_journey", { p_action: input.data }).abortSignal(AbortSignal.timeout(10000));
    return result.error ? journeyFailure(result.error.code) : authJson(result.data);
  } catch { return journeyFailure(); }
}
