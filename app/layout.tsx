import type { Metadata } from "next";
import { JetBrains_Mono, IBM_Plex_Mono, Noto_Sans_Thai } from "next/font/google";
import MatrixRain from "@/components/MatrixRain";
import { I18nProvider } from "@/lib/i18n/context";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-jetbrains",
  display: "swap",
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex",
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "700"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ALEX-CHAT",
  description: "Private ephemeral comms — messages self-destruct 10 minutes after sending.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrains.variable} ${plex.variable} ${notoThai.variable}`}>
      <body className="font-body bg-bg text-text min-h-screen relative">
        <MatrixRain />
        <div className="scanline-overlay" />
        <I18nProvider>
          <div className="relative z-10">{children}</div>
        </I18nProvider>
      </body>
    </html>
  );
}
