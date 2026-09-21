import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { X, Printer, Tag } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { useStockStore } from "@/store/stockStore";

export const QrLabelModal: React.FC = () => {
  const { isQrLabelModalOpen, articleForQrLabel, closeQrLabelModal } =
    useStockStore();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const labelRef = useRef<HTMLDivElement>(null);

  const article = articleForQrLabel;

  useEffect(() => {
    if (article && article.variants.length > 0) {
      setSelectedVariantId(article.variants[0].id);
    }
  }, [article]);

  const selectedVariant = article?.variants.find(
    (v) => v.id === selectedVariantId
  ) || article?.variants[0];

  useEffect(() => {
    if (article && selectedVariant) {
      const payload = JSON.stringify({
        ref: article.reference,
        name: article.name,
        barcode: selectedVariant.barcode,
        size: selectedVariant.size,
        price_cents: article.rental_price_cents,
        boutique: "Atelier Prestige Paris",
      });

      QRCode.toDataURL(payload, {
        width: 280,
        margin: 2, // Marge blanche de sécurité (quiet zone)
        errorCorrectionLevel: "M", // Niveau de correction d'erreur M (15% de redondance)
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("Erreur génération QR Code:", err));
    }
  }, [article, selectedVariant]);

  if (!isQrLabelModalOpen || !article) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              Étiquette QR Code Imprimable
            </h3>
          </div>
          <button
            onClick={closeQrLabelModal}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Sélection de la déclinaison */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Sélectionner la déclinaison (Taille & Exemplaire) :
            </label>
            <div className="flex flex-wrap gap-2">
              {article.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                    selectedVariant?.id === v.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-secondary/60 border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  Taille {v.size} ({v.barcode})
                </button>
              ))}
            </div>
          </div>

          {/* Prévisualisation de l'étiquette physique */}
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Format thermique / étiquette 60mm × 80mm
            </span>

            {/* Étiquette format impression */}
            <div
              ref={labelRef}
              id="printable-label"
              className="w-72 p-4 bg-white text-slate-950 rounded-xl shadow-lg border-2 border-slate-900 flex flex-col items-center text-center select-none"
            >
              {/* Header étiquette */}
              <div className="w-full pb-2 border-b border-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-900" />
                  <span className="font-extrabold text-[11px] tracking-wider uppercase">
                    ATELIER PRESTIGE
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-500">PARIS</span>
              </div>

              {/* Titre & Modèle */}
              <div className="py-2 w-full">
                <p className="text-[10px] uppercase font-bold text-slate-600">
                  {article.brand}
                </p>
                <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                  {article.name}
                </h4>
                <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                  Réf: {article.reference}
                </p>
              </div>

              {/* QR Code image */}
              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm my-1">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-36 h-36 object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-400">
                    Génération...
                  </div>
                )}
              </div>

              {/* Détail variante & prix */}
              <div className="w-full pt-2 border-t border-slate-300 flex items-center justify-between">
                <div className="text-left">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                    TAILLE
                  </span>
                  <span className="font-black text-sm text-slate-900 font-mono">
                    {selectedVariant?.size}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                    CODE-BARRE
                  </span>
                  <span className="font-mono text-[9px] font-bold text-slate-700">
                    {selectedVariant?.barcode}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">
                    LOCATION
                  </span>
                  <span className="font-black text-xs text-amber-700">
                    {formatCents(article.rental_price_cents)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
          <button
            onClick={closeQrLabelModal}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer l'étiquette</span>
          </button>
        </div>
      </div>
    </div>
  );
};
