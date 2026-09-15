import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Shirt, Footprints, Flame } from "lucide-react";
import { formatCents, cn } from "@/lib/utils";
import type { TopArticleRankingItem } from "@/types/dashboard";

interface TopArticlesRankingProps {
  costumesLocations: TopArticleRankingItem[];
  costumesRevenu: TopArticleRankingItem[];
  chaussuresLocations: TopArticleRankingItem[];
  chaussuresRevenu: TopArticleRankingItem[];
}

export const TopArticlesRanking: React.FC<TopArticlesRankingProps> = ({
  costumesLocations,
  costumesRevenu,
  chaussuresLocations,
  chaussuresRevenu,
}) => {
  const [metricTab, setMetricTab] = useState<"locations" | "revenu">("locations");
  const [categoryType, setCategoryType] = useState<"costumes" | "chaussures">("costumes");

  let activeList: TopArticleRankingItem[] = [];
  if (categoryType === "costumes") {
    activeList = metricTab === "locations" ? costumesLocations : costumesRevenu;
  } else {
    activeList = metricTab === "locations" ? chaussuresLocations : chaussuresRevenu;
  }

  const getMedal = (index: number) => {
    switch (index) {
      case 0:
        return <span className="text-base" title="1ère place">🥇</span>;
      case 1:
        return <span className="text-base" title="2ème place">🥈</span>;
      case 2:
        return <span className="text-base" title="3ème place">🥉</span>;
      default:
        return (
          <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
            {index + 1}
          </span>
        );
    }
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
      <div>
        {/* Header avec onglets */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gold-500/10 text-gold-500">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Palmarès Top 10 Articles
              </h3>
              <p className="text-xs text-muted-foreground">
                Meilleures performances locatives et financières
              </p>
            </div>
          </div>

          {/* Toggles catégorie et métrique */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle Catégorie : Costumes vs Chaussures */}
            <div className="flex items-center p-0.5 rounded-lg bg-secondary border border-border text-xs">
              <button
                type="button"
                onClick={() => setCategoryType("costumes")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                  categoryType === "costumes"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Shirt className="w-3 h-3" />
                <span>Costumes</span>
              </button>
              <button
                type="button"
                onClick={() => setCategoryType("chaussures")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                  categoryType === "chaussures"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Footprints className="w-3 h-3" />
                <span>Chaussures</span>
              </button>
            </div>

            {/* Toggle Métrique : Nb locations vs Revenu */}
            <div className="flex items-center p-0.5 rounded-lg bg-secondary border border-border text-xs">
              <button
                type="button"
                onClick={() => setMetricTab("locations")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                  metricTab === "locations"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Par Sorties
              </button>
              <button
                type="button"
                onClick={() => setMetricTab("revenu")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                  metricTab === "revenu"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Par Revenu
              </button>
            </div>
          </div>
        </div>

        {/* Liste animée du Top 10 */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${categoryType}-${metricTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {activeList.map((item, idx) => {
                const isTop3 = idx < 3;
                return (
                  <motion.div
                    key={item.article_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    className={cn(
                      "p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition-all",
                      isTop3
                        ? "bg-secondary/60 border-gold-500/30 hover:border-gold-500/50"
                        : "bg-secondary/30 border-border hover:border-primary/30"
                    )}
                  >
                    {/* Médaille + Photo + Nom */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-6 flex items-center justify-center shrink-0">
                        {getMedal(idx)}
                      </div>

                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.nom}
                          className="w-8 h-8 rounded-md object-cover border border-border shrink-0 bg-muted"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                          {categoryType === "costumes" ? (
                            <Shirt className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Footprints className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{item.nom}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {item.reference}
                        </p>
                      </div>
                    </div>

                    {/* Valeurs principales */}
                    <div className="text-right shrink-0">
                      {metricTab === "locations" ? (
                        <div>
                          <p className="font-bold text-foreground text-sm">
                            {item.nb_locations} <span className="text-[10px] text-muted-foreground font-normal">loc.</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatCents(item.ca_genere_centimes)} générés
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-bold text-foreground text-sm">
                            {formatCents(item.ca_genere_centimes)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.nb_locations} locations
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>Rotation calculée sur l'historique complet</span>
        <span className="text-primary font-medium flex items-center gap-1">
          <Award className="w-3.5 h-3.5" />
          Classement boutique
        </span>
      </div>
    </div>
  );
};
