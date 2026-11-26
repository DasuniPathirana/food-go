import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";

const customerReservationSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("list") }),
  z.strictObject({
    action: z.literal("create"),
    venueId: z.uuid(),
    reservedFor: z.iso.datetime({ offset: true }),
    partySize: z.number().int().min(1).max(20),
    guestName: z.string().trim().min(2).max(80),
    guestContact: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(300).optional(),
  }),
  z.strictObject({
    action: z.literal("cancel"),
    reservationId: z.uuid(),
  }),
]);

export async function GET() {
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_customer_reservations", { p_action: { action: "list" } })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}

export async function POST(request: Request) {
  const input = await readAuthRequest(request, customerReservationSchema);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_customer_reservations", { p_action: input.data })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) {
      if (["22023", "FG404", "FG409", "FG429", "42501"].includes(error.code ?? "")) {
        return authJson(
          { error: error.message },
          error.code === "42501" ? 403 : error.code === "FG404" ? 404 : error.code === "FG429" ? 429 : error.code === "22023" ? 400 : 409
        );
      }
      return journeyFailure(error.code);
    }
    return authJson(data, input.data.action === "create" ? 201 : 200);
  } catch {
    return journeyFailure();
  }
}
