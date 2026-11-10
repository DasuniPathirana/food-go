import type { Metadata, Viewport } from "next";
import { Shell } from "@/components/shell";
import "./globals.css";
import "./refinements.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "Food Go | A little discovery. A lot to love.",
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
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
