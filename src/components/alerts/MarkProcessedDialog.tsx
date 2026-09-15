import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, X, AlertCircle } from "lucide-react";
import type { AppAlert } from "@/types/alert";

interface MarkProcessedDialogProps {
  isOpen: boolean;
  alert: AppAlert | null;
  onConfirm: (alertId: string, comment: string) => void;
  onClose: () => void;
}

export const MarkProcessedDialog: React.FC<MarkProcessedDialogProps> = ({
  isOpen,
  alert,
  onConfirm,
  onClose,
}) => {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!alert) return;
    if (comment.trim().length < 4) {
      setError("Veuillez saisir une note de traitement (min. 4 caractères).");
      return;
    }
    onConfirm(alert.id, comment.trim());
    setComment("");
    setError("");
  };

  const handleClose = () => {
    setComment("");
    setError("");
    onClose();
  };

  const quickActions = [
    "Client contacté par téléphone - retour prévu demain",
    "Relance SMS envoyée au client",
    "Pénalités appliquées et validées avec le client",
    "Article vérifié en atelier",
    "Stock réajusté",
  ];

  return (
    <AnimatePresence>
      {isOpen && alert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                  <CheckCheck className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Marquer comme traitée</h3>
                  <p className="text-[10px] text-muted-foreground">Conserve l'alerte dans l'historique tracé</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border text-xs">
                <p className="font-semibold text-foreground">{alert.title}</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">{alert.description}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Suggestions de résolution rapide
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => {
                        setComment(action);
                        setError("");
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-md bg-secondary text-foreground hover:bg-primary/15 hover:text-primary transition-all text-left"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Action réalisée / Note de suivi <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Ex: Client eu au téléphone, retour confirmé ce jour à 18h..."
                  className="w-full h-24 px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
                {error && <p className="text-[10px] text-red-400 font-medium">{error}</p>}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-secondary/30 p-2.5 rounded-lg border border-border">
                <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                <span>L'alerte sera marquée "Traitée" avec votre nom et horodatage sans être supprimée.</span>
              </div>
            </div>

            <div className="flex gap-3 p-5 pt-0">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 rounded-xl border border-border bg-secondary text-xs font-medium hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
              >
                Valider le traitement
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
