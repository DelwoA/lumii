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
