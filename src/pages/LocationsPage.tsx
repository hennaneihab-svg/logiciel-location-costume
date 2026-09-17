import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Calendar as CalendarIcon,
  Table as TableIcon,
  Clock,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { formatCents } from "@/lib/utils";
import { useRentalStore } from "@/store/rentalStore";
import { RentalCalendarView } from "@/components/rentals/RentalCalendarView";
import { RentalTableView } from "@/components/rentals/RentalTableView";
import { CreateRentalModal } from "@/components/rentals/CreateRentalModal";
import { PdfPreviewModal } from "@/components/rentals/PdfPreviewModal";
import { ReturnProcessModal } from "@/components/rentals/ReturnProcessModal";

export const LocationsPage: React.FC = () => {
  const { contracts, setCreateRentalModalOpen, searchQuery } = useRentalStore();
  const [activeTab, setActiveTab] = useState<"calendar" | "table">(
    searchQuery ? "table" : "calendar"
  );

  React.useEffect(() => {
    if (searchQuery) {
      setActiveTab("table");
    }
  }, [searchQuery]);

  // Métriques globales du module Locations
  const metrics = useMemo(() => {
    const activeCount = contracts.filter((c) => c.status === "en_cours").length;
    const reservedCount = contracts.filter((c) => c.status === "reserve").length;
    const lateCount = contracts.filter((c) => c.status === "en_retard").length;
    const returnedCount = contracts.filter((c) => c.status === "retourne").length;
    const totalCaCents = contracts.reduce(
      (sum, c) => sum + c.total_amount_cents,
      0
    );

    return {
      activeCount,
      reservedCount,
      lateCount,
      returnedCount,
      totalCaCents,
    };
  }, [contracts]);

  return (
    <div className="space-y-6 select-none">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Contrats &amp; Locations
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border font-mono">
              {contracts.length} contrats
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Planning des réservations, gestion des départs/retours et génération des bons
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCreateRentalModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Location</span>
          </button>
        </div>
      </div>

      {/* Bandeau KPIs Clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              En Cours (Sorties)
            </span>
            <div className="text-xl font-black text-foreground">
              {metrics.activeCount}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Réservations à Venir
            </span>
            <div className="text-xl font-black text-foreground">
              {metrics.reservedCount}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Retards Constatés
            </span>
            <div className="text-xl font-black text-red-500">
              {metrics.lateCount}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Volume CA Facturé
            </span>
            <div className="text-xl font-black text-foreground">
              {formatCents(metrics.totalCaCents)}
            </div>
          </div>
        </div>
      </div>

      {/* Onglets de Bascule Vue Calendrier / Vue Tableau */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTab === "calendar"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Vue Calendrier Visuel</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTab === "table"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Vue Registre & Tableau</span>
          </button>
        </div>
      </div>

      {/* Contenu de la Vue Active */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {activeTab === "calendar" ? (
          <RentalCalendarView />
        ) : (
          <RentalTableView />
        )}
      </motion.div>

      {/* Modals & Dialogues Réutilisables */}
      <CreateRentalModal />
      <PdfPreviewModal />
      <ReturnProcessModal />
    </div>
  );
};
