import { describe, it, expect } from "vitest";
import { useAlertStore } from "@/store/alertStore";

describe("Module E — Moteur d Alertes & Rappels de Retour", () => {
  it("Crée une alerte de type retard pour un contrat dont la date de retour est passée", () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const contracts = [
      {
        id: "loc-test-overdue",
        contract_number: "LOC-TEST-001",
        status: "en_cours",
        customer_name: "Jean Dupont",
        customer_phone: "06 12 34 56 78",
        return_date_scheduled: yesterday,
        items: [{ article_name: "Costume Smoking Noir" }],
      },
    ];

    useAlertStore.getState().generateAlertsFromRentals(contracts);
    const alerts = useAlertStore.getState().alerts;
    const alert = alerts.find((a) => a.contract_id === "loc-test-overdue");

    expect(alert).toBeDefined();
    expect(alert?.category).toBe("retard_retour");
    expect(alert?.severity).toBe("critique");
    expect(alert?.days_overdue).toBeGreaterThan(0);
    expect(alert?.late_fee_cents).toBeGreaterThan(0);
  });

  it("Crée une alerte de type retour_jour_j pour un contrat dont le retour est prévu aujourd hui", () => {
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

    const contracts = [
      {
        id: "loc-test-today",
        contract_number: "LOC-TEST-002",
        status: "en_cours",
        customer_name: "Marie Curie",
        customer_phone: "06 98 76 54 32",
        return_date_scheduled: today,
        items: [{ article_name: "Robe de Cérémonie" }],
      },
    ];

    useAlertStore.getState().generateAlertsFromRentals(contracts);
    const alerts = useAlertStore.getState().alerts;
    const alert = alerts.find((a) => a.contract_id === "loc-test-today");

    expect(alert).toBeDefined();
    expect(alert?.category).toBe("retour_jour_j");
    expect(alert?.severity).toBe("avertissement");
    expect(alert?.days_overdue).toBe(0);
  });

  it("Marque une alerte comme vue puis traitée sans la supprimer (traçabilité)", () => {
    const alerts = useAlertStore.getState().alerts;
    const activeAlert = alerts.find((a) => a.status === "active");
    expect(activeAlert).toBeDefined();

    if (activeAlert) {
      useAlertStore.getState().markAsViewed(activeAlert.id);
      let updated = useAlertStore.getState().alerts.find((a) => a.id === activeAlert.id);
      expect(updated?.viewed_at).toBeDefined();

      useAlertStore.getState().markAsProcessed(activeAlert.id, "Client contacté par téléphone", "Administrateur");
      updated = useAlertStore.getState().alerts.find((a) => a.id === activeAlert.id);
      expect(updated?.status).toBe("traitee");
      expect(updated?.processed_by).toBe("Administrateur");
      expect(updated?.processed_comment).toContain("Client contacté");
    }
  });
});
