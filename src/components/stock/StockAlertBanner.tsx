import React from "react";
import { AlertCircle, Clock, ArrowRight } from "lucide-react";
import { useStockStore } from "@/store/stockStore";

export const StockAlertBanner: React.FC = () => {
  const { articles, filters, setAlertFilter } = useStockStore();

  // Calcul 1 : Articles en stock bas (< 2 variantes disponibles)
  const lowStockArticles = articles.filter((art) => {
    const dispoCount = art.variants.filter((v) => v.status === "disponible").length;
    return dispoCount < 2;
  });

  // Calcul 2 : Articles jamais loués ou inactifs depuis 90 jours
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const inactive90dArticles = articles.filter((art) => {
    if (!art.last_rented_date) return true;
    const lastDate = new Date(art.last_rented_date);
    return lastDate < ninetyDaysAgo;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Alerte 1 : Stock bas */}
      <div
        onClick={() =>
          setAlertFilter(filters.alertFilter === "low_stock" ? "all" : "low_stock")
        }
        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
          filters.alertFilter === "low_stock"
            ? "bg-amber-500/15 border-amber-500 text-amber-500 shadow-sm ring-1 ring-amber-500"
            : "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15 text-foreground"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-amber-600 dark:text-amber-400">
                {lowStockArticles.length} articles en stock bas
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono font-semibold">
                Moins de 2 dispo
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Risque de rupture pour les prochaines réservations du week-end
            </p>
          </div>
        </div>
        <div className="flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 gap-1 shrink-0">
          <span>{filters.alertFilter === "low_stock" ? "Actif" : "Filtrer"}</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>

      {/* Alerte 2 : Jamais loué depuis 90 jours */}
      <div
        onClick={() =>
          setAlertFilter(
            filters.alertFilter === "inactive_90d" ? "all" : "inactive_90d"
          )
        }
        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
          filters.alertFilter === "inactive_90d"
            ? "bg-blue-500/15 border-blue-500 text-blue-500 shadow-sm ring-1 ring-blue-500"
            : "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15 text-foreground"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                {inactive90dArticles.length} article(s) non loués depuis 90 jours
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-mono font-semibold">
                Rotation lente
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Opportunité de mise en avant promotionnelle ou révision du tarif
            </p>
          </div>
        </div>
        <div className="flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 gap-1 shrink-0">
          <span>{filters.alertFilter === "inactive_90d" ? "Actif" : "Filtrer"}</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};
