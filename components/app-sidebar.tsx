"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  CalendarDays,
  TrendingUp,
  Trophy,
  Settings,
  Flame,
} from "lucide-react";
import { LumenSpark } from "@/components/lumen-spark";
import { Progress } from "@/components/ui/progress";
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

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/materials", label: "Materials", icon: FileText },
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
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
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
            <Progress value={summary.progress.progress * 100} className="mt-1.5 h-1.5" />
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
