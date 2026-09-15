/**
 * Module E — DismissAlertDialog
 * Modal d'acquittement d'une alerte avec commentaire obligatoire.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";
import type { AppAlert } from "@/types/alert";

interface DismissAlertDialogProps {
  isOpen: boolean;
  alert: AppAlert | null;
  onConfirm: (alertId: string, comment: string) => void;
  onClose: () => void;
}

export const DismissAlertDialog: React.FC<DismissAlertDialogProps> = ({
  isOpen,
  alert,
  onConfirm,
  onClose,
}) => {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (!alert) return;
    if (comment.trim().length < 5) {
      setError("Le commentaire doit contenir au moins 5 caractères.");
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

  // Suggestions de commentaires rapides selon la catégorie
  const quickComments: Record<string, string[]> = {
    retard_retour: [
      "Client contacté par téléphone, retour confirmé.",
      "Pénalité appliquée et encaissée.",
      "Accord amiable trouvé — retour prévu demain.",
    ],
    retour_jour_j: [
      "Retour confirmé par le client.",
      "Client en route pour restituer l'article.",
    ],
    retour_j1: [
      "SMS de rappel envoyé au client.",
      "Client informé par téléphone.",
    ],
    retour_j2: [
      "SMS de rappel envoyé.",
      "Rappel email adressé.",
    ],
    retour_j3: [
      "Rappel planifié pour J-1.",
      "Client préparé au retour.",
    ],
    stock_bas: [
      "Commande de restockage passée au fournisseur.",
      "Stock en cours de réception.",
      "Article en réparation — disponible bientôt.",
    ],
    article_inactif: [
      "Article repositionné en vitrine.",
      "Promotion lancée sur cet article.",
      "Article retiré du catalogue temporairement.",
    ],
  };

  const suggestions = alert ? (quickComments[alert.category] ?? []) : [];

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
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Acquitter l'alerte</h3>
                  <p className="text-[10px] text-muted-foreground">Un commentaire est requis</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            <div className="p-5 space-y-4">
              {/* Récapitulatif de l'alerte */}
              <div className="p-3 rounded-lg bg-secondary/60 border border-border text-xs space-y-1">
                <p className="font-semibold text-foreground truncate">{alert.title}</p>
                <p className="text-muted-foreground">{alert.description}</p>
              </div>

              {/* Avertissement */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  L'acquittement est tracé dans le journal. L'alerte restera visible dans
                  l'historique avec votre commentaire.
                </p>
              </div>

              {/* Suggestions rapides */}
              {suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Suggestions rapides
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setComment(s);
                          setError("");
                        }}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Champ commentaire */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Commentaire d'acquittement{" "}
                  <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Décrivez l'action prise pour résoudre cette alerte…"
                  className="w-full h-24 px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
                  autoFocus
                />
                {error && (
                  <p className="text-[10px] text-red-400 font-medium">{error}</p>
                )}
                <p className="text-[10px] text-muted-foreground text-right">
                  {comment.length} caractères (min 5)
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-5 pt-0">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-secondary text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={comment.trim().length < 5}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmer l'acquittement
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
