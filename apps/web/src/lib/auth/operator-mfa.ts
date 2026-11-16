import { z } from "zod";

export const operatorMfaRequest = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("enrol") }),
  z.strictObject({ action: z.literal("verify"), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/u) }),
]);

type Factor = { id: string; status: string; factor_type: string; friendly_name?: string };

export function operatorFactors(factors: readonly Factor[]) {
  const verified = factors.filter(factor => factor.status === "verified");
  const authenticators = verified.filter(factor => factor.factor_type === "totp")
    .map((factor, index) => ({ id: factor.id, name: factor.friendly_name || `Authenticator ${index + 1}` }));
  return { canEnrol: verified.length === 0, authenticators };
}

export function mayVerifyOperatorFactor(factors: readonly Factor[], id: string) {
  const factor = factors.find(item => item.id === id && item.factor_type === "totp");
  return !!factor && (factor.status === "verified" || (factor.status === "unverified" && operatorFactors(factors).canEnrol));
}
