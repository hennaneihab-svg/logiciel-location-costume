// ============================================================================
// TYPES MODULE I — PARAMÈTRES, SAUVEGARDES & AUDIT LOGS
// ============================================================================

export interface BoutiqueSettings {
  name: string;
  slogan: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  siret: string;
  rcs: string;
  website: string;
  logo_url?: string;
  legal_notice: string;
  activity_type?: "homme" | "femme" | "mixte";
}

export interface NumberingSettings {
  rental_prefix: string; // Ex: "LOC"
  sale_prefix: string; // Ex: "VTE"
  quote_prefix: string; // Ex: "DEV"
  year_format: "YYYY" | "YY";
  padding_digits: number; // Ex: 4 -> "0001"
}

export interface TaxSettings {
  default_vat_rate: number; // Ex: 0.19 (19% TVA algérienne)
}

export interface BackupEntry {
  id: string;
  filename: string; // Ex: "backup_prestige_2026-09-15_120000.zip"
  created_at: string; // ISO 8601 UTC
  size_bytes: number;
  trigger_type: "manual" | "auto_daily";
  records_count: {
    articles: number;
    clients: number;
    locations: number;
    paiements: number;
    ventes: number;
    pdf_count: number;
  };
  blob_url?: string;
  sqlite_path?: string;
  raw_data?: Record<string, unknown>;
}

export type AuditActionType =
  | "DELETE_CLIENT"
  | "DELETE_ARTICLE"
  | "DELETE_CONTRACT"
  | "UPDATE_PRICE"
  | "UPDATE_STATUS"
  | "CREATE_CONTRACT"
  | "PROCESS_SALE"
  | "CLOTURE_CAISSE"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "CREATE_BACKUP"
  | "UPDATE_SETTINGS"
  | "WHATSAPP_REMINDER";

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: AuditActionType;
  entity_table: string; // "articles" | "clients" | "locations" | "ventes" | "parametres" | "session"
  entity_id: string;
  details: string;
  created_at: string; // ISO 8601 UTC
}
