// ============================================================================
// TYPES MODULE F — CAISSE, VENTES DIRECTES & CLÔTURE JOURNALIÈRE
// ============================================================================

export type CaissePaymentMethod =
  | "especes"
  | "carte_bancaire"
  | "cheque"
  | "virement"
  | "autre";

export interface CartItem {
  id: string; // Unique ID for cart item
  article_id: string;
  variant_id?: string;
  name: string;
  reference: string;
  barcode?: string;
  category_name: string;
  size?: string;
  unit_price_cents: number;
  quantity: number;
  subtotal_cents: number;
  photo_url?: string;
}

export interface DirectSalePaymentDetails {
  method: CaissePaymentMethod;
  amount_paid_cents: number;
  cash_received_cents?: number;
  change_returned_cents?: number;
  transaction_ref?: string;
  cheque_number?: string;
  bank_name?: string;
}

export interface DirectSale {
  id: string;
  sale_number: string; // Ex: "VTE-2026-0042"
  customer_id?: string;
  customer_name: string; // "Client Comptoir" si anonyme
  customer_phone?: string;
  user_id: string;
  user_name: string;
  total_amount_cents: number;
  tax_rate: number; // Ex: 0.20 (20%)
  tax_amount_cents: number;
  payment: DirectSalePaymentDetails;
  items: CartItem[];
  notes?: string;
  receipt_pdf_path?: string;
  created_at: string; // ISO 8601 UTC
}

export interface CaisseTransactionItem {
  id: string;
  reference_number: string; // "VTE-2026-0012" ou "LOC-2026-0013"
  type: "vente_directe" | "location_acompte" | "location_solde" | "location_caution";
  client_name: string;
  payment_method: CaissePaymentMethod;
  amount_cents: number;
  transaction_ref?: string;
  created_at: string; // ISO Date
  operator_name: string;
}

export interface PaymentMethodBreakdown {
  total_cents: number;
  transaction_count: number;
}

export interface ClotureCaisse {
  id: string;
  cloture_number: string; // Ex: "Z-20260914-01"
  date: string; // YYYY-MM-DD
  closed_at: string; // ISO Date
  closed_by_user_id: string;
  closed_by_user_name: string;
  closed_by_role: string;
  status: "ouverte" | "cloturee";

  // Fonds de caisse
  initial_cash_float_cents: number; // Fonds d'ouverture (ex: 15000 = 15 000 DA)

  // Totaux combinés de la journée
  sales_total_cents: number; // Ventes directes
  rentals_total_cents: number; // Locations (acomptes + soldes)
  deposits_total_cents: number; // Cautions encaissées
  grand_total_cents: number; // CA Total encaissé (hors cautions ou avec)

  // Répartition par mode
  breakdown: {
    especes: PaymentMethodBreakdown;
    carte_bancaire: PaymentMethodBreakdown;
    cheque: PaymentMethodBreakdown;
    virement: PaymentMethodBreakdown;
  };

  // Réconciliation Espèces
  theoretical_cash_cents: number; // Fonds initial + espèces encaissées
  counted_cash_cents: number; // Espèces physiques comptées par l'opérateur
  discrepancy_cents: number; // Écart = counted - theoretical

  operator_notes?: string;
  pdf_path?: string;
}
