// ============================================================================
// TYPES MODULE I — AUTHENTIFICATION & RÔLES
// ============================================================================

export type UserRole = "admin" | "vendeur";

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  password_hash: string;
  last_login?: string;
  created_at: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthPermissions {
  canAccessSettings: boolean;
  canDelete: boolean;
  canEditPrices: boolean;
  canViewAuditLogs: boolean;
  canCreateBackups: boolean;
}
