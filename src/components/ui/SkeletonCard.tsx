import React from "react";
import { Skeleton } from "./Skeleton";

export const SkeletonCard: React.FC = () => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <Skeleton className="h-36 w-full rounded-xl" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
    <div className="flex gap-2 pt-1">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <div className="flex justify-between items-center pt-1">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  </div>
);
