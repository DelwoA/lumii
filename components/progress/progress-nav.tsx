"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/progress", label: "Overview" },
  { href: "/progress/mastery", label: "Mastery map" },
  { href: "/progress/quizzes", label: "Quiz history" },
] as const;

export function ProgressNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Progress sections" className="overflow-x-auto">
      <div className="bg-muted/60 flex w-max rounded-xl border p-1">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
