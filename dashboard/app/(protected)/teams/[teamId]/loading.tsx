import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}
      </div>
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
