import type { Metadata } from "next";
import {pageMetadata,siteOrigin} from "@/lib/site-metadata";
import "./globals.css";
import "./operations.css";
import "./customer.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  ...pageMetadata('PUNA — West Coast Empanadas', 'Andean roots. West Coast life. Explore PUNA’s handmade empanadas and find the food truck at Canadian Princess in Ucluelet.'),
  icons: {icon:'/favicon.svg',shortcut:'/favicon.svg'},
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
