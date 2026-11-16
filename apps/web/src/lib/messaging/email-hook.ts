import { createHash } from "node:crypto";
import { z } from "zod";
import { decodeHookSecret } from "./config";
import { verifySmsHook as verifyAuthHook } from "./signature";

const providerUrl = "https://api.brevo.com/v3/smtp/email";
const maximumBytes = 32768;
const address = z.string().email().max(254);
const hash = z.string().regex(/^[A-Za-z0-9_-]{16,256}$/u);
const actions = z.enum(["signup", "invite", "magiclink", "recovery", "email", "email_change", "reauthentication",
  "password_changed_notification", "email_changed_notification", "phone_changed_notification", "identity_linked_notification",
  "identity_unlinked_notification", "mfa_factor_enrolled_notification", "mfa_factor_unenrolled_notification"]);
const payloadSchema = z.object({
  user: z.object({ email: address, new_email: z.union([address, z.literal("")]).optional() }),
  email_data: z.object({
    email_action_type: actions, token_hash: z.string().max(256).optional(), token_hash_new: z.string().max(256).optional(),
    token: z.string().max(10).optional(), token_new: z.string().max(10).optional(),
    redirect_to: z.string().max(2048).optional(), site_url: z.string().max(2048).optional(),
  }),
});
type EmailConfig = { signingKey: Buffer; apiKey: string; sender: { name: string; email: string }; origin: string; project: string };
type Delivery = { recipient: string; role: string; subject: string; title: string; text: string; url?: string; code?: string };
type Dependencies = { env: Record<string, string | undefined>; fetch?: typeof fetch; now?: () => number };

function errorResponse(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
function success() { return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }); }

export function readEmailHookConfig(env: Record<string, string | undefined>): EmailConfig | null {
  if (env.FOOD_GO_EMAIL_ENABLED !== "true") return null;
  const signingKey = decodeHookSecret(env.SUPABASE_EMAIL_HOOK_SECRET), apiKey = env.BREVO_API_KEY;
  const email = address.safeParse(env.EMAIL_SENDER_ADDRESS), name = env.EMAIL_SENDER_NAME;
  if (!signingKey || !apiKey || !/^[\x21-\x7e]{20,512}$/u.test(apiKey) || !email.success ||
    !name || name.trim() !== name || name.length > 100 || /[\u0000-\u001f\u007f]/u.test(name)) return null;
  try {
    const origin = new URL(env.APP_ORIGIN || ""), project = new URL(env.SUPABASE_URL || "");
    const local = env.NODE_ENV !== "production" && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if (origin.origin !== env.APP_ORIGIN || (origin.protocol !== "https:" && !local) ||
      project.protocol !== "https:" || !/^[a-z0-9]{20}\.supabase\.co$/u.test(project.hostname) || project.port ||
      project.username || project.password || project.search || project.hash || project.pathname !== "/") return null;
    return { signingKey, apiKey, sender: { name, email: email.data }, origin: origin.origin, project: project.origin };
  } catch { return null; }
}

class BodyError extends Error { constructor(public status: number) { super("Request could not be read."); } }
async function boundedText(body: ReadableStream<Uint8Array> | null, timeoutMs: number) {
  if (!body) throw new BodyError(400);
  const reader = body.getReader(), chunks: Uint8Array[] = [];
  let length = 0, timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, timeoutMs);
  try {
    while (true) {
      const next = await reader.read();
      if (timedOut) throw new BodyError(408);
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maximumBytes) { void reader.cancel().catch(() => {}); throw new BodyError(413); }
      chunks.push(next.value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, length));
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

