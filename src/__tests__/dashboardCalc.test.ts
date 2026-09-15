import { describe, it, expect } from "vitest";
import { fetchFullDashboardStats } from "@/services/dashboardService";

describe("Module G — Calculs & Statistiques du Dashboard", () => {
  it("Calcule le chiffre d affaires et les KPI sur la période globale", async () => {
    const stats = await fetchFullDashboardStats("annee", "2026-01-01", "2026-12-31");

    expect(stats).toBeDefined();
    expect(stats.ca_periode_centimes).toBeGreaterThan(0);
    expect(stats.taux_occupation_pourcentage).toBeGreaterThanOrEqual(0);
    expect(stats.taux_occupation_pourcentage).toBeLessThanOrEqual(100);
    expect(stats.locations_en_cours).toBeGreaterThanOrEqual(0);
    expect(stats.alertes_actives).toBeGreaterThanOrEqual(0);
  });

  it("Génère les graphiques d évolution et de répartition cohérents", async () => {
    const stats = await fetchFullDashboardStats("mois", "2026-03-01", "2026-03-31");

    expect(stats.points_evolution.length).toBeGreaterThan(0);
    expect(stats.repartition_categories.length).toBeGreaterThan(0);

    const totalCategoryPct = stats.repartition_categories.reduce((acc, c) => acc + c.pourcentage, 0);
    expect(Math.round(totalCategoryPct)).toBe(100);
  });

  it("Calcule les classements Top 10 et les indicateurs secondaires", async () => {
    const stats = await fetchFullDashboardStats("annee", "2026-01-01", "2026-12-31");

    expect(Array.isArray(stats.top_articles_costumes_locations)).toBe(true);
    expect(Array.isArray(stats.top_articles_costumes_revenu)).toBe(true);
    expect(Array.isArray(stats.top_articles_chaussures_locations)).toBe(true);

    const ind = stats.indicateurs_secondaires;
    expect(ind.valeur_stock_estimee_centimes).toBeGreaterThan(0);
    expect(ind.panier_moyen_centimes).toBeGreaterThan(0);
    expect(ind.taux_marge_pourcentage).toBeGreaterThanOrEqual(0);
    expect(ind.taux_retard_mois_pourcentage).toBeGreaterThanOrEqual(0);
  });
});
