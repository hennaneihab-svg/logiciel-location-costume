/**
 * Module E — AlertesPage
 * Page complète du système d'alertes & rappels.
 * Remplace le placeholder initial.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  AlertTriangle,
  CheckCircle2,
  Info,
  Search,
  Filter,
  FileDown,
  RotateCcw,
  TrendingDown,
  CalendarX2,
  Package,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAlertStore, CATEGORY_LABELS } from "@/store/alertStore";
import { AlertCard } from "@/components/alerts/AlertCard";
import { DismissAlertDialog } from "@/components/alerts/DismissAlertDialog";
import { AlertsPdfExportModal } from "@/components/alerts/AlertsPdfExportModal";
import { MarkProcessedDialog } from "@/components/alerts/MarkProcessedDialog";
import type { AlertSeverity, AlertCategory, AlertStatus } from "@/types/alert";

// ─── KPI Banner ─────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  onClick?: () => void;
  active?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  onClick,
  active,
}) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "flex items-center gap-4 p-4 rounded-xl border bg-card shadow-sm text-left transition-all duration-150 w-full",
      active ? "border-primary/50 ring-2 ring-primary/20" : "border-border hover:border-primary/30"
    )}
  >
    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", bgClass)}>
      <Icon className={cn("w-5 h-5", colorClass)} />
    </div>
    <div>
      <p className={cn("text-2xl font-bold", colorClass)}>{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
    </div>
  </motion.button>
);

// ─── Page principale ─────────────────────────────────────────────────────────
export const AlertesPage: React.FC = () => {
  const {
    filters,
    setFilters,
    resetFilters,
    isDismissDialogOpen,
    alertToDismiss,
    openDismissDialog,
    closeDismissDialog,
    dismissAlert,
    reactivateAlert,
    isProcessDialogOpen,
    alertToProcess,
    openProcessDialog,
    closeProcessDialog,
    markAsProcessed,
    markAsViewed,
    isPdfExportModalOpen,
    openPdfExport,
    closePdfExport,
    getActiveCount,
    getCriticalCount,
    getFilteredAlerts,
    alerts,
  } = useAlertStore();

  const filtered = getFilteredAlerts();
  const activeCount = getActiveCount();
  const criticalCount = getCriticalCount();
  const warningCount = alerts.filter(
    (a) => (a.status === "active" || a.status === "vue") && a.severity === "avertissement"
  ).length;
  const infoCount = alerts.filter(
    (a) => (a.status === "active" || a.status === "vue") && a.severity === "info"
  ).length;
  const processedCount = alerts.filter((a) => a.status === "traitee").length;
  const dismissedCount = alerts.filter((a) => a.status === "acquittee").length;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDismiss = (alertId: string, comment: string) => {
    dismissAlert(alertId, comment);
    toast.success("Alerte acquittée avec succès.");
  };

  const handleProcessConfirm = (alertId: string, comment: string) => {
    markAsProcessed(alertId, comment);
    toast.success("Alerte marquée comme traitée.");
  };

  const handleReactivate = (alertId: string) => {
    reactivateAlert(alertId);
    toast.info("Alerte réactivée.");
  };

  // ── Filtres rapides (statut) ──────────────────────────────────────────────
  const STATUS_TABS: { label: string; value: AlertStatus | "all" }[] = [
    { label: `Actives (${activeCount})`, value: "active" },
    { label: `Traitées (${processedCount})`, value: "traitee" },
    { label: `Acquittées (${dismissedCount})`, value: "acquittee" },
    { label: "Toutes", value: "all" },
  ];

  // ── Sévérités ─────────────────────────────────────────────────────────────
  const SEVERITY_OPTIONS: { label: string; value: AlertSeverity | "all" }[] = [
    { label: "Toutes", value: "all" },
    { label: "Critique", value: "critique" },
    { label: "Avertissement", value: "avertissement" },
    { label: "Info", value: "info" },
  ];

  // ── Catégories ────────────────────────────────────────────────────────────
  const CATEGORY_OPTIONS: { label: string; value: AlertCategory | "all" }[] = [
    { label: "Toutes catégories", value: "all" },
    ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({
      label: v,
      value: k as AlertCategory,
    })),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            Alertes & Rappels
            {criticalCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {criticalCount} CRITIQUE{criticalCount > 1 ? "S" : ""}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suivi des retards, rappels de retour et alertes de stock
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetFilters}
            title="Réinitialiser les filtres"
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={openPdfExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <FileDown className="w-4 h-4 text-primary" />
            Exporter PDF
          </button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Critiques actives"
          value={criticalCount}
          icon={AlertTriangle}
          colorClass="text-red-500"
          bgClass="bg-red-500/10"
          onClick={() => setFilters({ severity: "critique", status: "active" })}
          active={filters.severity === "critique" && filters.status === "active"}
        />
        <KpiCard
          label="Avertissements"
          value={warningCount}
          icon={CalendarX2}
          colorClass="text-amber-500"
          bgClass="bg-amber-500/10"
          onClick={() => setFilters({ severity: "avertissement", status: "active" })}
          active={filters.severity === "avertissement" && filters.status === "active"}
        />
        <KpiCard
          label="Informations"
          value={infoCount}
          icon={Info}
          colorClass="text-blue-400"
          bgClass="bg-blue-500/10"
          onClick={() => setFilters({ severity: "info", status: "active" })}
          active={filters.severity === "info" && filters.status === "active"}
        />
        <KpiCard
          label="Acquittées"
          value={dismissedCount}
          icon={CheckCircle2}
          colorClass="text-emerald-400"
          bgClass="bg-emerald-500/10"
          onClick={() => setFilters({ status: "acquittee", severity: "all" })}
          active={filters.status === "acquittee"}
        />
      </div>

      {/* ── Panneau de filtres ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Recherche textuelle */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters({ searchQuery: e.target.value })}
              placeholder="Rechercher client, contrat, article…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
            />
          </div>

          {/* Sévérité */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ severity: e.target.value as AlertSeverity | "all" })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Catégorie */}
          <select
            value={filters.category}
            onChange={(e) => setFilters({ category: e.target.value as AlertCategory | "all" })}
            className="px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Onglets statut */}
        <div className="flex gap-1 p-1 rounded-lg bg-background border border-border w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilters({ status: tab.value })}
              className={cn(
                "px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                filters.status === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Légende des catégories ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Retard", color: "bg-red-500/15 text-red-500 border-red-500/25" },
          { label: "Jour-J", color: "bg-amber-500/15 text-amber-500 border-amber-500/25" },
          { label: "J-1 / J-2 / J-3", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
          { label: "Stock bas", color: "bg-violet-500/15 text-violet-400 border-violet-500/25" },
          { label: "Inactif 90j", color: "bg-gray-500/15 text-gray-400 border-gray-500/25" },
        ].map((item) => (
          <span
            key={item.label}
            className={cn("text-[10px] px-2.5 py-1 rounded-full font-semibold border", item.color)}
          >
            {item.label}
          </span>
        ))}
      </div>

      {/* ── Liste des alertes ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length} alerte{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""}
          </p>
          {filters.status === "active" && filtered.some((a) => a.severity === "critique") && (
            <p className="text-[10px] text-red-400 font-semibold animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Action requise sur les alertes critiques
            </p>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-16 flex flex-col items-center gap-3 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {filters.searchQuery || filters.severity !== "all" || filters.category !== "all"
                  ? "Aucune alerte ne correspond à vos filtres"
                  : "Aucune alerte active — tout est en ordre !"}
              </p>
              <p className="text-xs text-muted-foreground">
                {filters.searchQuery || filters.severity !== "all" || filters.category !== "all"
                  ? "Essayez de modifier vos critères de recherche."
                  : "Les nouvelles alertes apparaîtront ici automatiquement."}
              </p>
            </motion.div>
          ) : (
            filtered.map((alert, index) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                index={index}
                onDismiss={openDismissDialog}
                onReactivate={handleReactivate}
                onMarkViewed={markAsViewed}
                onProcess={openProcessDialog}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* ── Section d'information sur les notifications système ───────────── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Moteur d'Alertes &amp; Notifications Système</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Le job en arrière-plan vérifie en permanence les échéances des contrats de location en cours.
              Dès qu'un retour est à J-1, Jour-J ou en Retard, une notification système native (Tauri)
              est envoyée même lorsque l'application est minimisée. Chaque alerte peut être consultée ("Vue")
              ou traitée ("Traitée" avec compte-rendu consigné) sans rupture de traçabilité.
            </p>
            <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3 text-primary" />
                Vérification automatique toutes les heures + au démarrage
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Package className="w-3 h-3 text-primary" />
                Déduplication intelligente par contrat &amp; catégorie
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <TrendingDown className="w-3 h-3 text-primary" />
                Pénalités de retard calculées automatiquement
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <DismissAlertDialog
        isOpen={isDismissDialogOpen}
        alert={alertToDismiss}
        onConfirm={handleDismiss}
        onClose={closeDismissDialog}
      />
      <MarkProcessedDialog
        isOpen={isProcessDialogOpen}
        alert={alertToProcess}
        onConfirm={handleProcessConfirm}
        onClose={closeProcessDialog}
      />
      <AlertsPdfExportModal
        isOpen={isPdfExportModalOpen}
        onClose={closePdfExport}
      />
    </motion.div>
  );
};
