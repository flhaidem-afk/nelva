import type { Metadata } from "next";
import "./globals.css";
import OnlineStatus from "./dashboard/online-status";

export const metadata: Metadata = {
  title: "NELVA — Gaming Community",
  description: "Gaming news, discoveries and community.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <OnlineStatus />
        {children}
      </body>
    </html>
  );
}