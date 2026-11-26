import "server-only";
import { createAuthClient } from "./auth/server";
import { authJson, readAuthRequest } from "./auth/http";
import { hasVerifiedIdentity } from "./auth/contracts";
import {
  operatorActionSchema,
  operatorError,
  queueSchema,
  readOperatorConfig,
  sectionSchema,
  type OperatorRow,
  type OperatorSection,
} from "./operator";

export type OperatorQueueState =
  | { status: "ready"; items: OperatorRow[]; hasMore: boolean }
  | { status: "signed_out" | "denied" | "mfa_required" | "unavailable"; items: OperatorRow[]; hasMore: false };

export async function operatorQueue(section: OperatorSection, page = 0): Promise<OperatorQueueState> {
  const empty = (status: Exclude<OperatorQueueState["status"], "ready">): OperatorQueueState => ({
    status,
    items: [],
    hasMore: false,
  });
  const config = readOperatorConfig(process.env);
  if (!config.configured) return empty("unavailable");
  try {
    const client = await createAuthClient(config);
    const { data: authData, error: authErr } = await client.auth.getUser();
    if (authErr || !authData.user || !hasVerifiedIdentity(authData.user)) return empty("signed_out");

    const access = await client.rpc("food_go_operator_access").abortSignal(AbortSignal.timeout(8000));
    if (access.error) return empty("unavailable");
    if (access.data === "mfa") return empty("mfa_required");
    if (access.data !== "ready") return empty("denied");
    if (section === "analytics") return { status: "ready", items: [], hasMore: false };

    const { data, error } = await client
      .rpc("food_go_operator_queue", { p_section: section, p_page: page })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return empty(error.code === "42501" ? "denied" : "unavailable");
    const parsed = queueSchema.safeParse(data);
    if (!parsed.success) return empty("unavailable");
    return { status: "ready", items: parsed.data.items, hasMore: parsed.data.hasMore };
  } catch {
    return empty("unavailable");
  }
}

export async function readOperatorQueue(request: Request) {
  const url = new URL(request.url);
  const sec = sectionSchema.safeParse(url.searchParams.get("section") ?? "venues");
  const page = Math.max(0, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
  if (!sec.success) return authJson({ error: "Unknown operator section." }, 400);
  const res = await operatorQueue(sec.data, page);
  const code = res.status === "ready" ? 200 : res.status === "signed_out" ? 401 : res.status === "denied" || res.status === "mfa_required" ? 403 : 503;
  return authJson(res, code);
}

export async function changeOperatorRecord(request: Request) {
  const input = await readAuthRequest(request, operatorActionSchema, 16384);
  if (!input.ok) return input.response;
  try {
    const client = await createAuthClient(input.config);
    const { data: authData, error: authErr } = await client.auth.getUser();
    if (authErr || !authData.user || !hasVerifiedIdentity(authData.user)) {
      return authJson({ error: "Operator sign-in required." }, 401);
    }
    const { data, error } = await client
      .rpc("food_go_operator_change", { p_action: input.data })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) {
      const mapped = operatorError(error.code ?? "");
      return authJson({ error: mapped.error }, mapped.status);
    }
    return authJson(data ?? { ok: true });
  } catch {
    return authJson({ error: "Operator action failed. Try again shortly." }, 503);
  }
}
