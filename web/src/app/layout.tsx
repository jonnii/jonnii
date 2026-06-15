import type { Metadata } from "next";
import { Major_Mono_Display } from "next/font/google";
import "./globals.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import Umami from "../components/Umami";

config.autoAddCss = false;

const majorMono = Major_Mono_Display({
  subsets: ["latin"],
  weight: "400",
});

// Available themes (must match the [data-theme="..."] blocks in globals.css).
// A fresh one is rolled on every visit for a "spin the wheel" feel.
const THEMES = ["solarized", "strokes"];

// Runs in <head> before first paint to avoid a flash of the default theme.
const themeScript = `(function(){try{var t=${JSON.stringify(
  THEMES
)};document.documentElement.setAttribute("data-theme",t[Math.floor(Math.random()*t.length)]);}catch(e){}})();`;

export const metadata: Metadata = {
  title: "jonnii",
  description: "jonnii.com",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf6e3" },
    { media: "(prefers-color-scheme: dark)", color: "#002b36" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={majorMono.className}>
        <Umami />
        {children}
      </body>
    </html>
  );
}
