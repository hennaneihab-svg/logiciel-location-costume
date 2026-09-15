import React from "react";
import { motion } from "framer-motion";
import { FileBarChart, Download, FileText } from "lucide-react";

export const RapportsPage: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Module H — Rapports & Exports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bilan d'activité, registre des mouvements de caisse, TVA et valorisation de l'inventaire
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Rapport Financier Mensuel",
            desc: "Synthèse des revenus de location, acomptes perçus et ventes directes.",
            type: "PDF & Excel",
          },
          {
            title: "Journal de Caisse & Règlements",
            desc: "Détail de toutes les écritures comptables par mode de paiement.",
            type: "CSV / Excel",
          },
          {
            title: "Valorisation du Parc de Stock",
            desc: "État du stock complet, taux d'usure, amortissements et coûts de pressing.",
            type: "Export CSV",
          },
        ].map((item, idx) => (
          <div key={idx} className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FileBarChart className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {item.type}
                </span>
              </div>
              <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
              <button className="flex-1 py-1.5 px-3 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:bg-muted flex items-center justify-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Aperçu
              </button>
              <button className="py-1.5 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Exporter
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
