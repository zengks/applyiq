import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ApplyIQ — AI Resume Application Assistant",
  description: "Manage your job applications and leverage AI to optimize every one.",
};

// Without this, mobile browsers assume a ~980px canvas and render the desktop
// layout shrunk to fit. `viewportFit: 'cover'` is what makes env(safe-area-inset-*)
// resolve to real values on notched phones. No maximumScale/userScalable limit —
// blocking pinch-zoom is an accessibility failure.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakarta.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
