// ============================================================================
// TYPES APPLICATIFS — COUTURE & LOCATION COSTUMES
// ============================================================================

export type UserRole = "admin" | "manager" | "seller";

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export type CategoryType = "costume" | "chaussure" | "accessoire" | "autre";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description?: string;
  created_at: string;
}

export interface Article {
  id: string;
  category_id: string;
  category_name?: string;
  reference: string;
  name: string;
  brand?: string;
  color?: string;
  description?: string;
  rental_price_cents: number; // En centimes
  sale_price_cents?: number;   // En centimes
  deposit_price_cents: number; // En centimes
  cleaning_fee_cents: number;  // En centimes
  image_url?: string;
  is_active: boolean;
  created_at: string;
  variants_count?: number;
}

export type VariantCondition = "neuf" | "excellent" | "bon" | "usage" | "endommage" | "au_rebut";
export type VariantStatus = "disponible" | "reserve" | "en_location" | "au_pressing" | "en_retouche" | "indisponible" | "vendu";

export interface ItemVariant {
  id: string;
  article_id: string;
  barcode: string;
  size: string;
  sub_size?: string;
  condition_state: VariantCondition;
  status: VariantStatus;
  times_rented: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  alternative_phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  identity_card_number?: string;
  notes?: string;
  is_blacklisted: boolean;
  created_at: string;
}

export type ContractType = "location" | "vente_directe";
export type ContractStatus = "brouillon" | "reserve" | "en_cours" | "retourne" | "en_retard" | "litige" | "annule";
export type DepositStatus = "non_recue" | "encaissee" | "empreinte_cb" | "cheque_retenu" | "restituee" | "conservee_partiellement" | "conservee_totalement";

export interface Contract {
  id: string;
  contract_number: string;
  contract_type: ContractType;
  customer_id: string;
  customer_name?: string;
  created_by_user_id: string;
  status: ContractStatus;
  event_date?: string;
  pickup_date_scheduled: string;
  pickup_date_actual?: string;
  return_date_scheduled: string;
  return_date_actual?: string;
  total_rental_cents: number;
  cleaning_fee_cents: number;
  late_fee_cents: number;
  damage_fee_cents: number;
  discount_cents: number;
  total_amount_cents: number;
  deposit_amount_cents: number;
  deposit_status: DepositStatus;
  deposit_notes?: string;
  notes?: string;
  pdf_path?: string;
  created_at: string;
  updated_at: string;
}

export interface ContractItem {
  id: string;
  contract_id: string;
  variant_id: string;
  item_name?: string;
  size?: string;
  barcode?: string;
  item_type: "location" | "vente";
  unit_price_cents: number;
  deposit_cents: number;
  pickup_condition?: string;
  return_condition?: string;
  is_returned: boolean;
  return_date?: string;
}

export type PaymentType = "acompte" | "solde" | "caution" | "frais_retard" | "degradation" | "remboursement";
export type PaymentMethod = "especes" | "carte_bancaire" | "cheque" | "virement" | "autre";

export interface Payment {
  id: string;
  contract_id: string;
  user_id: string;
  amount_cents: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  transaction_reference?: string;
  notes?: string;
  created_at: string;
}

export type AlertType = "j_minus_3" | "j_minus_2" | "j_minus_1" | "jour_j" | "retard";

export interface ReturnAlert {
  id: string;
  contract_id: string;
  contract_number: string;
  customer_name: string;
  customer_phone: string;
  alert_type: AlertType;
  due_date: string;
  is_triggered: boolean;
  triggered_at?: string;
  dismissed: boolean;
}

export interface DashboardStats {
  activeRentalsCount: number;
  pendingReturnsToday: number;
  overdueCount: number;
  monthRevenueCents: number;
  totalStockItems: number;
  availableStockPercent: number;
}
