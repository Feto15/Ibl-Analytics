import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-[460px] w-full" />
    </div>
  );
}
