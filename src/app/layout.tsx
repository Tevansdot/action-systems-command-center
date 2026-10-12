import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Action Systems · AI Command Center",
  description:
    "A private marketing workspace with human approval at every publishing decision.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
