import { z } from "zod";
import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";

const updateProfileSchema = z
  .strictObject({
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: z.string().trim().max(300).optional(),
    avatarId: z.enum(["explorer", "foodie", "trailblazer", "anime-sky", "anime-violet"]).optional(),
    avatarIdleMotion: z.boolean().optional(),
  })
  .refine(value => Object.keys(value).length > 0, "Choose at least one profile setting to update.");

export async function POST(request: Request) {
  const input = await readAuthRequest(request, updateProfileSchema);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const { data, error } = await session.client
      .rpc("food_go_update_profile", { p_action: input.data })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) return journeyFailure(error.code);
    return authJson(data);
  } catch {
    return journeyFailure();
  }
}
