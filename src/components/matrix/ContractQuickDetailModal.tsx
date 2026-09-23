import React from "react";
import {
  X,
  FileText,
  User,
  Phone,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useRentalStore } from "@/store/rentalStore";
import { formatCents } from "@/lib/utils";

interface ContractQuickDetailModalProps {
  contractIdOrCode: string | null;
  onClose: () => void;
}

export const ContractQuickDetailModal: React.FC<ContractQuickDetailModalProps> = ({
  contractIdOrCode,
  onClose,
}) => {
  const { contracts, setPdfPreviewModalOpen } = useRentalStore();

  if (!contractIdOrCode) return null;

  // Recherche du contrat par ID ou par Numéro de contrat
  const contract = contracts.find(
    (c) =>
      c.id === contractIdOrCode ||
      c.contract_number.toLowerCase() === contractIdOrCode.toLowerCase()
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "en_cours":
        return {
          label: "En cours de location",
          className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
          icon: Clock,
        };
      case "reserve":
        return {
          label: "Réservation confirmée",
          className: "bg-blue-500/10 text-blue-500 border-blue-500/30",
          icon: Calendar,
        };
      case "en_retard":
        return {
          label: "En retard de restitution",
          className: "bg-red-500/10 text-red-500 border-red-500/30",
          icon: AlertTriangle,
        };
      case "retourne":
        return {
          label: "Restitué / Clôturé",
          className: "bg-slate-500/10 text-slate-400 border-slate-500/30",
          icon: CheckCircle2,
        };
      default:
        return {
          label: status,
          className: "bg-muted text-muted-foreground border-border",
          icon: Clock,
        };
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 id="contract-modal-title" className="text-sm font-bold text-foreground">
                Fiche Contrat {contract ? contract.contract_number : contractIdOrCode}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Détail de la réservation issue de la matrice
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-5 space-y-4 text-xs">
          {contract ? (
            <>
              {/* Statut et Réf */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Numéro de Contrat
                  </span>
                  <div className="font-mono font-bold text-sm text-foreground">
                    {contract.contract_number}
                  </div>
                </div>

                {(() => {
                  const badge = getStatusBadge(contract.status);
                  const Icon = badge.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.className}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>
                  );
                })()}
              </div>

              {/* Informations Client */}
              <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Client Titulaire
                </span>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <User className="w-4 h-4 text-primary shrink-0" />
                  <span>{contract.customer_name}</span>
                </div>
                {contract.customer_phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{contract.customer_phone}</span>
                  </div>
                )}
              </div>

              {/* Dates & Période */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    Départ / Retrait prévu
                  </span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {contract.pickup_date}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">
                    Restitution prévue
                  </span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {contract.return_date_scheduled}
                  </div>
                </div>
              </div>

              {/* Articles loués */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Articles du Contrat ({contract.items.length})
                </span>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {contract.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-secondary/40 border border-border flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <div className="font-medium text-foreground">{item.article_name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Taille : {item.size} • Code-barre : {item.barcode}
                        </div>
                      </div>
                      <div className="font-mono font-semibold">
                        {formatCents(item.unit_price_cents)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Montants */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground">Montant Total TTC : </span>
                  <span className="font-bold text-foreground">
                    {formatCents(contract.total_amount_cents)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Caution : </span>
                  <span className="font-bold text-foreground">
                    {formatCents(contract.deposit_amount_cents)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-muted-foreground space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <p>
                Le contrat référencé <strong>{contractIdOrCode}</strong> n'a pas pu être chargé
                en mémoire locale.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Fermer
          </button>

          {contract && (
            <button
              type="button"
              onClick={() => {
                onClose();
                setPdfPreviewModalOpen(true, contract);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ouvrir Bon de Location (PDF)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
