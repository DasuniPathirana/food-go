# Missing verification email: current repair

17 November 2026, Food go project `azccigsctzhbaxoajqst`.

The reported registration was rejected by Supabase with `signup_disabled` (HTTP 422). Aggregate checks found no created account. The previous application treated that rejection as a neutral success and displayed **Check your inbox**. That was an application error; it was not evidence of a sent or lost email.

The owner has now enabled new-user signup. A fresh read-only provider settings request verified `disable_signup=false`, Email enabled and email confirmation required. The deployed website still returns `503` with `configured:false` from its account session API. Enabling the Supabase switch alone does not configure the website's production Auth environment or its signed email transport. No real inbox delivery has been verified.

Registration and recovery now classify provider failures explicitly. Disabled signup, disabled email, rejected sender, hook failures and unknown provider errors return an unavailable response. Expected existing-account cases keep a neutral response to protect account privacy. The actual registration handler has a regression test for the reported error and for private birth-date forwarding.

## Required dashboard actions

The connected database tool cannot update hosted Auth configuration, and the available browser-control runtime could not open. The owner changed the signup switch; the remaining hook and hosting settings still require the deployer.

1. Deploy the reviewed safe PR to the intended HTTPS site. In [Food go Authentication settings](https://supabase.com/dashboard/project/azccigsctzhbaxoajqst/auth/providers), retain **Allow new users to sign up**, the **Email** provider and required email confirmation. Complete the controlled Auth environment and production acceptance gate described in [setup now](setup-now.md); the currently deployed account API is not configured.
2. In [Authentication Hooks](https://supabase.com/dashboard/project/azccigsctzhbaxoajqst/auth/hooks), configure **Send Email**, HTTP, at `https://food-go-three.vercel.app/api/webhooks/supabase/email`. Supabase cannot call a webhook on this computer's `127.0.0.1`.
3. Generate the hook signing secret and save it privately as `SUPABASE_EMAIL_HOOK_SECRET` in the website's server environment. The supplied `BREVO_API_KEY`, `EMAIL_SENDER_NAME` and `EMAIL_SENDER_ADDRESS` are already in the private developer environment file. The signing secret is a separate value; it is not the Brevo key. Set `FOOD_GO_EMAIL_ENABLED=true` on the configured controlled test deployment and redeploy.
4. Set the exact Site URL and callback allowlist described in [setup now](setup-now.md). Test registration on that public HTTPS website. The email hook intentionally checks `site_url` and `redirect_to` against its exact configured `APP_ORIGIN`: adding a loopback callback to Supabase alone does not make a production-origin hook accept it. Local acceptance needs a deliberately configured matching public development hook, or use the configured public website for the complete email journey. Complete the documented account gates in the controlled environment.
5. Register again with the intended inbox and a date of birth, receive and open the confirmation link in the same browser, then sign in. The rejected request created no account to recover. Verify recovery and expired/reused links before opening public registration.

Do not disable confirmation, create a shared password, embed mail credentials in browser code or mark a rejected request as sent to conceal this configuration issue. No real email or SMS was sent during the diagnosis. Provider API credential checks remain separate from real inbox delivery.

Supabase documents that an enabled Email provider plus an enabled [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) delegates mail delivery to the hook instead of SMTP. This implementation therefore does not need a Brevo SMTP password.
