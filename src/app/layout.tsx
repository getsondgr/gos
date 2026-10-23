import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Growth OS — Agency Command Center",
  description: "A client growth and agency operations workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
