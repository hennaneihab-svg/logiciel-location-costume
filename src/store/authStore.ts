import { create } from "zustand";
import bcrypt from "bcryptjs";
import type { AuthUser, AuthCredentials, AuthPermissions } from "@/types/auth";
import { isTauri, invokeCommand } from "@/services/tauri";
import { useSettingsStore } from "@/store/settingsStore";
import { logger } from "@/lib/logger";

// Mots de passe hashés avec bcrypt (salt rounds = 10)
// admin123 -> $2a$10$0zB2b5Mv4nQzD.K9bZq3be0c8Z5UoK2x3W7/6jH3nK1e9Gq1r2y7y (exemples validés)
const ADMIN_HASH = bcrypt.hashSync("admin123", 10);
const VENDEUR_HASH = bcrypt.hashSync("vendeur123", 10);

export const INITIAL_USERS: AuthUser[] = [
  {
    id: "usr-001",
    username: "admin",
    full_name: "Jean-Philippe Directeur",
    role: "admin",
    is_active: true,
    password_hash: ADMIN_HASH,
    created_at: "2026-06-01T08:00:00.000Z",
    last_login: "2026-09-14T08:30:00.000Z",
  },
  {
    id: "usr-002",
    username: "vendeur",
    full_name: "Sophie Vendeuse",
    role: "vendeur",
    is_active: true,
    password_hash: VENDEUR_HASH,
    created_at: "2026-06-01T08:00:00.000Z",
    last_login: "2026-09-14T09:15:00.000Z",
  },
];

export interface InitialSetupData {
  adminUsername: string;
  adminFullName: string;
  adminPassword: string;
  boutiqueName: string;
  boutiqueAddress: string;
  boutiquePhone: string;
  activityType: "homme" | "femme" | "mixte";
}

interface AuthStoreState {
  users: AuthUser[];
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isSetupRequired: boolean;
  inactivityTimeoutMinutes: number; // Durée configurable en minutes (0 = désactivé)

  // Actions
  login: (credentials: AuthCredentials) => { success: boolean; error?: string };
  logout: () => void;
  switchUserRole: (role: "admin" | "vendeur") => void; // Raccourci rapide pour tests
  setInactivityTimeoutMinutes: (minutes: number) => void;
  touchActivity: () => void;
  checkSetupRequired: () => Promise<boolean>;
  loadUsers: () => Promise<void>;
  completeSetup: (data: InitialSetupData) => Promise<{ success: boolean; error?: string }>;

  // Permissions calculées
  getPermissions: () => AuthPermissions;
}

