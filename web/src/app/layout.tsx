import type { Metadata } from "next";
import { Major_Mono_Display } from "next/font/google";
import "./globals.css";

const majorMono = Major_Mono_Display({
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "jonnii",
  description: "jonnii.com",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={majorMono.className}>
        {children}
      </body>
    </html>
  );
}
