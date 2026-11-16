# Missing verification email: current repair

17 November 2026, Food go project `azccigsctzhbaxoajqst`.

The reported registration was rejected by Supabase with `signup_disabled` (HTTP 422). Aggregate checks found no created account. The previous application treated that rejection as a neutral success and displayed **Check your inbox**. That was an application error; it was not evidence of a sent or lost email.

Registration and recovery now classify provider failures explicitly. Disabled signup, disabled email, rejected sender, hook failures and unknown provider errors return an unavailable response. Expected existing-account cases keep a neutral response to protect account privacy. The actual registration handler has a regression test for the reported error and for private birth-date forwarding.

## Required dashboard actions

The connected database tool cannot update hosted Auth configuration, and the available browser-control runtime could not open. These settings have **not** been changed automatically.

1. Deploy the reviewed PR to the intended HTTPS site. In [Food go Authentication settings](https://supabase.com/dashboard/project/azccigsctzhbaxoajqst/auth/providers), enable **Allow new users to sign up** and the **Email** provider. Keep email confirmation required.
2. In [Authentication Hooks](https://supabase.com/dashboard/project/azccigsctzhbaxoajqst/auth/hooks), configure **Send Email**, HTTP, at `https://food-go-three.vercel.app/api/webhooks/supabase/email`. Supabase cannot call a webhook on this computer's `127.0.0.1`.
3. Generate the hook signing secret and save it privately as `SUPABASE_EMAIL_HOOK_SECRET` in the website's server environment. The supplied `BREVO_API_KEY`, `EMAIL_SENDER_NAME` and `EMAIL_SENDER_ADDRESS` are already in the private developer environment file. The signing secret is a separate value; it is not the Brevo key. Set `FOOD_GO_EMAIL_ENABLED=true` on the configured controlled test deployment and redeploy.
4. Set the exact Site URL and callback allowlist described in [setup now](setup-now.md). For local acceptance, add only the intended loopback callback URLs separately. Complete the documented account gates in the controlled environment.
5. Register again with the intended inbox and a date of birth, receive and open the confirmation link in the same browser, then sign in. The rejected request created no account to recover. Verify recovery and expired/reused links before opening public registration.

Do not disable confirmation, create a shared password, embed mail credentials in browser code or mark a rejected request as sent to conceal this configuration issue. No real email or SMS was sent during the diagnosis. Provider API credential checks remain separate from real inbox delivery.

Supabase documents that an enabled Email provider plus an enabled [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) delegates mail delivery to the hook instead of SMTP. This implementation therefore does not need a Brevo SMTP password.
