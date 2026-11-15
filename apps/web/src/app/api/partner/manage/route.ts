import QRCode from "qrcode";
import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";
import { partnerAction, workspaceSchema } from "@/lib/journey";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = z.uuid().safeParse(params.get("venueId"));
  if (!id.success || [...params.keys()].length !== 1) return authJson({ error: "Choose a restaurant." }, 400);
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_partner_workspace", { p_action: { action: "read", venueId: id.data } }).abortSignal(AbortSignal.timeout(10000));
    if (result.error) return journeyFailure(result.error.code);
    const parsed = workspaceSchema.safeParse(result.data);
    return parsed.success ? authJson(parsed.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
export async function POST(request: Request) {
  const input = await readAuthRequest(request, partnerAction);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_partner_workspace", { p_action: input.data }).abortSignal(AbortSignal.timeout(10000));
    if (result.error) return journeyFailure(result.error.code);
    if (input.data.action === "issue") {
      const code = z.string().regex(/^[a-f0-9]{32}$/u).safeParse(result.data?.code);
      if (!code.success) return journeyFailure();
      const claimUrl = input.config.origin + "/collect#code=" + code.data;
      return authJson({ ...result.data, claimUrl, qr: await QRCode.toDataURL(claimUrl, { width: 280, margin: 2 }) });
    }
    const parsed = workspaceSchema.safeParse(result.data);
    return parsed.success ? authJson(parsed.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
