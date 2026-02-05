import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import StatusBanner from "@/components/StatusBanner";

const plexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600"],
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "cursedAI",
  description:
    "An infinite doomscroll of AI-generated media ordered by community-rated cursedness.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plexSans.variable} antialiased`}>
        <StatusBanner />
        {children}
        <AnalyticsTracker />
      </body>
    </html>
  );
}
