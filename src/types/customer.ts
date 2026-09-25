// ============================================================================
// TYPES MODULE B — GESTION DES CLIENTS
// ============================================================================

export type CustomerRentalStatus =
  | "brouillon"
  | "reserve"
  | "en_cours"
  | "retourne"
  | "en_retard"
  | "litige"
  | "annule";

export type CustomerDepositStatus =
  | "non_recue"
  | "encaissee"
  | "empreinte_cb"
  | "cheque_retenu"
  | "restituee"
  | "conservee_partiellement"
  | "conservee_totalement";

export interface CustomerRental {
  id: string;
  contract_number: string;
  event_date?: string;
  pickup_date: string;
  return_date: string;
  status: CustomerRentalStatus;
  articles_summary: string;
  total_amount_cents: number;
  deposit_amount_cents: number;
  deposit_status: CustomerDepositStatus;
  payment_status: "solde" | "acompte" | "en_attente";
  notes?: string;
  created_at: string;
}

export interface CustomerDetailed {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  alternative_phone?: string;
  address: string;
  city: string;
  postal_code: string;
  identity_card_number: string;
  identity_card_photo?: string; // Data URL ou URL de prévisualisation
  notes?: string; // Mensurations, préférences sartoriales
  is_blacklisted: boolean;
  blacklist_reason?: string; // Obligatoire si is_blacklisted = true
  blacklist_date?: string;
  rentals: CustomerRental[];
  created_at: string;
}

export type ClientSortOption =
  | "spent_desc"
  | "rentals_desc"
  | "name_asc"
  | "recent";

export type ClientFilterOption =
  | "all"
  | "loyal"
  | "blacklisted"
  | "active";

// ============================================================================
// MOD-2: MENSURATIONS STRUCTURÉES
// ============================================================================

export interface ClientMensurations {
  id: string;
  client_id: string;
  tour_poitrine: number | null;
  tour_taille: number | null;
  tour_hanches: number | null;
  longueur_bras: number | null;
  longueur_jambe: number | null;
  tour_cou: number | null;
  pointure: number | null;
  stature: number | null;
  notes_mensurations: string | null;
  date_mesure: string;
  est_actuel: number;
  created_at: string;
}

export interface CreateMensurationsDto {
  tour_poitrine?: number | null;
  tour_taille?: number | null;
  tour_hanches?: number | null;
  longueur_bras?: number | null;
  longueur_jambe?: number | null;
  tour_cou?: number | null;
  pointure?: number | null;
  stature?: number | null;
  notes_mensurations?: string | null;
  date_mesure?: string | null;
}

export interface MensurationSearchFilterDto {
  min_tour_poitrine?: number | null;
  max_tour_poitrine?: number | null;
  min_tour_taille?: number | null;
  max_tour_taille?: number | null;
  min_tour_hanches?: number | null;
  max_tour_hanches?: number | null;
  min_stature?: number | null;
  max_stature?: number | null;
  min_pointure?: number | null;
  max_pointure?: number | null;
}

export interface ClientWithActiveMensurationsDto {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string;
  ville: string | null;
  tour_poitrine: number | null;
  tour_taille: number | null;
  tour_hanches: number | null;
  stature: number | null;
  pointure: number | null;
  date_mesure: string | null;
}

