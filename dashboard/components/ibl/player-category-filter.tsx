"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Users, UserCheck } from "lucide-react";

export type PlayerCategoryOption = "all" | "local" | "import";

export function PlayerCategoryFilter({
  value = "all",
}: {
  value?: PlayerCategoryOption;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(newValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newValue === "all") {
      params.delete("category");
    } else {
      params.set("category", newValue);
    }
    params.delete("page"); // reset pagination on filter change
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Tabs value={value} onValueChange={handleChange} className="w-auto">
      <TabsList className="h-8 p-0.5">
        <TabsTrigger value="all" className="h-7 px-2.5 text-xs gap-1">
          <Users className="size-3.5" />
          Semua
        </TabsTrigger>
        <TabsTrigger value="local" className="h-7 px-2.5 text-xs gap-1">
          <UserCheck className="size-3.5" />
          🇮🇩 Lokal
        </TabsTrigger>
        <TabsTrigger value="import" className="h-7 px-2.5 text-xs gap-1">
          <Globe className="size-3.5" />
          🌐 Import
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
