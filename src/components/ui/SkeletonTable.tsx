import React from "react";
import { Skeleton } from "./Skeleton";

interface SkeletonTableProps { rows?: number; columns?: number }

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 6, columns = 5 }) => (
  <div className="rounded-xl border border-border overflow-hidden bg-card">
    <div className="px-4 py-3 border-b border-border bg-secondary/30 flex gap-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === 0 ? "w-32" : i === columns - 1 ? "w-16" : "w-24"}`} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="px-4 py-3.5 border-b border-border/50 last:border-0 flex gap-4 items-center">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <Skeleton key={colIdx} className={`h-3.5 ${colIdx === 0 ? "w-36" : colIdx === columns - 1 ? "w-20 rounded-full" : "w-28"}`} />
        ))}
      </div>
    ))}
  </div>
);
