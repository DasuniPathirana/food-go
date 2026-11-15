import "server-only";
import { createAuthClient } from "./auth/server";
import { hasVerifiedIdentity } from "./auth/contracts";
import { CommunityPolicyError, createCommunityPolicyHandlers } from "./community-policy-handlers";

const handlers = createCommunityPolicyHandlers({
  env: process.env,
  async getProvider(config, signal) {
    const client = await createAuthClient(config);
    function failure(code: string) {
      return new CommunityPolicyError(code === "42501" ? "identity" : code === "22023" ? "stale" : "unavailable");
    }
    return {
      async getUser() {
        const { data, error } = await client.auth.getUser();
        return !error && data.user && hasVerifiedIdentity(data.user) ? { identityConfirmed: true } : null;
      },
      async status() {
        const { data, error } = await client.rpc("food_go_community_policy_status").abortSignal(signal);
        if (error) throw failure(error.code);
        return data;
      },
      async accept(input) {
        const { data, error } = await client.rpc("food_go_accept_community_policy", {
          p_version: input.version, p_accepted: input.accepted,
        }).abortSignal(signal);
        if (error) throw failure(error.code);
        return data;
      },
    };
  },
});
export const GET = handlers.GET;
export const POST = handlers.POST;
