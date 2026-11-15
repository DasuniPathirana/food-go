import { readAuthRequest, authJson } from "@/lib/auth/http";
import { createAuthClient } from "@/lib/auth/server";
import { hasVerifiedIdentity } from "@/lib/auth/contracts";
import { operatorFactors, operatorMfaRequest, mayVerifyOperatorFactor } from "@/lib/auth/operator-mfa";

export async function POST(request: Request) {
  const input = await readAuthRequest(request, operatorMfaRequest);
  if (!input.ok) return input.response;
  const unavailable = () => authJson({ error: "Authenticator services are temporarily unavailable." }, 503);
  try {
    const client = await createAuthClient(input.config);
    const identity = await client.auth.getUser();
    if (identity.error || !identity.data.user || !hasVerifiedIdentity(identity.data.user))
      return authJson({ error: "Sign in to your verified account." }, 401);
    const access = await client.rpc("food_go_operator_access");
    if (access.error) return unavailable();
    if (access.data === "ready") return authJson({ verified: true });
    if (access.data !== "mfa") return authJson({ error: "Operator access is required." }, 403);
    const mfa = client.auth.mfa;
    const factors = identity.data.user.factors ?? [];
    if (input.data.action === "enrol") {
      if (!operatorFactors(factors).canEnrol)
        return authJson({ error: "Use your existing authenticator." }, 409);
      const result = await mfa.enroll({ factorType: "totp", issuer: "Food Go" });
      if (result.error) return result.error.status === 429
        ? authJson({ error: "Please wait before adding an authenticator again." }, 429) : unavailable();
      return authJson({ factorId: result.data.id, qr: result.data.totp.qr_code, secret: result.data.totp.secret });
    }
    if (!mayVerifyOperatorFactor(factors, input.data.factorId))
      return authJson({ error: "Choose an authenticator on this account." }, 400);
    const result = await mfa.challengeAndVerify({ factorId: input.data.factorId, code: input.data.code });
    if (result.error) {
      if (result.error.status === 429) return authJson({ error: "Too many attempts. Wait before trying again." }, 429);
      if ((result.error.status ?? 500) >= 500) return unavailable();
      return authJson({ error: "Check the current six-digit code in your authenticator." }, 400);
    }
    const verified = await client.rpc("food_go_operator_access");
    if (verified.error) return unavailable();
    return verified.data === "ready" ? authJson({ verified: true }) : authJson({ error: "Operator access is required." }, 403);
  } catch { return unavailable(); }
}
