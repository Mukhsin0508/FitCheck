import type { Metadata, Viewport } from "next";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "FitCheck",
  description:
    "See it on you before you buy it. A few selfies become your photoreal avatar, and any garment on the internet renders on your body in seconds. Open source, MIT licensed.",
  openGraph: {
    title: "FitCheck",
    description:
      "See it on you before you buy it. Virtual try-on on your own body, open source.",
    type: "website",
    images: [
      {
        url: "/media/hero-mirror.jpg",
        width: 1600,
        height: 905,
        alt: "A mirror fit check rendered with FitCheck",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
