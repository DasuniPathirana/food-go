import type { Metadata, Viewport } from "next";
import { SiteShell } from "@/components/site-shell";
import { getAuthState } from "@/lib/auth/server";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "Food Go | Your neighbourhood food guide",
    template: "%s | Food Go",
  },
  description:
    "Discover local flavours, explore neighbourhood food trails and find your next favourite across Australia. Food Go foundation preview.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#244b3e",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await getAuthState();
  return (
    <html lang="en-AU">
      <body>
        <SiteShell
          signedIn={Boolean(account.user)}
          displayName={account.user?.displayName}
        >
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
