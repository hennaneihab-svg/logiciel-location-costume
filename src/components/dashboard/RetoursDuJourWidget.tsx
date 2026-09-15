import React from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  AlertTriangle,
  Clock,
  PhoneCall,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { useAlertStore } from "@/store/alertStore";
import { useRentalStore } from "@/store/rentalStore";
import { cn, formatCents } from "@/lib/utils";

export const RetoursDuJourWidget: React.FC = () => {
  const navigate = useNavigate();
  const alerts = useAlertStore((s) => s.alerts);
  const getRetoursDuJour = useAlertStore((s) => s.getRetoursDuJour);
  const retours = React.useMemo(() => getRetoursDuJour(), [alerts, getRetoursDuJour]);
  const setSearchQuery = useRentalStore((s) => s.setSearchQuery);

  const retardsCount = retours.filter((r) => r.category === "retard_retour").length;
  const jourJCount = retours.filter((r) => r.category === "retour_jour_j").length;

  const handleGoToContract = (contractNumber?: string) => {
    if (contractNumber) {
      setSearchQuery(contractNumber);
    }
    navigate("/locations");
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
      <div>
        {/* Header Widget */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <CalendarClock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Retours du Jour &amp; Retards
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Planning immédiat des restitutions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/alertes")}
            className="text-xs text-primary hover:underline flex items-center gap-0.5 font-medium"
          >
            <span>Toutes les alertes</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Badges compteurs */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-500">Retards</span>
            </div>
            <span className="text-sm font-bold text-red-500">{retardsCount}</span>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-500">Jour-J</span>
            </div>
            <span className="text-sm font-bold text-amber-500">{jourJCount}</span>
          </div>
        </div>

        {/* Liste des retours */}
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {retours.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-60" />
              <p className="text-xs">Aucun retour en retard ni attendu aujourd'hui.</p>
            </div>
          ) : (
            retours.map((item) => {
              const isRetard = item.category === "retard_retour";
              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all",
                    isRetard
                      ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                      : "bg-secondary/40 border-border hover:border-primary/40"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {item.customer_name}
                      </span>
                      {isRetard ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-500 animate-pulse">
                          +{item.days_overdue}j retard
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500">
                          Aujourd'hui
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                      {item.article_name} • <span className="font-mono text-primary font-medium">{item.contract_number}</span>
                    </p>
                    {item.late_fee_cents ? (
                      <p className="text-[10px] text-red-400 font-semibold mt-0.5">
                        Pénalité calculée : {formatCents(item.late_fee_cents)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.customer_phone && (
                      <a
                        href={`tel:${item.customer_phone.replace(/\s/g, "")}`}
                        className="p-1.5 rounded-md bg-secondary hover:bg-muted text-primary transition-colors"
                        title={`Appeler ${item.customer_phone}`}
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleGoToContract(item.contract_number)}
                      className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                      title="Ouvrir le dossier location"
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
        <span>Vérification automatique active</span>
        <span className="text-emerald-500 font-medium">Moteur synchro</span>
      </div>
    </div>
  );
};
