import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
