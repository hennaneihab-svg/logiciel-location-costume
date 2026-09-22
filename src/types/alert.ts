/**
 * Types pour le Module E — Système d'Alertes & Rappels
 * Atelier Prestige — Location de Costumes & Chaussures
 * v2 : ajout traçabilité vue/traitée, statut "traitee"
 */

/** Sévérité d'une alerte */
export type AlertSeverity = "critique" | "avertissement" | "info";

/** Catégorie fonctionnelle de l'alerte */
export type AlertCategory =
  | "retard_retour"     // Article non rendu après la date prévue
  | "retard_pressing"   // Pièce non revenue du pressing après la date prévue
  | "retour_j1"         // Retour prévu demain (J-1)
  | "retour_j2"         // Retour prévu dans 2 jours (J-2)
  | "retour_j3"         // Retour prévu dans 3 jours (J-3)
  | "retour_jour_j"     // Retour prévu aujourd'hui
  | "stock_bas"         // Quantité disponible sous le seuil minimal
  | "article_inactif";  // Article jamais loué depuis 90+ jours

/**
 * Statut d'une alerte :
 * - active   : non vue, nécessite attention
 * - vue      : l'opérateur a vu l'alerte (sans action)
 * - traitee  : action explicite prise, commentaire obligatoire
 * - acquittee: ancienne dénomination — conservée pour compatibilité
 */
export type AlertStatus = "active" | "vue" | "traitee" | "acquittee";

/** Priorité d'affichage pour le tri (plus bas = plus urgent) */
export const ALERT_URGENCY: Record<AlertCategory, number> = {
  retard_retour:   0,
  retard_pressing: 1,
  retour_jour_j:   2,
  retour_j1:       3,
  retour_j2:       4,
  retour_j3:       5,
  stock_bas:       6,
  article_inactif: 7,
};

/** Une alerte unitaire */
export interface AppAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  created_at: string;  // ISO 8601 UTC
  updated_at: string;  // ISO 8601 UTC — mis à jour par le moteur

  /**
   * Clé de déduplication : `${contract_id ?? article_id}_${category}`
   * Le moteur utilise cette clé pour ne pas créer deux fois la même alerte.
   */
  dedup_key: string;

  // ── Données contextuelles selon la catégorie ──────────────────────────────
  contract_id?: string;
  contract_number?: string;
  customer_name?: string;
  customer_phone?: string;
  return_date_scheduled?: string;
  /** >0 = retard en jours, 0 = aujourd'hui, <0 = jours restants avant retour */
  days_overdue?: number;
  late_fee_cents?: number;    // Pénalité accumulée pour les retards

  article_id?: string;
  article_name?: string;
  variant_id?: string;
  variant_size?: string;
  current_stock?: number;
  min_stock_threshold?: number;
  days_since_last_rental?: number;

  // ── Données contextuelles Pressing ────────────────────────────────────────
  pressing_dispatch_id?: string;
  pressing_dispatch_number?: string;
  provider_name?: string;

  // ── Traçabilité vue / traitée ─────────────────────────────────────────────
  viewed_at?: string;         // ISO 8601 UTC — marqué "vu" par un opérateur
  viewed_by?: string;

  processed_at?: string;      // ISO 8601 UTC — marqué "traité" avec commentaire
  processed_by?: string;
  processed_comment?: string; // Obligatoire pour "traité"

  /** Notification système déjà envoyée ? Évite les doublons de notif. */
  notification_sent?: boolean;

  /** Traçabilité du rappel WhatsApp manuel */
  whatsapp_sent_at?: string;
  whatsapp_sent_by?: string;

  // ── Acquittement (compat avec v1) ─────────────────────────────────────────
  dismissed_at?: string;
  dismissed_by?: string;
  dismiss_comment?: string;
}

/** Filtre d'affichage des alertes */
export interface AlertFilters {
  severity: AlertSeverity | "all";
  category: AlertCategory | "all";
  status: AlertStatus | "all";
  dateFrom?: string;
  dateTo?: string;
  searchQuery: string;
}

/** Paramètres de seuil configurables pour les alertes stock */
export interface AlertThresholds {
  low_stock_min_qty: number;   // Seuil de stock bas (par défaut: 1)
  inactive_days: number;        // Inactivité (par défaut: 90 jours)
  late_fee_per_day_cents: number; // Pénalité journalière par défaut
}
