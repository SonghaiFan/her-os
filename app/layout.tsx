import type { Metadata } from "next";
import "./globals.css";
import "streamdown/styles.css";

export const metadata: Metadata = {
  title: "Her OS",
  description: "An immersive OS1 topology-ring sequence built with Next.js and Three.js.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
