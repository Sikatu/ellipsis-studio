import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ELLIPSIS Brand Discovery",
    template: "%s | ELLIPSIS",
  },
  description:
    "A strategic brand discovery system for client onboarding and creative direction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}