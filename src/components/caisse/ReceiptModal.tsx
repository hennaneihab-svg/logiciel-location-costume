import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, Download, X, CheckCircle2 } from "lucide-react";
import type { DirectSale } from "@/types/caisse";
import { generateReceiptPdf, GeneratedPdfReceiptResult } from "@/services/receiptPdfService";
import { formatCents } from "@/lib/utils";
import { toast } from "sonner";

interface ReceiptModalProps {
  isOpen: boolean;
  sale: DirectSale | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, sale, onClose }) => {
  const [pdfResult, setPdfResult] = useState<GeneratedPdfReceiptResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isOpen && sale) {
      setIsGenerating(true);
      generateReceiptPdf(sale)
        .then((res) => {
          setPdfResult(res);
          setIsGenerating(false);
        })
        .catch((err) => {
          console.error("Erreur génération ticket PDF:", err);
          setIsGenerating(false);
        });
    } else {
      setPdfResult(null);
    }
  }, [isOpen, sale]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    if (pdfResult) {
      pdfResult.print();
      toast.success("Impression lancée");
    }
  };

  const handleDownload = () => {
    if (pdfResult) {
      pdfResult.download();
      toast.success("Ticket téléchargé");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Vente Encaissée avec Succès
                </h3>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {sale.sale_number}
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

          {/* Ticket Visuel */}
          <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center">
            <div className="w-full max-w-xs bg-white text-slate-900 rounded-xl p-5 shadow-inner border border-slate-200 font-sans text-xs space-y-3">
              {/* Entête */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-extrabold text-sm tracking-wider text-amber-600">
                  ATELIER PRESTIGE
                </h4>
                <p className="text-[10px] text-slate-500">
                  14 Rue de la Paix, 75002 Paris
                </p>
                <p className="text-[9px] text-slate-400">SIRET 849 201 938 00012</p>
              </div>

              {/* Infos Vente */}
              <div className="text-[11px] space-y-0.5 text-slate-600">
                <div className="flex justify-between font-mono font-bold text-slate-800">
                  <span>{sale.sale_number}</span>
                  <span>
                    {new Date(sale.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Vendeur :</span>
                  <span>{sale.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Client :</span>
                  <span className="font-medium text-slate-800">{sale.customer_name}</span>
                </div>
              </div>

              {/* Lignes d'articles */}
              <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1">
                {sale.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-start text-[11px]">
                    <div className="flex-1 pr-2">
                      <div className="font-medium text-slate-800 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.quantity} x {formatCents(item.unit_price_cents)}
                      </div>
                    </div>
                    <div className="font-bold font-mono text-slate-800">
                      {formatCents(item.subtotal_cents)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totaux */}
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between text-[11px]">
                  <span>Total HT :</span>
                  <span className="font-mono">
                    {formatCents(sale.total_amount_cents - sale.tax_amount_cents)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>TVA (20%) :</span>
                  <span className="font-mono">{formatCents(sale.tax_amount_cents)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-300">
                  <span>TOTAL TTC :</span>
                  <span className="font-mono">{formatCents(sale.total_amount_cents)}</span>
                </div>
              </div>

              {/* Mode de règlement & Rendu */}
              <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[10px] space-y-0.5">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>Règlement :</span>
                  <span className="capitalize">{sale.payment.method.replace("_", " ")}</span>
                </div>
                {sale.payment.cash_received_cents !== undefined && (
                  <>
                    <div className="flex justify-between text-slate-500">
                      <span>Montant remis :</span>
                      <span>{formatCents(sale.payment.cash_received_cents)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-600">
                      <span>Monnaie rendue :</span>
                      <span>{formatCents(sale.payment.change_returned_cents || 0)}</span>
                    </div>
                  </>
                )}
                {sale.payment.transaction_ref && (
                  <div className="flex justify-between text-slate-500">
                    <span>Réf :</span>
                    <span className="font-mono">{sale.payment.transaction_ref}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="text-center text-[9px] text-slate-400 pt-1">
                Merci de votre visite et à bientôt !
              </div>
            </div>
          </div>

          {/* Boutons d'actions */}
          <div className="p-4 border-t border-border bg-muted/20 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isGenerating || !pdfResult}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer le Ticket</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isGenerating || !pdfResult}
                className="px-3.5 py-2.5 rounded-xl border border-border bg-secondary/50 text-foreground hover:bg-secondary text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                title="Télécharger le ticket PDF"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
            >
              Nouvelle Vente
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
