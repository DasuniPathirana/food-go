# Provision a Food Go operator

The operator signs in at `/auth/sign-in?next=/admin` with their own verified Supabase account and an authenticator app. The deployer supplies the HTTPS site address to the designated owner. Food Go has no shared administrator password. Passwords, authenticator secrets and recovery links belong with the account holder.

## Prepare the intended environment

1. Confirm the project reference with the owner and apply the repository migrations in order to that environment. The operator migration ends in `food_go_operator_promotions.sql`. The locally disposable CI database is a separate target.
2. Configure the web application's exact `APP_ORIGIN`, Supabase URL, publishable key and server cookie secret. Complete the existing production Auth checks before opening the account gates. Enable authenticator-app enrolment and verification in Supabase Auth MFA settings. Configure email delivery, sign-up confirmation and recovery using the [environment manifest](environment.md).
3. Have the designated operator create and confirm their account through the deployed sign-up and email-confirmation flow. For an existing account, have them sign in and confirm that they control the intended mailbox. In Authentication → Users, identify that **confirmed account** by both its email and its user UUID. The operator sets their password directly. Do not use an email address or editable profile name as a database permission.
4. A database owner runs the following SQL in the intended project's SQL Editor. Replace both placeholders with the checked values. Require exactly one returned UUID. Zero rows means the identity, confirmation, or grant conditions need review. Keep email addresses and UUID assignments in private operational records.

```sql
insert into private.food_go_operators (user_id)
select id
from auth.users
where id = '<operator user UUID>'::uuid
  and lower(email) = lower('<confirmed operator email>')
  and email_confirmed_at is not null
  and not coalesce(is_anonymous, false)
  and (banned_until is null or banned_until <= now())
on conflict (user_id) do nothing
returning user_id;
```

5. The operator signs in and opens `/admin`, follows **Open authenticator**, registers the authenticator and enters its current code. Returning operators enter the authenticator challenge when their session needs it. Verify that the six operations sections open. Sign out, open a new private browser window and confirm that unauthenticated visitors cannot see any queue. An ordinary signed-in restaurant partner must also be denied.

## Daily operations

- **Restaurants.** Open ownership and location to see the applicant's organisation and supplied business contact. Validate the ownership claim against independent evidence and add its reference as a decision note. Verification and publication are separate decisions. Set the geographic coordinates from a checked location. Suspending the listing hides its active promotions. Revoking ownership also suspends the listing. An applicant's own organisation requires another independent operator.
- **Promotions.** Under a published, verified restaurant choose **Create promotion**. Enter a title, offer details and the schedule in the device's local time. Publish the draft under **Promotions**. Scheduled offers enter the public storefront when their start time arrives and expire automatically at their end time. Edits return an offer to draft. **Withdraw promotion** removes it immediately.
- **Posts and comments.** Review public submissions, approve them or remove them. Private wall content is excluded. Operators need another reviewer for their own content.
- **Reports.** Read the reported post and reason counts. Dismiss the current reports or remove the public post and resolve them. Later reports can bring the post back for review if it remains public.
- **Decision history.** Review the actor, target UUID, action, date and supplied reason. Authenticated operators cannot edit this history or grant roles through the portal. Keep personal evidence documents and secrets out of decision notes.

To revoke access, the database owner removes the designated operator's role. Subsequent queue reads and writes check this table and the live Auth session. If the operator has lost an authenticator, remove access first and follow the provider's account recovery process before issuing a new grant.

```sql
delete from private.food_go_operators
where user_id = '<operator user UUID>'::uuid
returning user_id;
```
