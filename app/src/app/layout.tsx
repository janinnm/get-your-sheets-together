import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Get your sheets together",
  description:
    "Condos, houses, and lots across Metro Manila, checked against your salary, savings, and appetite for risk.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
