import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  FileText,
  RotateCcw,
} from "lucide-react";
import { useRentalStore } from "@/store/rentalStore";
import { formatCents } from "@/lib/utils";
import type { RentalContract, RentalContractStatus } from "@/types/rental";

export const RentalCalendarView: React.FC = () => {
  const { contracts, setPdfPreviewModalOpen, setReturnModalOpen } =
    useRentalStore();

  // Date de travail centrée sur Septembre 2026 (date du contexte)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 14)); // 14 Septembre 2026
  const [selectedDayContracts, setSelectedDayContracts] = useState<{
    dateStr: string;
    contracts: RentalContract[];
  } | null>(null);

  // Configuration des statuts colorés
  const getStatusColor = (status: RentalContractStatus) => {
    switch (status) {
      case "en_cours":
        return {
          bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          dot: "bg-emerald-500",
          label: "En cours",
        };
      case "reserve":
        return {
          bg: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          dot: "bg-blue-500",
          label: "Réservé",
        };
      case "en_retard":
        return {
          bg: "bg-red-500/25 text-red-400 border-red-500/40 animate-pulse",
          dot: "bg-red-500",
          label: "En retard",
        };
      case "retourne":
        return {
          bg: "bg-slate-500/20 text-slate-300 border-slate-500/30",
          dot: "bg-slate-400",
          label: "Restitué",
        };
      case "litige":
        return {
          bg: "bg-purple-500/20 text-purple-400 border-purple-500/30",
          dot: "bg-purple-500",
          label: "Litige",
        };
      default:
        return {
          bg: "bg-secondary text-muted-foreground border-border",
          dot: "bg-muted",
          label: status,
        };
    }
  };

  // Calcul des jours du mois affiché
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Décalage pour commencer le lundi (0 = Dimanche -> 6, 1 = Lundi -> 0)
    let startDayIndex = firstDayOfMonth.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6;

    const days = [];

    // Jours du mois précédent pour combler la première semaine
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Jours du mois en cours
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Jours du mois suivant pour compléter les 35 ou 42 cases
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 8, 14));
  };

  const monthName = currentDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  // Associer chaque contrat aux jours concernés
  const getContractsForDate = (date: Date): RentalContract[] => {
    const dateStr = date.toISOString().split("T")[0];
    return contracts.filter((c) => {
      const start = c.pickup_date;
      const end = c.return_date_scheduled;
      return dateStr >= start && dateStr <= end;
    });
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils du calendrier */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground border border-border"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground border border-border"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="font-bold text-base capitalize text-foreground flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            <span>{monthName}</span>
          </h3>

          <button
            type="button"
            onClick={handleToday}
            className="px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary text-xs font-semibold text-foreground border border-border"
          >
            Aujourd'hui
          </button>
        </div>

        {/* Légende des couleurs de statuts */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            En cours
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Réservé
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            En retard
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/30 font-semibold">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Restitué
          </span>
        </div>
      </div>

      {/* Grille Mensuelle du Calendrier */}
      <div className="rounded-xl bg-card border border-border overflow-hidden shadow-sm">
        {/* Entêtes jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-bold text-muted-foreground py-2.5">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mer</span>
          <span>Jeu</span>
          <span>Ven</span>
          <span>Sam</span>
          <span>Dim</span>
        </div>

        {/* Cases des jours */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
          {calendarDays.map((item, idx) => {
            const dateStr = item.date.toISOString().split("T")[0];
            const isToday = dateStr === "2026-09-14";
            const dayContracts = getContractsForDate(item.date);

            return (
              <div
                key={idx}
                onClick={() =>
                  setSelectedDayContracts({
                    dateStr,
                    contracts: dayContracts,
                  })
                }
                className={`min-h-[105px] p-2 flex flex-col justify-between transition-colors cursor-pointer ${
                  !item.isCurrentMonth
                    ? "bg-secondary/15 opacity-40"
                    : isToday
                    ? "bg-primary/[0.04] ring-1 ring-inset ring-primary/40"
                    : "hover:bg-muted/20"
                }`}
              >
                {/* En-tête numéro de jour */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                      isToday
                        ? "bg-primary text-primary-foreground font-black shadow-sm"
                        : item.isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.date.getDate()}
                  </span>

                  {dayContracts.length > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">
                      {dayContracts.length} loc.
                    </span>
                  )}
                </div>

                {/* Événements de location dans la case */}
                <div className="space-y-1 overflow-hidden flex-1">
                  {dayContracts.slice(0, 3).map((contract) => {
                    const cfg = getStatusColor(contract.status);
                    const isPickupDay = contract.pickup_date === dateStr;
                    const isReturnDay =
                      contract.return_date_scheduled === dateStr;

                    return (
                      <div
                        key={contract.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPdfPreviewModalOpen(true, contract);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border flex items-center justify-between gap-1 shadow-xs hover:brightness-110 transition-all ${cfg.bg}`}
                        title={`${contract.contract_number} - ${contract.customer_name} (${contract.items[0]?.article_name || ""})`}
                      >
                        <span className="truncate">
                          {isPickupDay && "Départ : "}
                          {isReturnDay && "Retour : "}
                          {contract.customer_name}
                        </span>
                        <span className="text-[9px] font-mono shrink-0">
                          {contract.contract_number.split("-")[2]}
                        </span>
                      </div>
                    );
                  })}

                  {dayContracts.length > 3 && (
                    <span className="text-[9px] text-muted-foreground block text-center font-bold">
                      +{dayContracts.length - 3} autre(s)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popover / Détail des contrats du jour cliqué */}
      {selectedDayContracts && selectedDayContracts.contracts.length > 0 && (
        <div className="p-4 rounded-xl bg-card border border-border shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-primary" />
              <span>
                Locations actives le{" "}
                {new Date(selectedDayContracts.dateStr).toLocaleDateString(
                  "fr-FR",
                  { weekday: "long", day: "numeric", month: "long", year: "numeric" }
                )}
              </span>
            </h4>
            <button
              onClick={() => setSelectedDayContracts(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedDayContracts.contracts.map((contract) => {
              const cfg = getStatusColor(contract.status);
              return (
                <div
                  key={contract.id}
                  className="p-3 rounded-lg bg-secondary/30 border border-border flex flex-col justify-between text-xs space-y-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">
                        {contract.contract_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground mt-1">
                      {contract.customer_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {contract.items.map((i) => i.article_name).join(", ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Du {contract.pickup_date} au {contract.return_date_scheduled}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="font-extrabold text-foreground">
                      {formatCents(contract.total_amount_cents)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {contract.status === "en_cours" ||
                      contract.status === "en_retard" ? (
                        <button
                          type="button"
                          onClick={() => setReturnModalOpen(true, contract)}
                          className="px-2 py-1 rounded bg-secondary hover:bg-muted text-xs font-semibold text-foreground border border-border flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-500" />
                          <span>Retour</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setPdfPreviewModalOpen(true, contract)}
                        className="px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Bon PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
