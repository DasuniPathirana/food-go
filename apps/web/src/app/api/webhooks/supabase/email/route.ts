import "server-only";
import { handleEmailHook } from "@/lib/messaging/email-hook";

export const runtime = "nodejs";

// Supabase authenticates this server hook with its signed raw-body headers.
export async function POST(request: Request) {
  return handleEmailHook(request, { env: process.env });
}
