import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  CreditCard,
  FileCheck2,
  X,
  Coins,
  CheckCircle2,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { useCaisseStore } from "@/store/caisseStore";
import { formatCents } from "@/lib/utils";
import type { CaissePaymentMethod, DirectSale } from "@/types/caisse";
import { toast } from "sonner";

interface CaissePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sale: DirectSale) => void;
}

export const CaissePaymentModal: React.FC<CaissePaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { cart, selectedCustomer, processDirectSale } = useCaisseStore();

  const totalAmountCents = useMemo(
    () => cart.reduce((sum, item) => sum + item.subtotal_cents, 0),
    [cart]
  );

  const [method, setMethod] = useState<CaissePaymentMethod>("especes");

  // Espèces
  const [cashReceivedInput, setCashReceivedInput] = useState<string>(
    (totalAmountCents / 100).toString()
  );

  // CB
  const [cardRef, setCardRef] = useState<string>("");

  // Chèque
  const [chequeNum, setChequeNum] = useState<string>("");
  const [bankName, setBankName] = useState<string>("");

  // Notes
  const [notes, setNotes] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  // Calcul du montant reçu en DA et de la monnaie
  const cashReceivedDA = Math.round(parseFloat(cashReceivedInput || "0"));
  const changeReturnedDA = cashReceivedDA - totalAmountCents;
  const isCashSufficient = method !== "especes" || changeReturnedDA >= 0;

  // Raccourcis pour espèces en Dinars Algériens (DA)
  const handleQuickCash = (amountDA: number) => {
    setCashReceivedInput(amountDA.toString());
  };

  const handleExactCash = () => {
    setCashReceivedInput(totalAmountCents.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCashSufficient) {
      toast.error("Le montant remis est inférieur au total dû.");
      return;
    }

    try {
      setIsProcessing(true);

      const paymentDetails = {
        method,
        amount_paid_cents: totalAmountCents,
        cash_received_cents: method === "especes" ? cashReceivedDA : undefined,
        change_returned_cents: method === "especes" ? Math.max(0, changeReturnedDA) : undefined,
        transaction_ref:
          method === "carte_bancaire"
            ? cardRef.trim() || `CB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`
            : undefined,
        cheque_number: method === "cheque" ? chequeNum.trim() || "CHQ-COMPTOIR" : undefined,
        bank_name: method === "cheque" ? bankName.trim() : undefined,
      };

      const sale = await processDirectSale(paymentDetails, notes);
      toast.success(`Vente ${sale.sale_number} enregistrée avec succès !`);
      setIsProcessing(false);
      onClose();
      onSuccess(sale);
    } catch (err: unknown) {
      setIsProcessing(false);
      const msg = err instanceof Error ? err.message : "Erreur lors de la validation";
      toast.error(msg);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/15 text-primary">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Encaissement de la Vente
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {selectedCustomer ? `Client : ${selectedCustomer.name}` : "Client Comptoir (Passage)"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Montant Total Dû */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Total TTC à Encaisser
                </span>
                <span className="text-2xl font-black text-primary font-mono">
                  {formatCents(totalAmountCents)}
                </span>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <span>{cart.length} ligne{cart.length > 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Onglets Modes de Paiement */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Mode de règlement :
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("especes")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${
                    method === "especes"
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span>Espèces</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("carte_bancaire")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${
                    method === "carte_bancaire"
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Carte Bancaire</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("cheque")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold gap-1.5 transition-all ${
                    method === "cheque"
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <FileCheck2 className="w-5 h-5" />
                  <span>Chèque</span>
                </button>
              </div>
            </div>

            {/* Panneau Spécifique : Espèces & Rendu de Monnaie */}
            {method === "especes" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-secondary/40 border border-border space-y-3"
              >
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Montant remis par le client (DA) :
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={cashReceivedInput}
                      onChange={(e) => setCashReceivedInput(e.target.value)}
                      className="w-full h-11 px-3 text-lg font-bold font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">
                      DA
                    </span>
                  </div>
                </div>

                {/* Coupures Rapides */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleExactCash}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold bg-background border border-border hover:border-primary text-foreground"
                  >
                    Exact
                  </button>
                  {[1000, 2000, 5000, 10000, 20000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickCash(amt)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-background border border-border hover:border-primary text-foreground"
                    >
                      {amt.toLocaleString("fr-FR")} DA
                    </button>
                  ))}
                </div>

                {/* Encadré Monnaie à Rendre */}
                <div
                  className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                    isCashSufficient
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCashSufficient ? (
                      <Coins className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <span className="text-xs font-semibold block">
                        {isCashSufficient ? "Monnaie à Rendre" : "Montant Insuffisant"}
                      </span>
                      <span className="text-[11px] opacity-80">
                        {isCashSufficient
                          ? "À restituer au client"
                          : `Il manque ${formatCents(Math.abs(changeReturnedDA))}`}
                      </span>
                    </div>
                  </div>

                  <span className="text-xl font-black font-mono">
                    {formatCents(Math.max(0, changeReturnedDA))}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Panneau Spécifique : Carte Bancaire */}
            {method === "carte_bancaire" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2.5"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>Terminal TPE prêt pour le paiement sans contact ou puce.</span>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Référence transaction / N° d'autorisation (optionnel) :
                  </label>
                  <input
                    type="text"
                    value={cardRef}
                    onChange={(e) => setCardRef(e.target.value)}
                    placeholder="Ex: CB-98231 ou généré automatiquement"
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </motion.div>
            )}

            {/* Panneau Spécifique : Chèque */}
            {method === "cheque" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2.5"
              >
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Numéro de chèque :
                  </label>
                  <input
                    type="text"
                    value={chequeNum}
                    onChange={(e) => setChequeNum(e.target.value)}
                    placeholder="Ex: 7891234"
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Banque émettrice :
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Ex: BNP Paribas, Crédit Agricole..."
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </motion.div>
            )}

            {/* Notes optionnelles */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Remarques / Notes internes (optionnel) :
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Paquet cadeau offert, client régulier..."
                className="w-full h-8 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!isCashSufficient || isProcessing}
                className="flex-[2] py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isProcessing ? "Validation en cours..." : "Valider & Imprimer Ticket"}
                </span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
