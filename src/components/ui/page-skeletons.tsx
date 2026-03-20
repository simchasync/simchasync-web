import { Skeleton } from "@/components/ui/skeleton";

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ columns = 5, rows = 4 }: { columns?: number; rows?: number }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b p-3 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => <Skeleton key={i} className="h-4 w-20" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 flex gap-4 border-b last:border-0">
          {Array.from({ length: columns }).map((_, j) => <Skeleton key={j} className="h-4 w-20" />)}
        </div>
      ))}
    </div>
  );
}

export function TeamGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
