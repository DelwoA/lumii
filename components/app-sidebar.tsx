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
} from "lucide-react";
import { LumenSpark } from "@/components/lumen-spark";
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

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/materials", label: "Materials", icon: FileText },
  { href: "/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar() {
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
        {/* Streak / XP / rank summary is wired in the gamification task. */}
      </SidebarFooter>
    </Sidebar>
  );
}
