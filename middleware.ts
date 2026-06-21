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
