"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

type UserMenuProps = {
  user: {
    name: string;
    email: string;
  };
};

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted">
            <User className="size-3.5 text-muted-foreground" />
          </span>
          <span className="hidden max-w-[140px] truncate text-sm sm:inline">
            {user.name || user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5 font-normal">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut className="size-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
