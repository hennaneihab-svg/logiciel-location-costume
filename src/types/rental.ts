// ============================================================================
// TYPES MODULE C & D — LOCATIONS, RÉSERVATIONS & BONS PDF
// ============================================================================

export type RentalContractStatus =
  | "brouillon"
  | "reserve"
  | "en_cours"
  | "retourne"
  | "en_retard"
  | "litige"
  | "annule";

export type RentalDepositStatus =
  | "non_recue"
  | "encaissee"
  | "empreinte_cb"
  | "cheque_retenu"
  | "restituee"
  | "conservee_partiellement"
  | "conservee_totalement";

export interface RentalArticleItem {
  variant_id: string;
  article_id: string;
  article_name: string;
  reference: string;
  barcode: string;
  size: string;
  sub_size?: string;
  unit_price_cents: number;
  deposit_cents: number;
  cleaning_fee_cents: number;
  pickup_condition: string;
  return_condition?: "bon_etat" | "a_nettoyer" | "endommage";
  damage_fee_cents?: number;
  damage_notes?: string;
  is_returned: boolean;
  return_date?: string;
}

export interface RentalContract {
  id: string;
  contract_number: string; // Ex: "LOC-2026-0016"
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  customer_cni?: string;

  status: RentalContractStatus;
  event_date?: string; // YYYY-MM-DD
  pickup_date: string; // YYYY-MM-DD
  pickup_date_actual?: string; // YYYY-MM-DD
  return_date_scheduled: string; // YYYY-MM-DD
  return_date_actual?: string; // YYYY-MM-DD

  items: RentalArticleItem[];

  // Valeurs financières en centimes
  total_rental_cents: number;
  cleaning_fee_cents: number;
  discount_cents: number;
  late_fee_cents: number;
  damage_fee_cents: number;
  total_amount_cents: number; // Total TTC final facturé

  // Caution
  deposit_amount_cents: number;
  deposit_status: RentalDepositStatus;
  deposit_method: "empreinte_cb" | "cheque" | "especes" | "virement";
  deposit_notes?: string;

  // Paiement
  paid_amount_cents: number;
  payment_method: "carte_bancaire" | "especes" | "cheque" | "virement";
  remaining_amount_cents: number;

  notes?: string;
  pdf_archived_path?: string; // Ex: "/bons/2026-09/BON-LOC-2026-0016.pdf"
  created_at: string;
  updated_at: string;
}

export interface NewRentalFormInput {
  customer_id: string;
  pickup_date: string;
  return_date_scheduled: string;
  event_date?: string;
  selected_variant_ids: string[];
  /** Lignes issues de packs — chaque ligne porte son pack_id pour la traçabilité SQLite */
  pack_lines?: import("@/types/pack").PackLineInput[];
  discount_cents: number;
  deposit_method: "empreinte_cb" | "cheque" | "especes" | "virement";
  deposit_amount_cents: number;
  paid_amount_cents: number;
  payment_method: "carte_bancaire" | "especes" | "cheque" | "virement";
  notes?: string;
}

export interface ValidateRentalPickupInput {
  contract_id: string;
  utilisateur_id?: string;
  notes?: string;
}

export interface PaginatedRentalsResult {
  items: RentalContract[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}


