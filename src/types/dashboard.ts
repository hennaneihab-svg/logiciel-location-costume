/**
 * Types TypeScript pour le Module G — Tableau de Bord & Statistiques
 * Atelier Prestige — Location de Costumes & Chaussures
 */

export type DashboardPeriod = "aujourdhui" | "semaine" | "mois" | "annee" | "personnalise";

export interface CaEvolutionPoint {
  label: string;
  date: string;
  ca_locations_centimes: number;
  ca_ventes_centimes: number;
  ca_total_centimes: number;
}

export interface CategoryBreakdown {
  categorie_nom: string;
  categorie_type: "costume" | "chaussure" | "accessoire" | string;
  montant_centimes: number;
  pourcentage: number;
  nombre_articles_loues: number;
}

export interface TopArticleRankingItem {
  article_id: string;
  reference: string;
  nom: string;
  categorie_type: "costume" | "chaussure" | string;
  nb_locations: number;
  ca_genere_centimes: number;
  image_url?: string;
}

export interface CategoryRotationStats {
  categorie_nom: string;
  categorie_type: string;
  nombre_articles: number;
  total_locations: number;
  taux_rotation: number; // nombre_locations / nombre_articles
}

export interface SecondaryKpiStats {
  rotations: CategoryRotationStats[];
  valeur_stock_estimee_centimes: number;
  revenu_cumule_genere_centimes: number;
  marge_brute_estimee_centimes: number;
  taux_marge_pourcentage: number;
  taux_retard_mois_pourcentage: number; // locations_en_retard_du_mois / locations_totales_du_mois
  panier_moyen_centimes: number;
}

export interface UpcomingEventItem {
  id: string;
  contract_number: string;
  customer_name: string;
  event_type: "retrait" | "retour";
  date_prevue: string;
  articles_summary: string;
  status: string;
}

export interface FullDashboardStats {
  ca_periode_centimes: number;
  ca_periode_precedente_centimes: number;
  progression_ca_pourcentage: number;
  taux_occupation_pourcentage: number; // (articles_loues / articles_totaux) * 100
  locations_en_cours: number;
  alertes_actives: number;
  points_evolution: CaEvolutionPoint[];
  repartition_categories: CategoryBreakdown[];
  top_articles_costumes_locations: TopArticleRankingItem[];
  top_articles_costumes_revenu: TopArticleRankingItem[];
  top_articles_chaussures_locations: TopArticleRankingItem[];
  top_articles_chaussures_revenu: TopArticleRankingItem[];
  indicateurs_secondaires: SecondaryKpiStats;
  prochains_7_jours: UpcomingEventItem[];
}
