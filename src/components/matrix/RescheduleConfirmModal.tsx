import React, { useState } from "react";
import {
  Calendar,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  Shirt,
  RefreshCw,
} from "lucide-react";
import type { PendingRescheduleProposal } from "@/types/matrix";

interface RescheduleConfirmModalProps {
  proposal: PendingRescheduleProposal;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export const RescheduleConfirmModal: React.FC<RescheduleConfirmModalProps> = ({
  proposal,
  onConfirm,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDifferentVariant =
    proposal.sourceRow.variante_id !== proposal.targetRow.variante_id;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 id="reschedule-modal-title" className="text-sm font-bold text-foreground">
                Confirmer la reprogrammation
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Déplacement de créneau par glisser-déposer
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4 text-xs">
          {/* Contrat ciblé */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Contrat concerné
              </span>
              <div className="font-mono font-bold text-sm text-foreground">
                {proposal.slot.reference_code || proposal.slot.reference_id}
              </div>
            </div>
            {proposal.slot.client_nom && (
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Client
                </span>
                <div className="font-semibold text-foreground">
                  {proposal.slot.client_nom}
                </div>
              </div>
            )}
          </div>

          {/* Déplacement de Dates */}
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Changement de Période ({proposal.durationDays} jours)</span>
            </span>

            <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-card border border-border text-center flex-1">
                <div className="text-[10px] text-muted-foreground font-sans">Initiales</div>
                <div className="font-semibold text-foreground mt-0.5">
                  {proposal.slot.date_debut}
                </div>
                <div className="text-[10px] text-muted-foreground">au {proposal.slot.date_fin}</div>
              </div>

              <ArrowRight className="w-4 h-4 text-primary shrink-0" />

              <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 text-center flex-1">
                <div className="text-[10px] text-primary font-sans font-bold">Nouvelles</div>
                <div className="font-bold text-primary mt-0.5">
                  {proposal.newStartDate}
                </div>
                <div className="text-[10px] text-primary font-medium">au {proposal.newEndDate}</div>
              </div>
            </div>
          </div>

          {/* Déplacement de Pièce / Variante (si changement vertical) */}
          {isDifferentVariant && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <span className="text-[10px] text-amber-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5" />
                <span>Changement de Variante Physique</span>
              </span>

              <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
                <div className="flex-1 truncate">
                  <div className="text-[10px] text-muted-foreground">Pièce d'origine :</div>
                  <div className="font-semibold text-foreground truncate">
                    {proposal.sourceRow.article_nom}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    T.{proposal.sourceRow.taille} • {proposal.sourceRow.reference}
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />

                <div className="flex-1 truncate text-right">
                  <div className="text-[10px] text-amber-500 font-bold">Nouvelle pièce :</div>
                  <div className="font-bold text-foreground truncate">
                    {proposal.targetRow.article_nom}
                  </div>
                  <div className="text-[10px] text-amber-500 font-mono">
                    T.{proposal.targetRow.taille} • {proposal.targetRow.reference}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Avertissement de sécurité */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted text-[11px] text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              La disponibilité sera immédiatement revalidée sous transaction sécurisée en base SQLite.
              Le tampon pressing sera recalculé à l'issue de cette nouvelle date de retour.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmer le déplacement</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
