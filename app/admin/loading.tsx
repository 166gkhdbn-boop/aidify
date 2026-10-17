import { Skeleton } from "@/components/ui";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading admin console">
      <Skeleton className="mb-6 h-9 w-64" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