let lastActivityTimestamp = Date.now();

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  users: INITIAL_USERS,
  // Par défaut, l'application démarre DÉCONNECTÉE pour la sécurité
  currentUser: null,
  isAuthenticated: false,
  isSetupRequired: false,
  inactivityTimeoutMinutes: 15, // 15 minutes par défaut sur poste partagé

  checkSetupRequired: async () => {
    if (isTauri()) {
      try {
        const required = await invokeCommand<boolean>("check_setup_required");
        set({ isSetupRequired: required });
        if (!required) {
          await get().loadUsers();
        } else {
          set({ users: [] });
        }
        return required;
      } catch (err) {
        logger.error("useAuthStore: Erreur check_setup_required", err);
        return false;
      }
    }
    // Mode Web / Vitest fallback
    const required = get().users.length === 0;
    set({ isSetupRequired: required });
    return required;
  },

  loadUsers: async () => {
    if (isTauri()) {
      try {
        const users = await invokeCommand<AuthUser[]>("list_auth_users");
        if (users && users.length > 0) {
          set({ users });
        }
      } catch (err) {
        logger.error("useAuthStore: Erreur chargement utilisateurs depuis SQLite", err);
      }
    }
  },

  completeSetup: async (data: InitialSetupData) => {
    // 1. Validation des contraintes de sécurité minimales
    if (!data.adminUsername || data.adminUsername.trim().length === 0) {
      return { success: false, error: "L'identifiant administrateur est requis." };
    }
    if (!data.adminPassword || data.adminPassword.length < 8) {
      return { success: false, error: "Le mot de passe doit contenir au moins 8 caractères." };
    }
    if (!data.boutiqueName || data.boutiqueName.trim().length === 0) {
      return { success: false, error: "Le nom de la boutique est requis." };
    }

    const passwordHash = bcrypt.hashSync(data.adminPassword, 10);
    const now = new Date().toISOString();
    const newAdminUser: AuthUser = {
      id: `usr-admin-${Date.now()}`,
      username: data.adminUsername.trim(),
      full_name: data.adminFullName.trim() || "Administrateur",
      role: "admin",
      is_active: true,
      password_hash: passwordHash,
      created_at: now,
      last_login: now,
    };

    if (isTauri()) {
      try {
        await invokeCommand("complete_initial_setup", {
          dto: {
            admin_username: data.adminUsername.trim(),
            admin_full_name: data.adminFullName.trim(),
            admin_password_hash: passwordHash,
            boutique_name: data.boutiqueName.trim(),
            boutique_address: data.boutiqueAddress.trim(),
            boutique_phone: data.boutiquePhone.trim(),
            activity_type: data.activityType,
          },
        });
      } catch (err: any) {
        return { success: false, error: err?.message || "Échec de l'enregistrement de la configuration initiale." };
      }
    }

    // Mise à jour de l'état local
    set({
      users: [newAdminUser],
      currentUser: newAdminUser,
      isAuthenticated: true,
      isSetupRequired: false,
    });

    // Nettoyage complet du localStorage et réinitialisation des stores pour base 100% vierge
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem("atelier_prestige_db_articles");
      localStorage.removeItem("atelier_prestige_db_clients");
      localStorage.removeItem("atelier_prestige_db_contracts");
      localStorage.removeItem("atelier_prestige_db_sales");
      localStorage.removeItem("atelier_prestige_db_alerts");
      localStorage.removeItem("atelier_prestige_db_packs");
    }

    useSettingsStore.getState().updateBoutiqueSettings({
      name: data.boutiqueName.trim(),
      address: data.boutiqueAddress.trim(),
      phone: data.boutiquePhone.trim(),
      activity_type: data.activityType,
    });

    return { success: true };
  },

  login: ({ username, password }) => {
    const { users } = get();
    const user = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user) {
      return { success: false, error: "Identifiant inconnu." };
    }

    if (!user.is_active) {
      return { success: false, error: "Ce compte utilisateur est désactivé." };
    }

    // Vérification cryptographique via bcrypt
    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      return { success: false, error: "Mot de passe incorrect." };
    }

    const updatedUser: AuthUser = {
      ...user,
      last_login: new Date().toISOString(),
    };

    set((state) => ({
      currentUser: updatedUser,
      isAuthenticated: true,
      users: state.users.map((u) => (u.id === user.id ? updatedUser : u)),
    }));

    lastActivityTimestamp = Date.now();
    return { success: true };
  },

  logout: () => {
    set({ currentUser: null, isAuthenticated: false });
  },

  switchUserRole: (role) => {
    const target = get().users.find((u) => u.role === role);
    if (target) {
      lastActivityTimestamp = Date.now();
      set({ currentUser: target, isAuthenticated: true });
    }
  },

  setInactivityTimeoutMinutes: (minutes) => {
    set({ inactivityTimeoutMinutes: minutes });
  },

  touchActivity: () => {
    const { isAuthenticated, inactivityTimeoutMinutes, logout } = get();
    if (!isAuthenticated || inactivityTimeoutMinutes <= 0) {
      lastActivityTimestamp = Date.now();
      return;
    }

    const elapsedMs = Date.now() - lastActivityTimestamp;
    const timeoutMs = inactivityTimeoutMinutes * 60 * 1000;

    if (elapsedMs > timeoutMs) {
      logout();
    } else {
      lastActivityTimestamp = Date.now();
    }
  },

  getPermissions: () => {
    const { currentUser } = get();
    const isAdmin = currentUser?.role === "admin";

    return {
      canAccessSettings: isAdmin,
      canDelete: isAdmin,
      canEditPrices: isAdmin,
      canViewAuditLogs: isAdmin,
      canCreateBackups: isAdmin,
    };
  },
}));
