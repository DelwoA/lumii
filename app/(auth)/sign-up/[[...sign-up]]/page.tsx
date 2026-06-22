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
