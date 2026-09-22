import React, { useState, useEffect } from "react";
import { X, CreditCard, Receipt } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { useRentalStore } from "@/store/rentalStore";
import type { RentalContract } from "@/types/rental";
import { toast } from "sonner";

interface RentalPaymentModalProps {
  contract: RentalContract | null;
  onClose: () => void;
}

export const RentalPaymentModal: React.FC<RentalPaymentModalProps> = ({
  contract,
  onClose,
}) => {
  const { recordContractPayment } = useRentalStore();

  const [paymentType, setPaymentType] = useState<"solde" | "caution" | "frais_retard" | "degradation">("solde");
  const [paymentMethod, setPaymentMethod] = useState<string>("carte_bancaire");
  const [amountInput, setAmountInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (contract) {
      if (contract.remaining_amount_cents > 0) {
        setPaymentType("solde");
        setAmountInput(contract.remaining_amount_cents.toString());
      } else {
        setPaymentType("caution");
        setAmountInput(contract.deposit_amount_cents.toString());
      }
      setNotes("");
    }
  }, [contract]);

  if (!contract) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountDA = parseInt(amountInput, 10);
    if (isNaN(amountDA) || amountDA <= 0) {
      toast.error("Veuillez saisir un montant strictement positif.");
      return;
    }

    try {
      setIsSubmitting(true);
      await recordContractPayment(
        contract.id,
        amountDA,
        paymentType,
        paymentMethod,
        notes.trim() || undefined
      );
      toast.success(`Paiement de ${formatCents(amountDA)} enregistré avec succès.`);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erreur lors de l'enregistrement du paiement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Règlement sur Contrat {contract.contract_number}
              </h2>
              <p className="text-xs text-muted-foreground">
                Client : {contract.customer_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Situation financière du contrat */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border border-border text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total TTC</span>
              <span className="font-bold text-foreground">{formatCents(contract.total_amount_cents)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Déjà Réglé</span>
              <span className="font-bold text-emerald-600">{formatCents(contract.paid_amount_cents)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Reste Dû</span>
              <span className="font-bold text-red-500">{formatCents(contract.remaining_amount_cents)}</span>
            </div>
          </div>

          {/* Type de règlement */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Type d'encaissement</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentType("solde");
                  setAmountInput(contract.remaining_amount_cents.toString());
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
                  paymentType === "solde"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                Règlement du Solde
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentType("caution");
                  setAmountInput(contract.deposit_amount_cents.toString());
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
                  paymentType === "caution"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                }`}
              >
                Encaissement Caution
              </button>
            </div>
          </div>

          {/* Moyen de paiement */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Moyen de paiement</label>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { id: "especes", label: "Espèces" },
                { id: "carte_bancaire", label: "Carte" },
                { id: "cheque", label: "Chèque" },
                { id: "virement", label: "Virement" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`py-1.5 px-2 rounded-md font-medium border text-center transition-all ${
                    paymentMethod === m.id
                      ? "bg-foreground text-background border-foreground font-semibold"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Montant encaissé */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Montant (en DA)</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="Ex: 5000"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                required
              />
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">DA</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Notes / Référence (optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Rendu de monnaie ok, transaction CB #4502"
              className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Enregistrement..." : "Valider le règlement"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
