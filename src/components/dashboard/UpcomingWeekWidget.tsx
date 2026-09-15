import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { useRentalStore } from "@/store/rentalStore";
import { formatDate, cn } from "@/lib/utils";
import type { UpcomingEventItem } from "@/types/dashboard";

interface UpcomingWeekWidgetProps {
  events: UpcomingEventItem[];
}

export const UpcomingWeekWidget: React.FC<UpcomingWeekWidgetProps> = ({ events }) => {
  const navigate = useNavigate();
  const setSearchQuery = useRentalStore((s) => s.setSearchQuery);

  const handleGoToContract = (contractNumber: string) => {
    setSearchQuery(contractNumber);
    navigate("/locations");
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Prochains 7 Jours
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Planning des retraits et restitutions programmés
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/locations")}
            className="text-xs text-primary hover:underline flex items-center gap-0.5 font-medium"
          >
            <span>Calendrier</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Liste des événements de la semaine */}
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-xs">Aucun mouvement programmé sur les 7 prochains jours.</p>
            </div>
          ) : (
            events.map((evt) => {
              const isRetrait = evt.event_type === "retrait";
              return (
                <div
                  key={evt.id}
                  className="p-3 rounded-lg border border-border bg-secondary/30 hover:border-primary/40 flex items-center justify-between gap-3 text-xs transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        isRetrait
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-emerald-500/10 text-emerald-500"
                      )}
                      title={isRetrait ? "Retrait client" : "Restitution"}
                    >
                      {isRetrait ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {evt.customer_name}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase",
                            isRetrait
                              ? "bg-blue-500/15 text-blue-400"
                              : "bg-emerald-500/15 text-emerald-400"
                          )}
                        >
                          {isRetrait ? "Retrait" : "Retour"}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                        {evt.articles_summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <div>
                      <p className="font-semibold text-foreground text-[11px]">
                        {formatDate(evt.date_prevue)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {evt.contract_number}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGoToContract(evt.contract_number)}
                      className="p-1.5 rounded-md bg-secondary hover:bg-muted text-primary transition-colors"
                      title="Ouvrir le contrat"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Mouvements synchronisés</span>
        <span className="text-blue-500 font-medium">Planning actif</span>
      </div>
    </div>
  );
};
