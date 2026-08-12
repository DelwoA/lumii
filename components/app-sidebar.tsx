// =============================================================================
// FILE: components/app-sidebar.tsx
// WHAT THIS FILE DOES:
//   The left navigation menu shown on every signed-in page. It lists the links
//   (Dashboard, Subjects, Materials, Timetable, Progress, Achievements,
//   Settings), highlights the current page, and shows the points/rank/streak
//   summary in its footer.
//
// HOW TO CHANGE:
//   - To add, remove, or reorder menu items, edit the nav list below.
//   - To change an item's icon, swap the lucide-react icon imported here.
//   - "use client" at the top marks this as browser code (it reacts to which
//     page you are on, to highlight the active item).
// =============================================================================
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LibraryBig,
  CalendarDays,
  TrendingUp,
  Trophy,
  Settings,
  Flame,
} from "lucide-react";
import { LumenSpark } from "@/components/lumen-spark";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { GamificationSummary } from "@/lib/gamification/service";
import { isNavActive } from "@/lib/navigation";

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Study Library", icon: LibraryBig },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({ summary }: { summary?: GamificationSummary }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight"
        >
          <LumenSpark className="size-6 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">LUMII</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {NAV.map((item) => {
                const active = isNavActive(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} prefetch />}
                      isActive={active}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {summary ? (
          <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{titleCase(summary.rank)}</span>
              <span className="text-muted-foreground tabular-nums">
                {summary.totalXp.toLocaleString()} XP
              </span>
            </div>
            <Progress
              value={summary.progress.progress * 100}
              className="mt-1.5 h-1.5"
            />
            <div className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
              <Flame className="text-primary size-3" />
              {summary.currentStreak}-day streak
            </div>
          </div>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}

/** Static shell used while the request-scoped pathname and XP arrive. */
export function AppSidebarFallback() {
  return (
    <Sidebar collapsible="icon" aria-hidden="true">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight">
          <LumenSpark className="size-6 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">LUMII</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="space-y-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
