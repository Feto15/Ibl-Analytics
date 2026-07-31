"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  Shield,
  Users,
  UsersRound,
  ClipboardCheck,
  Trophy,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const nav = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Games", href: "/games", icon: CalendarRange },
  { title: "Teams", href: "/teams", icon: Shield },
  { title: "Players", href: "/players", icon: Users },
  { title: "Lineups", href: "/lineups", icon: UsersRound },
  { title: "Data Review", href: "/review", icon: ClipboardCheck },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="offcanvas" className="!border-r-0">
      <SidebarHeader className="px-3 py-4">
        <Link href="/" className="flex items-center gap-2 outline-none">
          <div className="size-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            <Trophy className="size-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sidebar-foreground">IBL Analytic</span>
            <span className="text-[11px] text-muted-foreground">Indonesian Basketball League</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>Navigasi</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} className="h-9">
                      <Link href={item.href}>
                        <item.icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
