import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient, getAuthState } from "@/lib/auth/server";
import { readAuthConfig } from "@/lib/auth/config";
import { operatorFactors } from "@/lib/auth/operator-mfa";
import { OperatorAuthenticator } from "@/components/operator-authenticator";

export const metadata = { title: "Operator security", robots: { index: false, follow: false } };

export default async function OperatorSecurity() {
  const config = readAuthConfig(process.env);
  if (!config.configured || !(await getAuthState()).user) redirect("/auth/sign-in?next=/admin");
  const client = await createAuthClient(config, false);
  const access = await client.rpc("food_go_operator_access");
  if (access.data === "ready") redirect("/admin");
  if (!access.error && access.data !== "mfa") redirect("/admin");
  const factors = !access.error && await client.auth.mfa.listFactors();
  if (!factors || factors.error) return <section className="auth-card"><h1>Authenticator unavailable</h1>
    <p>Please try again shortly.</p><Link href="/admin">Back to admin</Link></section>;
  return <OperatorAuthenticator {...operatorFactors(factors.data.all)} />;
}
