import { requestPhoneCode } from "@/lib/auth/actions";

export async function POST(request: Request) {
  return requestPhoneCode(request);
}
