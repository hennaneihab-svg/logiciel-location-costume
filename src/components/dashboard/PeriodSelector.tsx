import React from "react";
import { Calendar } from "lucide-react";
import type { DashboardPeriod } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface PeriodSelectorProps {
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (d: string) => void;
  onDateToChange: (d: string) => void;
}

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "semaine", label: "Cette Semaine" },
  { id: "mois", label: "Ce Mois" },
  { id: "annee", label: "Cette Année" },
  { id: "personnalise", label: "Personnalisé" },
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  period,
  onPeriodChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Boutons d'onglets de période */}
      <div className="flex items-center p-1 rounded-xl bg-secondary/50 border border-border">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPeriodChange(opt.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
              period === opt.id
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Inputs de dates personnalisées */}
      {period === "personnalise" && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/50 border border-border text-xs animate-in fade-in duration-150">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[11px]">Du :</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="bg-background border border-border px-2 py-0.5 rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[11px]">Au :</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="bg-background border border-border px-2 py-0.5 rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
};
