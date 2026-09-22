import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Shirt,
  CalendarCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";
import { formatCents } from "@/lib/utils";
import { usePressingStore } from "@/store/pressingStore";
import type { FullDashboardStats } from "@/types/dashboard";

interface KpiCardsSectionProps {
  stats: FullDashboardStats;
  onAlertesClick?: () => void;
  onLocationsClick?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export const KpiCardsSection: React.FC<KpiCardsSectionProps> = ({
  stats,
  onAlertesClick,
  onLocationsClick,
}) => {
  const navigate = useNavigate();
  const isPositiveProgression = stats.progression_ca_pourcentage >= 0;
  const isModuleActive = usePressingStore((s) => s.isModuleActive);
  const dispatches = usePressingStore((s) => s.dispatches);

  const { piecesAuPressing, retardsPressing } = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let pieces = 0;
    let retards = 0;
    for (const d of dispatches) {
      if (d.statut === "envoye" || d.statut === "en_traitement") {
        pieces++;
        if (d.date_retour_prevue < today) {
          retards++;
        }
      }
    }
    return { piecesAuPressing: pieces, retardsPressing: retards };
  }, [dispatches]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`grid grid-cols-1 sm:grid-cols-2 ${
        isModuleActive ? "lg:grid-cols-5" : "lg:grid-cols-4"
      } gap-4`}
    >
      {/* KPI 1 : CA de la Période */}
      <motion.div
        variants={cardVariants}
        className="p-4 rounded-xl bg-card border border-border group hover:border-border/80 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Chiffre d'Affaires
          </span>
          <div className="p-1.5 rounded-md bg-muted text-foreground">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedCounter
              value={stats.ca_periode_centimes}
              formatter={(val) => formatCents(Math.round(val))}
            />
          </div>
          <div className="flex items-center gap-1 mt-1 text-[11px]">
            {isPositiveProgression ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{stats.progression_ca_pourcentage}%</span>
              </span>
            ) : (
              <span className="text-red-500 font-medium flex items-center gap-0.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>{stats.progression_ca_pourcentage}%</span>
              </span>
            )}
            <span className="text-muted-foreground">vs préc. ({formatCents(stats.ca_periode_precedente_centimes)})</span>
          </div>
        </div>
      </motion.div>

      {/* KPI 2 : Taux d'Occupation du Stock */}
      <motion.div
        variants={cardVariants}
        className="p-4 rounded-xl bg-card border border-border group hover:border-border/80 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Taux d'Occupation
          </span>
          <div className="p-1.5 rounded-md bg-muted text-foreground">
            <Shirt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-foreground flex items-baseline gap-1">
            <AnimatedCounter
              value={stats.taux_occupation_pourcentage}
              formatter={(val) => `${(Math.round(val * 10) / 10).toFixed(1)}%`}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Formule : (articles loués / total) × 100
          </div>
        </div>
      </motion.div>

      {/* KPI 3 : Locations en Cours */}
      <motion.div
        variants={cardVariants}
        onClick={onLocationsClick}
        className="p-4 rounded-xl bg-card border border-border group hover:border-border/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Locations en Cours
          </span>
          <div className="p-1.5 rounded-md bg-muted text-foreground">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedCounter value={stats.locations_en_cours} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Contrats en cours et retards suivis
          </div>
        </div>
      </motion.div>

      {/* KPI 4 : Alertes Actives */}
      <motion.div
        variants={cardVariants}
        onClick={onAlertesClick}
        className="p-4 rounded-xl bg-card border border-border group hover:border-border/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Alertes Actives
          </span>
          <div className="p-1.5 rounded-md bg-muted text-foreground">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold tracking-tight text-foreground">
            <AnimatedCounter value={stats.alertes_actives} />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Retards, retours imminents &amp; stocks bas
          </div>
        </div>
      </motion.div>

      {/* KPI 5 : Pièces au Pressing (conditionné à l'activation du module) */}
      {isModuleActive && (
        <motion.div
          variants={cardVariants}
          onClick={() => navigate("/pressing?status=en_cours")}
          className="p-4 rounded-xl bg-card border border-border group hover:border-border/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pièces au Pressing
            </span>
            <div className="p-1.5 rounded-md bg-muted text-foreground">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              <AnimatedCounter value={piecesAuPressing} />
            </div>
            <div className="text-[11px] mt-1 flex items-center gap-1">
              {retardsPressing > 0 ? (
                <span className="text-amber-500 font-medium flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{retardsPressing} en retard</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Aucun retard</span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
