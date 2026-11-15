import "server-only";
import { createAuthClient } from "./auth/server";
import { hasVerifiedIdentity } from "./auth/contracts";
import { readAuthConfig } from "./auth/config";
import { authJson } from "./auth/http";

export async function journeyClient() {
  const config = readAuthConfig(process.env);
  if (!config.configured) return { response: authJson({ error: "Account services are unavailable. Please try again shortly." }, 503) };
  const client = await createAuthClient(config);
  const identity = await client.auth.getUser();
  if (identity.error || !identity.data.user || !hasVerifiedIdentity(identity.data.user))
    return { response: authJson({ error: "Sign in with a verified account to continue." }, 401) };
  return { client, config };
}
export function journeyFailure(code?: string) {
  const status = code === "42501" ? 403 : code === "FG404" ? 404 : code === "FG409" || code === "23505" ? 409 : code === "FG429" ? 429 :
    ["22023","22P02","22007","22008","23514","23502"].includes(code ?? "") ? 400 : 503;
  const message = status === 403 ? "This account cannot perform that action." : status === 404 ? "The item or verification code is unavailable or expired." :
    status === 409 ? "This record has changed. Reload it and review its current status." : status === 429 ? "The activity limit has been reached. Please try again later." :
    status === 400 ? "Check the details you entered." : "The service is temporarily unavailable.";
  return authJson({ error: message }, status);
}
