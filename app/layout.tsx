import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ShoppingProvider } from "@/src/components/shopping-workspace";
import { SiteHeader } from "@/src/components/site-header";

export const metadata: Metadata = {
  title: "Cart Pilot | Shop electronics",
  description: "A conversational electronics shopping assistant powered by Groq.",
  applicationName: "Cart Pilot",
  appleWebApp: {
    capable: true,
    title: "Cart Pilot",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#c4472b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ShoppingProvider><SiteHeader />{children}</ShoppingProvider></body>
    </html>
  );
}
