import { z } from "zod";

export const COMMUNITY_POLICY_VERSION = "food-go-community-2026-11-15";
export const communityPolicyStatusSchema = z.object({
  version: z.literal(COMMUNITY_POLICY_VERSION),
  acceptedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const communityPolicyAcceptSchema = z.strictObject({
  version: z.literal(COMMUNITY_POLICY_VERSION),
  accepted: z.literal(true),
});
export type CommunityPolicyStatus = z.infer<typeof communityPolicyStatusSchema>;
export type CommunityPolicyAcceptance = z.infer<typeof communityPolicyAcceptSchema>;
