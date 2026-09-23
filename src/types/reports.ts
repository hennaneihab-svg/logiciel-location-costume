// ============================================================================
// TYPES MODULE H — RAPPORTS & EXPORTS FINANCIERS, CAISSE ET STOCK
// ============================================================================

export type ReportPeriod = "aujourdhui" | "semaine" | "mois" | "annee" | "personnalise";

export interface RapportFinancierDto {
  ca_total_centimes: number;
  ca_locations_centimes: number;
  ca_ventes_centimes: number;
  nombre_contrats: number;
  nombre_ventes: number;
  taux_retard_pourcentage: number;
  panier_moyen_centimes: number;
}

export interface ModePaiementStatDto {
  moyen: string;
  label: string;
  montant_centimes: number;
  nb_transactions: number;
}

export interface RapportCaisseDto {
  total_reglements_centimes: number;
  reglements_par_mode: ModePaiementStatDto[];
  nombre_transactions: number;
}

export interface RapportStockDto {
  valeur_totale_stock_centimes: number;
  nombre_articles_total: number;
  pieces_en_location: number;
  pieces_en_pressing: number;
  cout_pressing_centimes: number;
}

export interface RapportsOverviewDto {
  periode: ReportPeriod | string;
  date_debut: string;
  date_fin: string;
  financier: RapportFinancierDto;
  caisse: RapportCaisseDto;
  stock: RapportStockDto;
}

export interface FinancialTransactionRowDto {
  id: string;
  reference: string;
  type_operation: string;
  client_nom: string;
  moyen_paiement: string;
  montant_centimes: number;
  date_operation: string;
  operateur_nom: string;
}

export interface StockInventoryRowDto {
  variant_id: string;
  article_id: string;
  reference: string;
  nom: string;
  categorie: string;
  taille: string;
  statut: string;
  valeur_remplacement_centimes: number;
  cout_pressing_total_centimes: number;
}
