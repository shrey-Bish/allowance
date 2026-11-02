import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["italic", "normal"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
const pixel = Pixelify_Sans({ variable: "--font-pixel", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allowance",
  description: "Give your AI agent an allowance, not your wallet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable} ${jetbrains.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
