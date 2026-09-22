import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { useAlertStore } from "@/store/alertStore";
import { usePressingStore } from "@/store/pressingStore";
import { useStockStore } from "@/store/stockStore";
import { NewPressingDispatchModal } from "@/components/pressing/NewPressingDispatchModal";
import type { PressingDispatch } from "@/types/pressing";

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

  describe("Envoi par lot & Remontée des pièces ignorées (F1, F2, F3)", () => {
    it("F1: createDispatch renvoie explicitement dispatches ET skipped avec le numéro d'envoi actif", async () => {
      const existingDispatch: PressingDispatch = {
        id: "prs-active-01",
        numero_envoi: "PRS-2026-0007",
        variante_id: "var-001",
        article_id: "art-1",
        article_name: "Smoking Noir Prestige",
        reference: "SMK-01",
        size: "52",
        cout_centimes: 150000,
        statut_paiement_prestataire: "a_payer",
        date_envoi: "2026-09-20",
        date_retour_prevue: "2026-09-25",
        statut: "envoye",
        utilisateur_id: "usr-001",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        has_photo: false,
      };

      usePressingStore.setState({
        dispatches: [existingDispatch],
      });

      const result = await usePressingStore.getState().createDispatch({
        variante_ids: ["var-001", "var-002"],
        date_retour_prevue: "2026-10-15",
        force: false,
      });

      // 1 pièce créée (var-002)
      expect(result.dispatches).toHaveLength(1);
      expect(result.dispatches[0].variante_id).toBe("var-002");

      // 1 pièce ignorée (var-001) avec numéro d'envoi actif (F1)
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].variante_id).toBe("var-001");
      expect(result.skipped[0].numero_envoi_actif).toBe("PRS-2026-0007");
      expect(result.skipped[0].message).toContain("PRS-2026-0007");
      expect(result.skipped[0].message).toContain("déjà envoyée au pressing");
    });

    it("F2 & F3: NewPressingDispatchModal affiche côte à côte la confirmation et l'alerte distincte", async () => {
      const existingDispatch: PressingDispatch = {
        id: "prs-active-01",
        numero_envoi: "PRS-2026-0007",
        variante_id: "var-001",
        article_id: "art-1",
        article_name: "Smoking Noir Prestige",
        reference: "SMK-01",
        size: "52",
        cout_centimes: 150000,
        statut_paiement_prestataire: "a_payer",
        date_envoi: "2026-09-20",
        date_retour_prevue: "2026-09-25",
        statut: "envoye",
        utilisateur_id: "usr-001",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        has_photo: false,
      };

      usePressingStore.setState({
        providers: [{
          id: "prv-01",
          nom: "Blanchisserie Royale",
          delai_defaut_jours: 3,
          actif: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
        dispatches: [existingDispatch],
      });

      useStockStore.setState({
        articles: [
          {
            id: "art-1",
            nom: "Smoking Noir Prestige",
            name: "Smoking Noir Prestige",
            reference: "SMK-01",
            prix_location_centimes: 15000,
            caution_suggeree_centimes: 45000,
            frais_nettoyage_centimes: 1500,
            description: "",
            est_actif: true,
            created_at: "",
            updated_at: "",
            variants: [
              {
                id: "var-001",
                article_id: "art-1",
                size: "52",
                taille: "52",
                status: "disponible",
                statut: "disponible",
                code_barre: "BAR-001",
                etat_usure: "excellent",
                nb_locations: 1,
                created_at: "",
                updated_at: "",
              },
              {
                id: "var-002",
                article_id: "art-1",
                size: "54",
                taille: "54",
                status: "disponible",
                statut: "disponible",
                code_barre: "BAR-002",
                etat_usure: "excellent",
                nb_locations: 0,
                created_at: "",
                updated_at: "",
              },
            ],
          } as any,
        ],
      });

      const toastWarningSpy = vi.spyOn(toast, "warning");
      const toastSuccessSpy = vi.spyOn(toast, "success");

      render(
        React.createElement(NewPressingDispatchModal, {
          isOpen: true,
          onClose: () => {},
          initialVariantIds: ["var-001", "var-002"],
        })
      );

      // Bouton de confirmation d'envoi
      const submitBtn = screen.getByRole("button", { name: /Confirmer l'envoi/i });
      fireEvent.click(submitBtn);

      // Vérification que les deux sections côte à côte s'affichent
      await waitFor(() => {
        expect(screen.getByTestId("dispatched-items-section")).toBeTruthy();
        expect(screen.getByTestId("skipped-items-section")).toBeTruthy();
      });

      // 1. Section pièces envoyées
      const dispatchedSection = screen.getByTestId("dispatched-items-section");
      expect(dispatchedSection.textContent).toContain("1 pièce(s) envoyée(s)");
      expect(dispatchedSection.textContent).toContain("Taille : 54");

      // 2. Section alerte pièces ignorées (avec numéro actif)
      const skippedSection = screen.getByTestId("skipped-items-section");
      expect(skippedSection.textContent).toContain("1 pièce(s) ignorée(s)");
      expect(skippedSection.textContent).toContain("PRS-2026-0007");
      expect(skippedSection.textContent).toContain("Smoking Noir Prestige");

      // 3. Toasts distincts appelés (l'utilisateur est averti, pas de succès silencieux)
      expect(toastSuccessSpy).toHaveBeenCalled();
      expect(toastWarningSpy).toHaveBeenCalledWith(
        expect.stringContaining("1 pièce(s) ignorée(s) : déjà au pressing"),
        expect.anything()
      );
    });
  });
});

