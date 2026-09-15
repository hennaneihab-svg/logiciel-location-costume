import { create } from "zustand";
import bcrypt from "bcryptjs";
import type { AuthUser, AuthCredentials, AuthPermissions } from "@/types/auth";

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

interface AuthStoreState {
  users: AuthUser[];
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  inactivityTimeoutMinutes: number; // Durée configurable en minutes (0 = désactivé)

  // Actions
  login: (credentials: AuthCredentials) => { success: boolean; error?: string };
  logout: () => void;
  switchUserRole: (role: "admin" | "vendeur") => void; // Raccourci rapide pour tests
  setInactivityTimeoutMinutes: (minutes: number) => void;
  touchActivity: () => void;

  // Permissions calculées
  getPermissions: () => AuthPermissions;
}

let lastActivityTimestamp = Date.now();

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  users: INITIAL_USERS,
  // Par défaut, l'application démarre DÉCONNECTÉE pour la sécurité
  currentUser: null,
  isAuthenticated: false,
  inactivityTimeoutMinutes: 15, // 15 minutes par défaut sur poste partagé

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
