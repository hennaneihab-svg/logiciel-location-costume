import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Eye } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { StockArticle, StockVariant } from "@/types/stock";
import { useStockStore } from "@/store/stockStore";

interface StockCardProps {
  article: StockArticle;
}

// Configuration des statuts colorés imposés par le cahier des charges :
// Disponible=vert, Loué=orange, Réservé=bleu, Nettoyage/Réparation=gris, Hors service=rouge
export const getStatusConfig = (status: string) => {
  switch (status) {
    case "disponible":
      return {
        label: "Disponible",
        bg: "bg-emerald-500/15",
        text: "text-emerald-500 dark:text-emerald-400",
        border: "border-emerald-500/30",
        dot: "bg-emerald-500",
      };
    case "en_location":
    case "loue":
      return {
        label: "Loué",
        bg: "bg-amber-500/15",
        text: "text-amber-500 dark:text-amber-400",
        border: "border-amber-500/30",
        dot: "bg-amber-500",
      };
    case "reserve":
      return {
        label: "Réservé",
        bg: "bg-blue-500/15",
        text: "text-blue-500 dark:text-blue-400",
        border: "border-blue-500/30",
        dot: "bg-blue-500",
      };
    case "au_pressing":
    case "en_retouche":
    case "maintenance":
      return {
        label: "Nettoyage / Réparation",
        bg: "bg-slate-500/15",
        text: "text-slate-400",
        border: "border-slate-500/30",
        dot: "bg-slate-400",
      };
    case "hors_service":
    case "au_rebut":
    case "indisponible":
      return {
        label: "Hors service",
        bg: "bg-rose-500/15",
        text: "text-rose-500 dark:text-rose-400",
        border: "border-rose-500/30",
        dot: "bg-rose-500",
      };
    default:
      return {
        label: "Disponible",
        bg: "bg-emerald-500/15",
        text: "text-emerald-500",
        border: "border-emerald-500/30",
        dot: "bg-emerald-500",
      };
  }
};

export const StockCard: React.FC<StockCardProps> = ({ article }) => {
  const { setSelectedArticle, setDetailModalOpen, openQrLabelModal } =
    useStockStore();

  // Détermination du statut global représentatif
  const dispoCount = article.variants.filter((v) => v.status === "disponible").length;
  const rentedCount = article.variants.filter((v) => v.status === "en_location").length;
  const reservedCount = article.variants.filter((v) => v.status === "reserve").length;
  const maintenanceCount = article.variants.filter(
    (v) => v.status === "au_pressing" || v.status === "en_retouche"
  ).length;

  let mainStatus = "disponible";
  if (dispoCount === 0 && rentedCount > 0) mainStatus = "en_location";
  else if (dispoCount === 0 && reservedCount > 0) mainStatus = "reserve";
  else if (dispoCount === 0 && maintenanceCount > 0) mainStatus = "maintenance";

  const statusCfg = getStatusConfig(mainStatus);

  const handleOpenDetail = () => {
    setSelectedArticle(article);
    setDetailModalOpen(true);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group rounded-xl bg-card border border-border overflow-hidden hover:border-border/80 transition-colors flex flex-col justify-between"
    >
      <div>
        {/* Photo Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <img
            src={article.photos[0] || "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800"}
            alt={article.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />

          {/* Badge Catégorie */}
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-md border border-border text-[10px] font-semibold text-foreground shadow-sm">
            {article.category_name}
          </div>

          {/* Statut Coloré avec transition Framer Motion */}
          <div className="absolute top-2.5 right-2.5">
            <AnimatePresence mode="wait">
              <motion.div
                key={mainStatus}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-sm ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                <span>
                  {dispoCount > 0
                    ? `${dispoCount}/${article.variants.length} Dispo`
                    : statusCfg.label}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Overlay gradient en bas de la photo */}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/90 to-transparent" />
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                {article.brand}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {article.reference}
              </span>
            </div>
            <h3 className="font-bold text-sm text-foreground mt-0.5 line-clamp-1 group-hover:text-primary transition-colors">
              {article.name}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
              {article.description}
            </p>
          </div>

          {/* Prix et caution */}
          <div className="flex items-baseline justify-between pt-2 border-t border-border/60">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                Tarif Location
              </span>
              <span className="text-base font-extrabold text-foreground">
                {formatCents(article.rental_price_cents)}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">/ événement</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                Caution requise
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                {formatCents(article.deposit_price_cents)}
              </span>
            </div>
          </div>

          {/* Déclinaisons de tailles disponibles */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">
              Tailles en stock :
            </span>
            <div className="flex flex-wrap gap-1">
              {article.variants.map((v: StockVariant) => {
                const isDispo = v.status === "disponible";
                const isRented = v.status === "en_location";
                const isReserved = v.status === "reserve";
                const isMaintenance =
                  v.status === "au_pressing" || v.status === "en_retouche";

                let variantBadgeColor = "bg-secondary text-muted-foreground";
                if (isDispo)
                  variantBadgeColor =
                    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                else if (isRented)
                  variantBadgeColor =
                    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
                else if (isReserved)
                  variantBadgeColor =
                    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
                else if (isMaintenance)
                  variantBadgeColor =
                    "bg-slate-500/10 text-slate-400 border border-slate-500/20";

                return (
                  <span
                    key={v.id}
                    title={`${v.size} (${v.sub_size || ""}) : ${v.status}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${variantBadgeColor}`}
                  >
                    {v.size}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="p-3 pt-0 flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpenDetail}
          className="flex-1 py-1.5 px-3 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span>Fiche Détail</span>
        </button>

        <button
          type="button"
          onClick={() => openQrLabelModal(article)}
          title="Générer et imprimer l'étiquette QR Code"
          className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors"
        >
          <QrCode className="w-4 h-4 text-primary" />
        </button>
      </div>
    </motion.div>
  );
};
