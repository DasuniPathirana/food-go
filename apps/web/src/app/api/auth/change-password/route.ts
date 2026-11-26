import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { createAuthClient } from "@/lib/auth/server";
import { hasVerifiedIdentity } from "@/lib/auth/contracts";

const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(12, "Use at least 12 characters for your new password.").max(128),
});

export async function POST(request: Request) {
  const input = await readAuthRequest(request, changePasswordSchema);
  if (!input.ok) return input.response;
  try {
    const client = await createAuthClient(input.config);
    const { data: userRes, error: userErr } = await client.auth.getUser();
    if (userErr || !userRes.user || !hasVerifiedIdentity(userRes.user)) {
      return authJson({ error: "Sign in with a verified account to change your password." }, 401);
    }

    if (userRes.user.email && input.data.currentPassword) {
      const check = await client.auth.signInWithPassword({
        email: userRes.user.email,
        password: input.data.currentPassword,
      });
      if (check.error) {
        return authJson({ error: "Your current password did not match." }, 400);
      }
    }

    const { error } = await client.auth.updateUser({ password: input.data.newPassword });
    if (error) {
      return authJson({ error: error.message || "Password could not be updated." }, 400);
    }
    return authJson({ ok: true, message: "Password updated for future sign-ins." });
  } catch {
    return authJson({ error: "Unable to update your password right now." }, 503);
  }
}
