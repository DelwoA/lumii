// =============================================================================
// FILE: components/marketing/marketing-nav.tsx
// WHAT THIS FILE DOES:
//   The top navigation bar of the public landing page. It shows the logo and
//   section links, and is "auth-aware": signed-out visitors see Log in / Sign up,
//   while signed-in visitors see a Dashboard button and their profile menu. On
//   small screens the links collapse into a menu.
// =============================================================================
"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, LayoutDashboard, Menu } from "lucide-react";
import { LumenSpark } from "@/components/lumen-spark";
import { UserMenu } from "@/components/user-menu";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#progress", label: "Progress" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();
  // Keep the static HTML deterministic by rendering signed-out controls until
  // Clerk resolves client-side. Signed-in visitors may see a brief control swap.
  const signedIn = isLoaded && isSignedIn;

  return (
    <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <LumenSpark className="size-6" />
          LUMII
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Desktop auth cluster */}
          <div className="hidden items-center gap-3 md:flex">
            {signedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "gap-1.5 rounded-full",
                  )}
                >
                  Dashboard
                  <ArrowRight className="size-3.5" />
                </Link>
                <UserMenu />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Log in
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile: keep the avatar visible when signed in, plus the menu sheet */}
          {signedIn ? (
            <div className="md:hidden">
              <UserMenu />
            </div>
          ) : null}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <LumenSpark className="size-5" />
                  LUMII
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="hover:bg-muted rounded-md px-2 py-2 text-sm"
                  >
                    {l.label}
                  </a>
                ))}
                {signedIn ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants(),
                      "mt-3 gap-1.5 rounded-full",
                    )}
                  >
                    <LayoutDashboard className="size-4" />
                    Go to dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/sign-in"
                      onClick={() => setOpen(false)}
                      className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
                    >
                      Log in
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setOpen(false)}
                      className={cn(buttonVariants(), "mt-1 rounded-full")}
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
