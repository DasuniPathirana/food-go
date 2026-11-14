import "server-only";
import { createAuthClient } from "../auth/server";
import { createPartnerHandlers } from "./handlers";
import { hasConfirmedPartnerIdentity, mapPartnerVenue, PartnerProviderError } from "./contracts";

const venueColumns = "id,name,suburb,state,status,created_at,updated_at,ownership_verified_at";
const handlers = createPartnerHandlers({
  env: process.env,
  async getProvider(config) {
    const client = await createAuthClient(config);
    return {
      async getUser() {
        const { data, error } = await client.auth.getUser();
        if (error) {
          if (error.status && error.status >= 500) throw new PartnerProviderError("unavailable");
          return null;
        }
        return data.user ? { id: data.user.id, identityConfirmed: hasConfirmedPartnerIdentity(data.user) } : null;
      },
      async listVenues(userId) {
        const memberships = await client.from("organization_members").select("organization_id").eq("user_id", userId).limit(100);
        if (memberships.error) throw new PartnerProviderError("unavailable");
        const organizationIds = (memberships.data ?? []).map(row => row.organization_id as string);
        if (!organizationIds.length) return [];
        const result = await client.from("venues").select(venueColumns).in("organization_id", organizationIds)
          .order("created_at", { ascending: false }).limit(200);
        if (result.error) throw new PartnerProviderError("unavailable");
        return (result.data ?? []).map(mapPartnerVenue);
      },
      async createDraft(draft, requestId) {
        const { data, error } = await client.rpc("food_go_create_venue_draft", { p_draft: draft, p_idempotency_key: requestId });
        if (error) {
          const codes = { FG001: "duplicate", FG002: "limit", FG003: "idempotency", "42501": "unauthorised", "22023": "invalid", "23514": "invalid" } as const;
          throw new PartnerProviderError(codes[error.code as keyof typeof codes] ?? "unavailable");
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new PartnerProviderError("unavailable");
        return mapPartnerVenue(data as Record<string, unknown>);
      },
    };
  },
});
export const GET = handlers.GET;
export const POST = handlers.POST;
