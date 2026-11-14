import type { Metadata, Viewport } from "next";
import { SiteShell } from "@/components/site-shell";
import { getAuthState } from "@/lib/auth/server";
import { getCatalogueMode } from "@/lib/catalogue-server";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "Food Go | Your neighbourhood food guide",
    template: "%s | Food Go",
  },
  description:
    "Discover local flavours, share food stories and explore neighbourhood food trails across Australia. Food Go development preview.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffefa",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await getAuthState();
  return (
    <html lang="en-AU" data-scroll-behavior="smooth">
      <body>
        <SiteShell
          signedIn={Boolean(account.user)}
          displayName={account.user?.displayName}
          catalogueMode={getCatalogueMode()}
        >
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
