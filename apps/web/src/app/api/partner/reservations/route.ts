import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";

const partnerReservationSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("list"), venueId: z.uuid() }),
  z.strictObject({
    action: z.literal("decide"),
    venueId: z.uuid(),
    reservationId: z.uuid(),
    status: z.enum(["approved", "declined", "completed"]),
    decisionNote: z.string().trim().max(240).optional(),
  }),
  z.strictObject({
    action: z.literal("settings"),
    venueId: z.uuid(),
    reservationsEnabled: z.boolean(),
    reservationNotes: z.string().trim().max(300).optional(),
  }),
]);

export async function GET(request: Request) {
  const venueId = new URL(request.url).searchParams.get("venueId");
  if (!venueId || !z.uuid().safeParse(venueId).success) {
    return authJson({ error: "Select a valid venue." }, 400);
  }
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_partner_reservations", { p_action: { action: "list", venueId } })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}

export async function POST(request: Request) {
  const input = await readAuthRequest(request, partnerReservationSchema);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_partner_reservations", { p_action: input.data })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}
