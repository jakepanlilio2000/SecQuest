import type { Metadata } from "next";
import "./globals.css";
import "./intelligence.css";
import "./shadcn.css";
import "./refinements.css";
export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "SecQuest — Build your security instinct",
  description:
    "An independent, adaptive cybersecurity learning workspace aligned to Security+ SY0-801 V8.",
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
