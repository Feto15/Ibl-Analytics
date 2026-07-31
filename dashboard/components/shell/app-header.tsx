"use client";

import { Suspense } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SeasonFilter } from "@/components/ibl/season-filter";
import { UserMenu } from "@/components/auth/user-menu";
import type { SeasonOption } from "@/lib/db/types";

export function AppHeader({
  seasons,
  user,
}: {
  seasons: SeasonOption[];
  user: { name: string; email: string };
}) {
  return (
    <header className="sticky top-0 z-10 flex w-full shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-2.5 sm:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-2" />
        <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
          IBL Analytics
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Suspense fallback={<div className="h-8 w-[150px]" aria-hidden="true" />}>
          <SeasonFilter seasons={seasons} />
        </Suspense>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
