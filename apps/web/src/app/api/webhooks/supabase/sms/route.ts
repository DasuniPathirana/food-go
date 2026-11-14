import "server-only";
import { handleSmsHook } from "@/lib/messaging/sms-hook";

export const runtime = "nodejs";

// This is a provider-to-server webhook. Its signature authenticates the raw body;
// browser origin checks would reject legitimate Supabase hook delivery.
export async function POST(request: Request) {
  return handleSmsHook(request, { env: process.env });
}
