import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { seasonsDb } from "@/lib/db";
import type { SeasonOption } from "@/lib/db/types";

type AppUser = {
  name: string;
  email: string;
};

export async function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AppUser;
}) {
  let seasons: SeasonOption[] = [];
  try {
    seasons = await seasonsDb.getSeasons();
  } catch {
    seasons = [];
  }

  return (
    <SidebarProvider className="bg-sidebar">
      <AppSidebar />
      <div className="h-svh overflow-hidden lg:p-2 w-full">
        <div className="lg:border lg:rounded-lg overflow-hidden flex flex-col h-full w-full bg-background">
          <AppHeader seasons={seasons} user={user} />
          <main className="w-full flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
