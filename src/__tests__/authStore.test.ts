import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store/authStore";

describe("Module Authentification & Sécurité — useAuthStore", () => {
  beforeEach(() => {
    // Réinitialiser l'état du store avant chaque test
    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
    });
  });

  it("Refuse la connexion si l'identifiant est inconnu", () => {
    const res = useAuthStore.getState().login({
      username: "utilisateur_inexistant",
      password: "password123",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Identifiant inconnu");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it("Refuse la connexion si le mot de passe est incorrect", () => {
    const res = useAuthStore.getState().login({
      username: "admin",
      password: "mauvais_password",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("Mot de passe incorrect");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it("Connecte avec succès le compte admin avec le mot de passe valide", () => {
    const res = useAuthStore.getState().login({
      username: "admin",
      password: "admin123",
    });

    expect(res.success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    const currentUser = useAuthStore.getState().currentUser;
    expect(currentUser).not.toBeNull();
    expect(currentUser?.role).toBe("admin");
    expect(currentUser?.username).toBe("admin");

    // Vérifier les permissions de l'administrateur
    const perms = useAuthStore.getState().getPermissions();
    expect(perms.canAccessSettings).toBe(true);
    expect(perms.canDelete).toBe(true);
    expect(perms.canEditPrices).toBe(true);
    expect(perms.canViewAuditLogs).toBe(true);
    expect(perms.canCreateBackups).toBe(true);
  });

  it("Connecte le compte vendeur et vérifie les restrictions de rôle", () => {
    const res = useAuthStore.getState().login({
      username: "vendeur",
      password: "vendeur123",
    });

    expect(res.success).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    const currentUser = useAuthStore.getState().currentUser;
    expect(currentUser?.role).toBe("vendeur");

    // Vérifier les permissions restreintes du vendeur
    const perms = useAuthStore.getState().getPermissions();
    expect(perms.canAccessSettings).toBe(false);
    expect(perms.canDelete).toBe(false);
    expect(perms.canEditPrices).toBe(false);
    expect(perms.canViewAuditLogs).toBe(false);
    expect(perms.canCreateBackups).toBe(false);
  });

  it("Déconnecte correctement l'utilisateur lors du logout", () => {
    useAuthStore.getState().login({
      username: "admin",
      password: "admin123",
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().currentUser).toBeNull();
  });
});
