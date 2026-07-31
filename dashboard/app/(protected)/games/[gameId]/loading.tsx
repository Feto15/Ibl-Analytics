import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-5 w-28" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40 lg:col-span-2" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
