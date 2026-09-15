export type StockStatus =
  | "disponible"
  | "loue"
  | "reserve"
  | "maintenance" // Nettoyage / Réparation
  | "hors_service"; // Hors service / Rebut

export interface StockVariant {
  id: string;
  article_id: string;
  barcode: string;
  size: string;
  sub_size?: string;
  condition_state: "neuf" | "excellent" | "bon" | "usage" | "endommage" | "au_rebut";
  status: "disponible" | "reserve" | "en_location" | "au_pressing" | "en_retouche" | "indisponible" | "vendu";
  times_rented: number;
  notes?: string;
  created_at: string;
}

export interface RentalHistoryItem {
  id: string;
  contract_number: string;
  customer_name: string;
  pickup_date: string;
  return_date: string;
  amount_cents: number;
  variant_size: string;
  return_condition?: string;
  notes?: string;
}

export interface StockArticle {
  id: string;
  category_id: string;
  category_name: string;
  reference: string;
  name: string;
  brand: string;
  color: string;
  description: string;
  rental_price_cents: number;
  sale_price_cents?: number;
  deposit_price_cents: number;
  cleaning_fee_cents: number;
  photos: string[];
  variants: StockVariant[];
  rental_history: RentalHistoryItem[];
  total_revenue_cents: number;
  times_rented_total: number;
  last_rented_date?: string; // ISO Date
  is_active: boolean;
  created_at: string;
}

export interface StatusLog {
  id: string;
  variant_id: string;
  article_name: string;
  size: string;
  old_status: string;
  new_status: string;
  comment: string;
  user_name: string;
  timestamp: string;
}
