export type SmsConfig = {
  signingKey: Buffer;
  username: string;
  password: string;
  sender: string;
};

/** Accept the Supabase dashboard format and the Standard Webhooks format. */
export function decodeHookSecret(value: string | undefined): Buffer | null {
  const encoded = value?.replace(/^v1,whsec_|^whsec_/u, "");
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return null;
  const key = Buffer.from(encoded, "base64");
  if (
    key.length < 32 ||
    key.length > 64 ||
    key.toString("base64").replace(/=+$/u, "") !== encoded.replace(/=+$/u, "")
  )
    return null;
  return key;
}

/** The server route supplies its environment. Nothing reads browser variables. */
export function readSmsConfig(
  env: Record<string, string | undefined>,
): SmsConfig | null {
  if (env.FOOD_GO_SMS_ENABLED !== "true") return null;
  const signingKey = decodeHookSecret(env.SUPABASE_SMS_HOOK_SECRET);
  const username = env.MOBILE_MESSAGE_API_USERNAME;
  const password = env.MOBILE_MESSAGE_API_PASSWORD;
  const sender = env.MOBILE_MESSAGE_SENDER_ID;
  if (
    !signingKey ||
    !username ||
    !password ||
    !sender ||
    username.length > 512 ||
    password.length > 512 ||
    /[:\r\n]/u.test(username) ||
    /[\r\n]/u.test(password) ||
    sender.length > 32 ||
    sender.trim() !== sender ||
    !/^[\x20-\x7e]+$/u.test(sender)
  )
    return null;
  return { signingKey, username, password, sender };
}
