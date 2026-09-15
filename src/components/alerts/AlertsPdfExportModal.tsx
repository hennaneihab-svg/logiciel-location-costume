/**
 * Module E — AlertsPdfExportModal
 * Modal de configuration et de déclenchement de l'export PDF des alertes.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileDown, X, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAlertStore } from "@/store/alertStore";
import { generateAlertsPdf } from "@/services/alertPdfService";

interface AlertsPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlertsPdfExportModal: React.FC<AlertsPdfExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { alerts, exportPeriod, setExportPeriod } = useAlertStore();
  const [generating, setGenerating] = useState(false);
  const [includeActive, setIncludeActive] = useState(true);
  const [includeDismissed, setIncludeDismissed] = useState(true);

  const handleExport = async () => {
    const filtered = alerts.filter((a) => {
      if (a.status === "active" && !includeActive) return false;
      if (a.status === "acquittee" && !includeDismissed) return false;
      // Filtre par période sur la date de création
      if (a.created_at < exportPeriod.from) return false;
      if (a.created_at > exportPeriod.to + "T23:59:59Z") return false;
      return true;
    });

    if (filtered.length === 0) {
      toast.warning("Aucune alerte dans la période sélectionnée.");
      return;
    }

    setGenerating(true);
    try {
      await generateAlertsPdf(
        filtered,
        exportPeriod.from,
        exportPeriod.to
      );
      toast.success(`PDF généré — ${filtered.length} alerte(s) exportée(s)`);
      onClose();
    } catch (err) {
      console.error("Erreur génération PDF alertes:", err);
      toast.error("Erreur lors de la génération du PDF.");
    } finally {
      setGenerating(false);
    }
  };

  // Compte les alertes dans la période sélectionnée
  const alertsInPeriod = alerts.filter((a) => {
    if (a.status === "active" && !includeActive) return false;
    if (a.status === "acquittee" && !includeDismissed) return false;
    if (a.created_at < exportPeriod.from) return false;
    if (a.created_at > exportPeriod.to + "T23:59:59Z") return false;
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <FileDown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Exporter le rapport PDF</h3>
                  <p className="text-[10px] text-muted-foreground">Alertes actives et/ou acquittées</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-5 space-y-5">
              {/* Sélection de la période */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Période de rapport
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-medium">Du</label>
                    <input
                      type="date"
                      value={exportPeriod.from}
                      onChange={(e) => setExportPeriod(e.target.value, exportPeriod.to)}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-medium">Au</label>
                    <input
                      type="date"
                      value={exportPeriod.to}
                      onChange={(e) => setExportPeriod(exportPeriod.from, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Options d'inclusion */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Inclure dans le rapport</p>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeActive}
                    onChange={(e) => setIncludeActive(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground">Alertes actives</p>
                    <p className="text-[10px] text-muted-foreground">Alertes non encore traitées</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                    {alerts.filter((a) => a.status === "active").length}
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeDismissed}
                    onChange={(e) => setIncludeDismissed(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <div>
                    <p className="text-xs font-medium text-foreground">Alertes acquittées</p>
                    <p className="text-[10px] text-muted-foreground">Historique des alertes traitées</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                    {alerts.filter((a) => a.status === "acquittee").length}
                  </span>
                </label>
              </div>

              {/* Aperçu du nombre d'alertes */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <p className="text-xs text-muted-foreground">
                  Alertes à exporter :{" "}
                  <span className="font-bold text-primary text-sm">{alertsInPeriod.length}</span>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-secondary text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleExport}
                disabled={generating || alertsInPeriod.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération…
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Exporter ({alertsInPeriod.length})
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
