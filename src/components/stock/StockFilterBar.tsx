import React, { useMemo } from "react";
import { Search, X, RotateCcw, Filter } from "lucide-react";
import { useStockStore } from "@/store/stockStore";
import { useSettingsStore } from "@/store/settingsStore";
import { getCategoriesForActivity, getSizesForActivity } from "@/lib/activityCategories";

const STATUSES = [
  { id: "all", label: "Tous Statuts", color: "bg-muted text-foreground" },
  { id: "disponible", label: "Disponible", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  { id: "en_location", label: "Loué", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  { id: "reserve", label: "Réservé", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { id: "maintenance", label: "Nettoyage / Réparation", color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
  { id: "hors_service", label: "Hors service", color: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
];

export const StockFilterBar: React.FC = () => {
  const { filters, setSearch, setCategory, setSize, setStatus, resetFilters } =
    useStockStore();
  const boutique = useSettingsStore((s) => s.boutique);

  const categories = useMemo(() => {
    const list = getCategoriesForActivity(boutique.activity_type);
    return [{ id: "all", label: "Toutes Catégories" }, ...list];
  }, [boutique.activity_type]);

  const sizes = useMemo(() => {
    return getSizesForActivity(boutique.activity_type);
  }, [boutique.activity_type]);

  const isFiltered =
    filters.search !== "" ||
    filters.category !== "all" ||
    filters.size !== "all" ||
    filters.status !== "all" ||
    filters.alertFilter !== "all";

  return (
    <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
      {/* Ligne 1 : Recherche & Bouton Reset */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche instantanée par nom, marque, référence (ex: SMK-NOIR-01, Lanvin)..."
            className="w-full h-9 pl-9 pr-8 text-xs rounded-lg bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
          {filters.search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isFiltered && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-secondary/70 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-all shrink-0"
          >
            <RotateCcw className="w-3 h-3 text-primary" />
            <span>Réinitialiser les filtres</span>
          </button>
        )}
      </div>

      {/* Ligne 2 : Filtres Catégorie, Taille, Statut */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
        {/* Catégories */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Catégorie :
          </span>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                filters.category === c.id
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border mx-1 hidden sm:block" />

        {/* Tailles */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">
            Taille :
          </span>
          {sizes.map((sz) => (
            <button
              key={sz}
              onClick={() => setSize(sz)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all ${
                filters.size === sz
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {sz === "all" ? "Toutes" : sz}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border mx-1 hidden sm:block" />

        {/* Statuts */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">
            Statut :
          </span>
          {STATUSES.map((st) => (
            <button
              key={st.id}
              onClick={() => setStatus(st.id)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
                filters.status === st.id
                  ? "ring-1 ring-primary font-bold " + st.color
                  : "border-transparent text-muted-foreground hover:text-foreground bg-secondary/30"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
