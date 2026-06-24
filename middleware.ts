// =============================================================================
// FILE: middleware.ts
// WHAT THIS FILE DOES:
//   "Middleware" runs on EVERY request before the page does. This one is the
//   front-door guard: if the address is one of the protected app pages listed
//   below, it requires the visitor to be signed in (sending them to sign-in if
//   not). Everything else (the landing page, public showcase /u/<handle>, the
//   sign-in/up pages, and the Clerk webhook) stays open to everyone.
//
// HOW TO CHANGE: add or remove address patterns in the isProtectedRoute list.
//   The `config.matcher` at the bottom controls which requests run this at all
//   (it skips Next.js internals and static files like images).
// =============================================================================
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Authenticated app surface. Everything else (landing, /u/[handle], sign-in/up,
// the Clerk webhook) stays public.
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/subjects(.*)",
  "/materials(.*)",
  "/timetable(.*)",
  "/session(.*)",
  "/progress(.*)",
  "/achievements(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|gif|png|svg|ico|webp|woff2?|ttf|otf|map)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
