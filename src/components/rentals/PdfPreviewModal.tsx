import React, { useEffect, useState } from "react";
import {
  X,
  Printer,
  Download,
  FileText,
  Copy,
  Check,
  FolderArchive,
} from "lucide-react";
import { useRentalStore } from "@/store/rentalStore";
import {
  generateRentalContractPdf,
  type GeneratedPdfResult,
} from "@/services/pdfService";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export const PdfPreviewModal: React.FC = () => {
  const { isPdfPreviewModalOpen, selectedContractForPdf, setPdfPreviewModalOpen } =
    useRentalStore();

  const [pdfResult, setPdfResult] = useState<GeneratedPdfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isPdfPreviewModalOpen && selectedContractForPdf) {
      setLoading(true);
      generateRentalContractPdf(selectedContractForPdf)
        .then((res) => {
          setPdfResult(res);
          setLoading(false);
        })
        .catch((err) => {
          logger.error("PdfPreviewModal: Erreur génération PDF contrat", err);
          toast.error("Erreur lors de la génération du PDF.");
          setLoading(false);
        });
    } else {
      setPdfResult(null);
    }
  }, [isPdfPreviewModalOpen, selectedContractForPdf]);

  if (!isPdfPreviewModalOpen || !selectedContractForPdf) return null;

  const contract = selectedContractForPdf;

  const handleCopyPath = () => {
    if (pdfResult) {
      navigator.clipboard.writeText(pdfResult.archivedPath);
      setCopied(true);
      toast.success("Chemin d'archivage copié dans le presse-papier.");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[92vh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header Prévisualisation PDF */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <FileText className="w-4 h-4 text-primary" />
            <span>
              Bon de Location Officiel — {contract.contract_number} (2 exemplaires : Boutique & Client)
            </span>
          </div>

          {/* Actions : Imprimer & Télécharger */}
          <div className="flex items-center gap-2">
            {pdfResult && (
              <>
                <button
                  type="button"
                  onClick={pdfResult.download}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-primary" />
                  <span>Télécharger</span>
                </button>

                <button
                  type="button"
                  onClick={pdfResult.print}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer en 1 clic</span>
                </button>
              </>
            )}

            <button
              onClick={() => setPdfPreviewModalOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barre d'archivage automatique */}
        <div className="h-9 px-6 bg-secondary/30 border-b border-border flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-3.5 h-3.5 text-primary" />
            <span>Archivage automatique :</span>
            <span className="font-mono text-[11px] text-foreground font-semibold">
              {pdfResult?.archivedPath || `/bons/2026-09/BON-${contract.contract_number}.pdf`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyPath}
            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? "Copié !" : "Copier le chemin"}</span>
          </button>
        </div>

        {/* Corps Visualiseur PDF */}
        <div className="flex-1 bg-muted/60 p-4 flex items-center justify-center overflow-hidden">
          {loading ? (
            <div className="text-center space-y-2 text-xs text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Génération du bon officiel en 2 exemplaires...</p>
            </div>
          ) : pdfResult ? (
            <iframe
              src={pdfResult.blobUrl}
              className="w-full h-full rounded-xl border border-border bg-white shadow-md"
              title="Aperçu Bon de Location PDF"
            />
          ) : (
            <div className="text-xs text-red-400">
              Impossible de charger le document PDF.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
