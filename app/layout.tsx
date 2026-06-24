// =============================================================================
// FILE: app/layout.tsx  (the ROOT LAYOUT)
// WHAT THIS FILE DOES:
//   In Next.js, the `app/` folder holds all the pages. A file named layout.tsx
//   wraps every page beneath it. THIS root layout wraps the ENTIRE app, so the
//   code here runs on every single screen (landing page, sign-in, dashboard...).
//
//   It sets up three app-wide things:
//     1. The <html>/<body> shell, the page fonts, and dark mode.
//     2. ClerkProvider  -> makes sign-in/accounts available everywhere.
//     3. ThemeProvider + Toaster -> dark theme + the little pop-up messages.
//
// HOW TO FIND THINGS:
//   - Search "metadata" to change the browser tab title or description.
//   - Search "colorPrimary" to change the accent colour of the sign-in screens.
//   - Search "forcedTheme" to change/relax the dark-only setting.
// =============================================================================
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
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
  // LUMII is dark-only: the `dark` class is hardcoded so static pages paint
  // dark with no flash, and next-themes is locked to dark via forcedTheme.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          appearance={{
            // Force Clerk's auth UI dark to match the app (LUMII is dark-only).
            // Clerk derives its palette from these base variables.
            variables: {
              colorPrimary: "#caf136",
              colorPrimaryForeground: "#0a0a0a",
              colorBackground: "#0a0a0a",
              colorForeground: "#fafafa",
              colorMutedForeground: "#a1a1a1",
              colorInput: "#141414",
              colorInputForeground: "#fafafa",
              colorBorder: "#262626",
              colorNeutral: "#ffffff",
            },
            captcha: { theme: "dark" },
          }}
        >
          <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
            {children}
            <Toaster theme="dark" richColors position="bottom-right" />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
