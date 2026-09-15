import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, X, Search, AlertCircle, Sparkles } from "lucide-react";
import { useStockStore } from "@/store/stockStore";
import { useCaisseStore } from "@/store/caisseStore";
import { toast } from "sonner";
import { formatCents } from "@/lib/utils";

interface ScanQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScanQrModal: React.FC<ScanQrModalProps> = ({ isOpen, onClose }) => {
  const [scannedCode, setScannedCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { articles } = useStockStore();
  const { addToCart } = useCaisseStore();

  if (!isOpen) return null;

  const handleScan = (codeToTest?: string) => {
    const code = (codeToTest || scannedCode).trim().toUpperCase();
    if (!code) {
      setErrorMsg("Veuillez saisir un code-barre ou scanner un QR code.");
      return;
    }

    setErrorMsg(null);

    // 1. Recherche d'abord par barcode de variante
    for (const article of articles) {
      const variantMatch = article.variants.find(
        (v) => v.barcode.toUpperCase() === code
      );
      if (variantMatch) {
        addToCart(article, variantMatch);
        toast.success(`Ajouté au panier : ${article.name} (${variantMatch.size})`, {
          description: `Code : ${variantMatch.barcode} • ${formatCents(
            article.sale_price_cents || article.rental_price_cents
          )}`,
        });
        setScannedCode("");
        onClose();
        return;
      }
    }

    // 2. Recherche par référence d'article
    const articleMatch = articles.find(
      (a) =>
        a.reference.toUpperCase() === code ||
        a.id.toUpperCase() === code ||
        a.name.toUpperCase().includes(code)
    );

    if (articleMatch) {
      const defaultVariant = articleMatch.variants.find((v) => v.status === "disponible") || articleMatch.variants[0];
      addToCart(articleMatch, defaultVariant);
      toast.success(`Ajouté au panier : ${articleMatch.name}`, {
        description: `Réf : ${articleMatch.reference} • ${formatCents(
          articleMatch.sale_price_cents || articleMatch.rental_price_cents
        )}`,
      });
      setScannedCode("");
      onClose();
      return;
    }

    setErrorMsg(`Aucun article ne correspond au code "${code}".`);
  };

  const sampleCodes = [
    { label: "Nœud Papillon Soie (TU)", code: "BAR-ACC-018-U", price: "2 500 DA" },
    { label: "Richelieu Bout Droit (42)", code: "BAR-CHS-013-42", price: "12 000 DA" },
    { label: "Smoking Noir (T.48)", code: "BAR-SMK-001-48", price: "8 000 DA" },
    { label: "Costume 3P Royal (T.52)", code: "BAR-CST-005-52", price: "6 500 DA" },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* En-tête */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/15 text-primary">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Scanner Code QR / Code-Barre
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Douchette USB, caméra ou saisie manuelle de référence
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

          <div className="p-5 space-y-4">
            {/* Visualisation Scanner */}
            <div className="relative border-2 border-dashed border-primary/40 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-primary/5 group">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform">
                <QrCode className="w-8 h-8 animate-pulse" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Prêt pour la douchette scanner
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Pointez le lecteur optique sur l'étiquette de l'article
              </p>
            </div>

            {/* Champ de saisie manuelle */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScan();
              }}
              className="space-y-2"
            >
              <label className="text-xs font-medium text-foreground">
                Ou entrez le code / référence manuellement :
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    autoFocus
                    value={scannedCode}
                    onChange={(e) => setScannedCode(e.target.value)}
                    placeholder="Ex: BAR-ACC-018-U ou SMK-NOIR-01"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 h-10 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Valider
                </button>
              </div>
            </form>

            {errorMsg && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Raccourcis de simulation de scan rapide */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Codes d'articles prêts à scanner pour démo :</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {sampleCodes.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleScan(item.code)}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-left transition-all hover:border-primary/50 group"
                  >
                    <div className="text-[11px] font-medium text-foreground truncate group-hover:text-primary">
                      {item.label}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-mono text-primary/80">{item.code}</span>
                      <span className="font-semibold text-foreground">{item.price}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
