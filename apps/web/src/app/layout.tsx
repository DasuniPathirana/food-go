import type { Metadata, Viewport } from "next";
import { SiteShell } from "@/components/site-shell";
import { getAuthState } from "@/lib/auth/server";
import { getCatalogueMode } from "@/lib/catalogue-server";
import { JourneyProvider } from "@/components/journey-provider";
import { CommunityConsentProvider } from "@/components/community-consent";
import { FeedAccessProvider } from "@/components/feed-access";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "./globals.css";
import "./ui-refinement.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "Food Go | Your neighbourhood food guide",
    template: "%s | Food Go",
  },
  description:
    "Explore Melbourne, find restaurants and promotions, and share your food discoveries.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ebf4ef",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await getAuthState();
  return (
    <html lang="en-AU" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <FeedAccessProvider signedIn={Boolean(account.user)} age={account.user?.ageStatus ?? null}><CommunityConsentProvider key={account.user?.id || "guest"} signedIn={Boolean(account.user)}><JourneyProvider signedIn={Boolean(account.user)}><SiteShell
          signedIn={Boolean(account.user)}
          displayName={account.user?.displayName}
          catalogueMode={getCatalogueMode()}
          accountType={account.user?.accountType}
        >
          {children}
        </SiteShell></JourneyProvider></CommunityConsentProvider></FeedAccessProvider>
      </body>
    </html>
  );
}
