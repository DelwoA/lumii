// =============================================================================
// FILE: app/(auth)/sign-up/[[...sign-up]]/page.tsx   ->   /sign-up
// WHAT THIS FILE DOES:
//   The sign-up (create account) page. It drops in Clerk's ready-made <SignUp>
//   box. As with sign-in, the [[...sign-up]] folder lets Clerk manage its own
//   sub-steps under /sign-up. After signing up, the user is sent to /dashboard.
// =============================================================================
import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  // Send a new sign-up to the dashboard (honoring any deep link), and route the
  // "already have an account?" link to the same place after signing in.
  return (
    <SignUp
      fallbackRedirectUrl="/dashboard"
      signInFallbackRedirectUrl="/dashboard"
    />
  );
}
