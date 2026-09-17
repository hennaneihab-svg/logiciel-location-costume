/**
 * Module G — Tableau de Bord & Statistiques (Page d'Accueil)
 * Atelier Prestige — Location de Costumes & Chaussures
 *
 * Toutes les données sont calculées via les requêtes SQL agrégées (Rust IPC / SQLite) :
 * - taux_occupation = (articles_loués / articles_totaux) * 100
 * - taux_rotation = nombre_locations / nombre_articles (par catégorie)
 * - taux_retard = locations_en_retard_du_mois / locations_totales_du_mois
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus,
  RefreshCw,
} from "lucide-react";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { KpiCardsSection } from "@/components/dashboard/KpiCardsSection";
import { CaEvolutionChart } from "@/components/dashboard/CaEvolutionChart";
import { CategoryPieChart } from "@/components/dashboard/CategoryPieChart";
import { TopArticlesRanking } from "@/components/dashboard/TopArticlesRanking";
import { SecondaryIndicators } from "@/components/dashboard/SecondaryIndicators";
import { RetoursDuJourWidget } from "@/components/dashboard/RetoursDuJourWidget";
import { UpcomingWeekWidget } from "@/components/dashboard/UpcomingWeekWidget";
import { fetchFullDashboardStats, calculateDashboardFromStores } from "@/services/dashboardService";
import { useRentalStore } from "@/store/rentalStore";
import { useStockStore } from "@/store/stockStore";
import { useAlertStore } from "@/store/alertStore";
import { SkeletonKpi } from "@/components/ui/SkeletonKpi";
import { Skeleton } from "@/components/ui/Skeleton";
import { pageContainerVariants, fadeInUp } from "@/lib/animations";
import type { DashboardPeriod, FullDashboardStats } from "@/types/dashboard";

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const setCreateRentalModalOpen = useRentalStore((s) => s.setCreateRentalModalOpen);

  // Écoute des stores pour synchronisation temps réel
  const contracts = useRentalStore((s) => s.contracts);
  const articles = useStockStore((s) => s.articles);
  const alerts = useAlertStore((s) => s.alerts);

  // Skeleton initial
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsInitialLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // État de la période
  const [period, setPeriod] = useState<DashboardPeriod>("mois");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  // Données calculées agrégées (initialisées de façon synchrone pour éviter un état undefined)
  const [stats, setStats] = useState<FullDashboardStats>(() =>
    calculateDashboardFromStores(period, dateFrom, dateTo)
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchFullDashboardStats(period, dateFrom, dateTo);
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [period, dateFrom, dateTo, contracts, articles, alerts]);

  return (
    <motion.div
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 select-none"
    >
      {/* ── 1. En-tête Page avec Sélecteur de Période & Boutons d'Action ── */}
      <motion.div
        variants={fadeInUp}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Tableau de Bord
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indicateurs d'activité, rotation du stock et flux opérationnels
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de Période */}
          <PeriodSelector
            period={period}
            onPeriodChange={setPeriod}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />

          <button
            type="button"
            onClick={loadData}
            title="Rafraîchir les données"
            className="w-8 h-8 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-foreground" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setCreateRentalModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Location</span>
          </button>
        </div>
      </motion.div>

      {/* ── 2. Cartes KPI — skeleton pendant chargement initial ── */}
      <motion.div variants={fadeInUp}>
        {isInitialLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonKpi key={i} />
            ))}
          </div>
        ) : (
          <KpiCardsSection
            stats={stats}
            onLocationsClick={() => navigate("/locations")}
            onAlertesClick={() => navigate("/alertes")}
          />
        )}
      </motion.div>

      {/* ── 3. Graphiques : Évolution du CA & Camembert ── */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isInitialLoading ? (
          <>
            <div className="lg:col-span-2">
              <Skeleton className="h-64 rounded-2xl" />
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-2">
              <CaEvolutionChart data={stats.points_evolution} />
            </div>
            <div className="lg:col-span-1">
              <CategoryPieChart data={stats.repartition_categories} />
            </div>
          </>
        )}
      </motion.div>

      {/* ── 4. Classement Top 10 Articles & Widgets Opérationnels ── */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopArticlesRanking
            costumesLocations={stats.top_articles_costumes_locations}
            costumesRevenu={stats.top_articles_costumes_revenu}
            chaussuresLocations={stats.top_articles_chaussures_locations}
            chaussuresRevenu={stats.top_articles_chaussures_revenu}
          />
        </div>

        {/* Colonne Widgets : Retours du Jour & Prochains 7 jours */}
        <div className="space-y-6 lg:col-span-1">
          <RetoursDuJourWidget />
          <UpcomingWeekWidget events={stats.prochains_7_jours} />
        </div>
      </motion.div>

      {/* ── 5. Indicateurs Secondaires ── */}
      <motion.div variants={fadeInUp}>
        <SecondaryIndicators stats={stats.indicateurs_secondaires} />
      </motion.div>
    </motion.div>
  );
};
