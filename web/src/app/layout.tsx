import type { Metadata } from "next";
import "./globals.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import Umami from "../components/Umami";
import { THEME_IDS } from "../themes/registry";

config.autoAddCss = false;

// Runs in <head> before first paint: rolls one design at random and applies it
// so the correct backdrop is painted with no flash. ThemeStage reads the same
// attribute on mount, so the design always matches the painted background.
// An optional `?theme=<id>` query param pins a specific design (handy for
// sharing or debugging a particular look) without breaking the random default.
const themeScript = `(function(){try{var t=${JSON.stringify(
  THEME_IDS
)};var q=new URLSearchParams(location.search).get("theme");var c=t.indexOf(q)>=0?q:t[Math.floor(Math.random()*t.length)];document.documentElement.setAttribute("data-theme",c);}catch(e){}})();`;

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
      <body>
        <Umami />
        {children}
      </body>
    </html>
  );
}
