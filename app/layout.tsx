// =============================================================================
// FILE: app/layout.tsx  (the ROOT LAYOUT)
// WHAT THIS FILE DOES:
//   In Next.js, the `app/` folder holds all the pages. A file named layout.tsx
//   wraps every page beneath it. THIS root layout wraps the ENTIRE app, so the
//   code here runs on every single screen (landing page, sign-in, dashboard...).
//
//   It sets up three app-wide things:
//     1. The <html>/<body> shell and page fonts.
//     2. ClerkProvider  -> makes sign-in/accounts available everywhere.
//     3. Toaster -> the little app-wide confirmation messages.
//
// HOW TO FIND THINGS:
//   - Search "metadata" to change the browser tab title or description.
//   - Search "colorPrimary" to change the accent colour of the sign-in screens.
// =============================================================================
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LUMII · Your AI study companion",
    template: "%s · LUMII",
  },
  description:
    "Turn your notes into summaries, quizzes, and a study plan that sticks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#2F6048",
              colorPrimaryForeground: "#FBFAF6",
              colorBackground: "#FBFAF6",
              colorForeground: "#223128",
              colorMutedForeground: "#607067",
              colorInput: "#FBFAF6",
              colorInputForeground: "#223128",
              colorBorder: "#CDD8CF",
              colorNeutral: "#223128",
            },
            captcha: { theme: "light" },
          }}
        >
          {children}
          <Toaster theme="light" richColors position="bottom-right" />
        </ClerkProvider>
      </body>
    </html>
  );
}
