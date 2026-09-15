import React from "react";
import { Skeleton } from "./Skeleton";

export const SkeletonKpi: React.FC = () => (
  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
    <div className="flex items-start justify-between">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-8 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-3 w-24 rounded-full" />
  </div>
);
