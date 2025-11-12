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

export const metadata: Metadata = {
  title: "jonnii",
  description: "jonnii.com",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={majorMono.className}>
        <Umami />
        {children}
      </body>
    </html>
  );
}
