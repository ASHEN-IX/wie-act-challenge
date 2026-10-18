import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading workspace">
      <Skeleton className="h-10 w-60" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
