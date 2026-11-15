import "server-only";
import type { createAuthClient } from "./server";

export async function accountLanding(client: Awaited<ReturnType<typeof createAuthClient>>, userId: string) {
  const profile = await client.from("profiles").select("account_type").eq("id", userId).single();
  return profile.data?.account_type === "partner" ? "/partner/dashboard" : "/";
}
