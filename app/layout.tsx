import type { Metadata } from "next";
import "./globals.css";
import "./operations.css";
import "./customer.css";

export const metadata: Metadata = {
  title: "PUNA — South American Surf Fuel",
  description: "West Coast empanadas, made from scratch. Explore the PUNA menu and our story.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
