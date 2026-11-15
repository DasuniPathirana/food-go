import "server-only";
import { createAuthClient } from "./auth/server";
import { readAuthConfig, type AuthConfig } from "./auth/config";
import { hasVerifiedIdentity } from "./auth/contracts";
import { operatorActionSchema, operatorError, queueSchema, type OperatorSection } from "./operator";
import { authJson, readAuthRequest } from "./auth/http";

async function operatorSession(config: AuthConfig, writeCookies: boolean) {
  const client = await createAuthClient(config, writeCookies);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !hasVerifiedIdentity(data.user)) return { state: "signed-out" } as const;
  const access = await client.rpc("food_go_operator_access").abortSignal(AbortSignal.timeout(8000));
  if (access.error) return { state: "unavailable" } as const;
  if (access.data === "ready") return { state: "ready", client } as const;
  if (access.data === "mfa") return { state: "mfa" } as const;
  return { state: "forbidden" } as const;
}

export async function operatorQueue(section: OperatorSection, page: number) {
  const config = readAuthConfig(process.env);
  if (!config.configured) return { state: "unconfigured" } as const;
  try {
    const session = await operatorSession(config, false);
    if (session.state !== "ready") return session;
    const { data, error } = await session.client.rpc("food_go_operator_queue", { p_section: section, p_page: page })
      .abortSignal(AbortSignal.timeout(10000));
    if (error?.code === "42501") return { state: "forbidden" } as const;
    const result = queueSchema.safeParse(data);
    if (error || !result.success) return { state: "unavailable" } as const;
    return { state: "ready", queue: result.data } as const;
  } catch { return { state: "unavailable" } as const; }
}

export async function changeOperatorRecord(request: Request) {
  const input = await readAuthRequest(request, operatorActionSchema);
  if (!input.ok) return input.response;
  try {
    const session = await operatorSession(input.config, true);
    if (session.state === "signed-out") return authJson({ error: "Sign in to operate Food Go." }, 401);
    if (session.state === "unavailable") return authJson({ error: "Operator services are unavailable." }, 503);
    if (session.state !== "ready") return authJson({ error: "A verified operator session is required." }, 403);
    const { error, data } = await session.client.rpc("food_go_operator_change", { p_action: input.data }).abortSignal(AbortSignal.timeout(10000));
    if (error || data?.ok !== true) {
      const failure = operatorError(error?.code);
      return authJson({ error: failure.error }, failure.status);
    }
    return authJson({ ok: true });
  } catch { return authJson({ error: "Operator services are unavailable." }, 503); }
}
