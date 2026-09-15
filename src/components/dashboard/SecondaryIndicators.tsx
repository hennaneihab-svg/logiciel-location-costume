import React from "react";
import {
  RotateCcw,
  Coins,
  Percent,
  ClockAlert,
  ShoppingBag,
} from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { SecondaryKpiStats } from "@/types/dashboard";

interface SecondaryIndicatorsProps {
  stats: SecondaryKpiStats;
}

export const SecondaryIndicators: React.FC<SecondaryIndicatorsProps> = ({ stats }) => {
  // Ratio de rentabilité du stock : revenu cumulé / valeur du stock
  const ratioAmortissement = stats.valeur_stock_estimee_centimes > 0
    ? Math.round((stats.revenu_cumule_genere_centimes / stats.valeur_stock_estimee_centimes) * 100)
    : 0;

  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Indicateurs Métier &amp; Ratios Clés
        </h3>
        <p className="text-xs text-muted-foreground">
          Rentabilité du parc, taux de rotation par rayon et métriques de gestion
        </p>
      </div>

      {/* Grille 4 colonnes d'indicateurs financiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Valeur Stock vs Revenu Cumulé */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Valeur Stock vs Revenu</span>
            <Coins className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {formatCents(stats.valeur_stock_estimee_centimes)}
            </p>
            <p className="text-[11px] text-emerald-500 font-medium">
              Revenu : {formatCents(stats.revenu_cumule_genere_centimes)}
            </p>
          </div>
          {/* Barre de progression d'amortissement */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Amortissement</span>
              <span className="font-semibold text-foreground">{ratioAmortissement}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ratioAmortissement)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Marge Brute Estimée */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Marge Brute Estimée</span>
            <Percent className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {formatCents(stats.marge_brute_estimee_centimes)}
            </p>
            <p className="text-[11px] text-emerald-500 font-medium">
              Taux estimé : {stats.taux_marge_pourcentage}%
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Hors frais d'entretien et pressing externe
          </p>
        </div>

        {/* 3. Taux de Retard du Mois */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Taux de Retard (Mois)</span>
            <ClockAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {stats.taux_retard_mois_pourcentage}%
            </p>
            <p className="text-[11px] text-muted-foreground">
              Formule : retards / total du mois
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Indice de ponctualité de restitution
          </p>
        </div>

        {/* 4. Panier Moyen */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Panier Moyen Location</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {formatCents(stats.panier_moyen_centimes)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Par contrat validé
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Moyenne sur l'ensemble du registre
          </p>
        </div>
      </div>

      {/* Taux de Rotation par Catégorie */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
            <span>Taux de Rotation par Famille (Nombre de locations / Nombre d'articles)</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            Formule imposée Module G
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {stats.rotations.map((cat) => (
            <div
              key={cat.categorie_nom}
              className="p-3 rounded-lg border border-border bg-background/60 flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-semibold text-foreground truncate max-w-[150px]">
                  {cat.categorie_nom}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {cat.total_locations} sorties pour {cat.nombre_articles} réf.
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-primary font-mono">
                  {cat.taux_rotation}x
                </span>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Rotation
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