function redirectTarget(source: string | undefined, action: string, config: EmailConfig): string | null {
  const next = action === "recovery" ? "/auth/reset-password" : "/profile";
  const target = new URL("/auth/callback?next=" + next, config.origin);
  if (!source) return target.href;
  try {
    const input = new URL(source);
    // Supabase adds its PKCE code after verification. The supplied destination
    // must be one of this application's exact confirmation/recovery callbacks.
    return input.origin === config.origin && !input.username && !input.password && !input.hash &&
      input.pathname === "/auth/callback" && [...input.searchParams.keys()].length === 1 &&
      input.searchParams.get("next") === next ? input.href : null;
  } catch { return null; }
}
function verificationUrl(token: string | undefined, action: string, redirect: string, config: EmailConfig) {
  const parsed = hash.safeParse(token);
  if (!parsed.success) return null;
  const url = new URL("/auth/v1/verify", config.project);
  url.search = new URLSearchParams({ token: parsed.data, type: action, redirect_to: redirect }).toString();
  return url.href;
}
function deliveries(value: unknown, config: EmailConfig): Delivery[] | null {
  const parsed = payloadSchema.safeParse(value);
  if (!parsed.success) return null;
  const { user, email_data: data } = parsed.data, action = data.email_action_type;
  if (data.site_url) {
    try { const site = new URL(data.site_url); if (site.origin !== config.origin || site.pathname !== "/" || site.search || site.hash || site.username || site.password) return null; }
    catch { return null; }
  }
  const notification: Record<string, string> = {
    password_changed_notification: "Your Food Go password was changed.", email_changed_notification: "Your Food Go email address was changed.",
    phone_changed_notification: "Your Food Go phone number was changed.", identity_linked_notification: "A sign-in method was added to your Food Go account.",
    identity_unlinked_notification: "A sign-in method was removed from your Food Go account.", mfa_factor_enrolled_notification: "An authenticator was added to your Food Go account.",
    mfa_factor_unenrolled_notification: "An authenticator was removed from your Food Go account.",
  };
  if (action in notification) return [{ recipient: user.email, role: "notification", subject: "Food Go account security", title: "Account security update", text: notification[action] + " If you did not make this change, contact Food Go support immediately." }];
  if (action === "reauthentication") {
    if (!/^\d{6,10}$/u.test(data.token || "")) return null;
    return [{ recipient: user.email, role: "reauthentication", subject: "Your Food Go verification code", title: "Verify your identity", text: "Use this code only for the Food Go action you requested. Do not share it.", code: data.token }];
  }
  const redirect = redirectTarget(data.redirect_to, action, config);
  if (!redirect) return null;
  if (action === "email_change") {
    if (!user.new_email) return null;
    const nextUrl = verificationUrl(data.token_hash, action, redirect, config);
    if (!nextUrl) return null;
    const result: Delivery[] = [{ recipient: user.new_email, role: "new-email", subject: "Confirm your new Food Go email", title: "Confirm your new email address", text: "Confirm this address for your Food Go account.", url: nextUrl }];
    if (data.token_hash_new) {
      const currentUrl = verificationUrl(data.token_hash_new, action, redirect, config);
      if (!currentUrl) return null;
      result.unshift({ recipient: user.email, role: "current-email", subject: "Confirm your Food Go email change", title: "Confirm your email change", text: "Confirm the email change requested for your Food Go account.", url: currentUrl });
    }
    return result;
  }
  const url = verificationUrl(data.token_hash, action, redirect, config);
  if (!url) return null;
  const reset = action === "recovery", signup = action === "signup" || action === "email";
  return [{ recipient: user.email, role: action, subject: reset ? "Reset your Food Go password" : signup ? "Confirm your Food Go email" : "Your Food Go sign-in link",
    title: reset ? "Choose a new password" : signup ? "Welcome to Food Go" : "Continue to Food Go",
    text: reset ? "Use the link below to reset your password in the browser where you requested it." : "Use the link below in the browser where you started to confirm your account and continue to Food Go.", url }];
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/gu, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
function idempotencyKey(event: string) {
  const bytes = createHash("sha256").update(`food-go-email:${event}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Signed Supabase hooks only. Tests inject fetch and never send actual mail. */
export async function handleEmailHook(request: Request, dependencies: Dependencies) {
  const config = readEmailHookConfig(dependencies.env);
  if (!config) return errorResponse(503, "Email delivery is not connected.");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return errorResponse(415, "A JSON request is required.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > maximumBytes) return errorResponse(413, "This request is too large.");
  let body: string;
  try { body = await boundedText(request.body, 1000); }
  catch (error) { return errorResponse(error instanceof BodyError ? error.status : 400, "This request could not be read."); }
  const event = verifyAuthHook(body, request.headers, config.signingKey, dependencies.now?.());
  if (!event) return errorResponse(401, "The webhook signature could not be verified.");
  let messages: Delivery[] | null;
  try { messages = deliveries(JSON.parse(body), config); } catch { messages = null; }
  if (!messages) return errorResponse(400, "The email request is not supported.");
  const versions = messages.map(message => {
    const detail = message.url || message.code || "";
    const textContent = `${message.title}\n\n${message.text}${detail ? "\n\n" + detail : ""}\n\nIf you did not request this, do not share any code or link. Contact Food Go support if you need help.`;
    const htmlContent = `<!doctype html><html lang="en"><body><main><h1>${escapeHtml(message.title)}</h1><p>${escapeHtml(message.text)}</p>${message.url ? `<p><a href="${escapeHtml(message.url)}">Continue securely</a></p>` : message.code ? `<p><strong>${escapeHtml(message.code)}</strong></p>` : ""}<p>If you did not request this, do not share any code or link. Contact Food Go support if you need help.</p></main></body></html>`;
    return { to: [{ email: message.recipient }], subject: message.subject, textContent, htmlContent };
  });
  try {
    // One batch also keeps secure email-change delivery within one transport
    // deadline. The signed event ID produces the same UUID on every retry.
    const result = await (dependencies.fetch ?? fetch)(providerUrl, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(2500),
      headers: { "Content-Type": "application/json", Accept: "application/json", "api-key": config.apiKey },
      body: JSON.stringify({ sender: config.sender, subject: versions[0].subject, htmlContent: versions[0].htmlContent,
        textContent: versions[0].textContent, messageVersions: versions, headers: { idempotencyKey: idempotencyKey(event) } }),
    });
    const response: unknown = JSON.parse(await boundedText(result.body, 500));
    const duplicate = result.status === 400 && response && typeof response === "object" &&
      "code" in response && response.code === "duplicate_parameter" && "message" in response &&
      typeof response.message === "string" && /idempotency/iu.test(response.message);
    if (duplicate) return success();
    const accepted = z.object({ messageId: z.string().min(1).max(512).optional(), messageIds: z.array(z.string().min(1).max(512)).max(2).optional() }).safeParse(response);
    if (result.status !== 201 || !accepted.success ||
      !(accepted.data.messageIds?.length === versions.length || (versions.length === 1 && accepted.data.messageId)))
      return errorResponse(503, "Email delivery is temporarily unavailable.");
  } catch { return errorResponse(503, "Email delivery is temporarily unavailable."); }
  return success();
}
