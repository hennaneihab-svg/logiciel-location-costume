import { describe, it, expect, beforeEach } from "vitest";
import { useAlertStore } from "@/store/alertStore";
import { usePressingStore } from "@/store/pressingStore";

describe("Module Pressing — Alertes & Store Frontend", () => {
  beforeEach(() => {
    // Reset alert store
    useAlertStore.setState({ alerts: [] });
  });

  describe("Moteur d'alertes retard_pressing", () => {
    it("Génère un avertissement pour un retard pressing de moins de 3 jours", () => {
      const yesterday = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);

      const dispatches = [
        {
          id: "prs-test-01",
          numero_envoi: "PRS-2026-0001",
          statut: "envoye",
          nom_prestataire: "Pressing Étoile",
          date_retour_prevue: yesterday,
          designation_article: "Smoking Noir Prestige",
          taille: "52",
        },
      ];

      useAlertStore.getState().generateAlertsFromPressing(dispatches);
      const alerts = useAlertStore.getState().alerts;
      const alert = alerts.find((a) => a.pressing_dispatch_id === "prs-test-01");

      expect(alert).toBeDefined();
      expect(alert?.category).toBe("retard_pressing");
      expect(alert?.severity).toBe("avertissement");
      expect(alert?.days_overdue).toBe(1);
      expect(alert?.pressing_dispatch_number).toBe("PRS-2026-0001");
    });

    it("Génère une alerte critique pour un retard pressing d'au moins 3 jours", () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);

      const dispatches = [
        {
          id: "prs-test-02",
          numero_envoi: "PRS-2026-0002",
          statut: "en_traitement",
          nom_prestataire: "Atelier Interne",
          date_retour_prevue: fourDaysAgo,
          designation_article: "Robe de Soirée Bleue",
        },
      ];

      const newCritical = useAlertStore.getState().generateAlertsFromPressing(dispatches);
      const alerts = useAlertStore.getState().alerts;
      const alert = alerts.find((a) => a.pressing_dispatch_id === "prs-test-02");

      expect(alert).toBeDefined();
      expect(alert?.category).toBe("retard_pressing");
      expect(alert?.severity).toBe("critique");
      expect(alert?.days_overdue).toBe(4);
      expect(newCritical).toContain(alert?.id);
    });

    it("Supprime l'alerte dès que l'envoi est réceptionné ou annulé", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

      const dispatches = [
        {
          id: "prs-test-03",
          numero_envoi: "PRS-2026-0003",
          statut: "envoye",
          nom_prestataire: "Pressing Rapide",
          date_retour_prevue: threeDaysAgo,
          designation_article: "Costume 3 Pièces",
        },
      ];

      useAlertStore.getState().generateAlertsFromPressing(dispatches);
      expect(useAlertStore.getState().alerts.some((a) => a.pressing_dispatch_id === "prs-test-03")).toBe(true);

      // Réception de la pièce
      const updatedDispatches = [
        {
          ...dispatches[0],
          statut: "recu",
        },
      ];

      useAlertStore.getState().generateAlertsFromPressing(updatedDispatches);
      expect(useAlertStore.getState().alerts.some((a) => a.pressing_dispatch_id === "prs-test-03")).toBe(false);
    });
  });

  describe("Pressing Store", () => {
    it("Permet de modifier l'état d'activation du module", async () => {
      const store = usePressingStore.getState();
      const initial = store.isModuleActive;

      await store.setModuleActive(!initial);
      expect(usePressingStore.getState().isModuleActive).toBe(!initial);

      // Rebascule à la valeur initiale
      await store.setModuleActive(initial);
      expect(usePressingStore.getState().isModuleActive).toBe(initial);
    });

    it("Gère la liste des prestataires et les dispatches dans le mock fallback", async () => {
      const store = usePressingStore.getState();
      await store.loadProviders(true);
      await store.loadDispatches();

      expect(Array.isArray(store.providers)).toBe(true);
      expect(Array.isArray(store.dispatches)).toBe(true);
    });
  });
});
