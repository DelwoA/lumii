// =============================================================================
// FILE: app/(auth)/sign-in/[[...sign-in]]/page.tsx   ->   /sign-in
// WHAT THIS FILE DOES:
//   The sign-in page. It simply drops in Clerk's ready-made <SignIn> box. The
//   [[...sign-in]] folder name is a Clerk requirement: it lets Clerk handle its
//   own sub-steps (like verification) under /sign-in. After signing in, the user
//   is sent to /dashboard (unless they were deep-linked somewhere specific).
// =============================================================================
import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  // fallbackRedirectUrl sends a direct sign-in to the dashboard, while still
  // honoring a `redirect_url` deep link (e.g. when sent here from /settings).
  return (
    <SignIn
      fallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    />
  );
}
