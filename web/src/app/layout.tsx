import type { Metadata } from "next";
import { Major_Mono_Display, Archivo, Wire_One } from "next/font/google";
import "./globals.css";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import Umami from "../components/Umami";
import { THEME_IDS } from "../themes/registry";

config.autoAddCss = false;

// Each design declares its own typeface(s) as a CSS variable; the active theme
// references the one it needs. Only one design mounts at a time.
const majorMono = Major_Mono_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-major-mono",
});
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});
const wireOne = Wire_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-wire-one",
});

const fontVars = `${majorMono.variable} ${archivo.variable} ${wireOne.variable}`;

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
      <body className={fontVars}>
        <Umami />
        {children}
      </body>
    </html>
  );
}
