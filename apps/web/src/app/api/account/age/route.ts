import { authJson, readAuthRequest } from "@/lib/auth/http";
import { journeyClient, journeyFailure } from "@/lib/journey-server";
import { ageStatusSchema, recordBirthDateSchema } from "@/lib/age-contracts";

export async function POST(request: Request) {
  const input = await readAuthRequest(request, recordBirthDateSchema);
  if (!input.ok) return input.response;
  try {
    const session = await journeyClient();
    if (session.response) return session.response;
    const result = await session.client.rpc("food_go_record_birth_date", { p_birth_date: input.data.birthDate }).abortSignal(AbortSignal.timeout(8000));
    if (result.error) return journeyFailure(result.error.code);
    const parsed = ageStatusSchema.safeParse(result.data);
    return parsed.success ? authJson(parsed.data) : journeyFailure();
  } catch { return journeyFailure(); }
}
