"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { LumenSpark } from "@/components/lumen-spark";
import { ThemeToggle } from "@/components/theme-toggle";
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
          <ThemeToggle />
          <Link
            href="/sign-in"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "hidden sm:inline-flex",
            )}
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
          >
            Sign up
          </Link>

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
                <Link
                  href="/sign-in"
                  className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
                >
                  Log in
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(buttonVariants(), "mt-1 rounded-full")}
                >
                  Sign up
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
