import { verifyPhoneCode } from "@/lib/auth/actions";

export async function POST(request: Request) {
  return verifyPhoneCode(request);
}
