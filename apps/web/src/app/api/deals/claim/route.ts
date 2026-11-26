import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";

const dealActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("list") }),
  z.strictObject({ action: z.literal("claim"), promotionId: z.uuid() }),
]);

export async function GET() {
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_claim_promotion", { p_action: { action: "list" } })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}

export async function POST(request: Request) {
  const input = await readAuthRequest(request, dealActionSchema);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_claim_promotion", { p_action: input.data })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data, input.data.action === "claim" ? 201 : 200);
  } catch {
    return journeyFailure();
  }
}
