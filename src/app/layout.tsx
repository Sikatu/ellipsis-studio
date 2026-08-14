import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ELLIPSIS Studio",
    template: "%s | ELLIPSIS",
  },
  description:
    "A private workspace for client operations, invoicing, brand strategy, creative direction, and delivery.",
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