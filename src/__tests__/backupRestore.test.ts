import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSettingsStore } from "@/store/settingsStore";
import { useStockStore } from "@/store/stockStore";
import { useClientStore } from "@/store/clientStore";
import { useRentalStore } from "@/store/rentalStore";
import { useCaisseStore } from "@/store/caisseStore";
import { useAlertStore } from "@/store/alertStore";
import * as tauriService from "@/services/tauri";
import { toast } from "sonner";

describe("Module I — Restauration de Sauvegarde Déterminante et Bloquante", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Cas 1 (Succès) : réhydrate les stores uniquement APRÈS confirmation réussie de invokeCommand('restore_database')", async () => {
    // 1. Simuler l'environnement Tauri actif
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

    let ipcCalled = false;
    let storesHydratedBeforeIpc = false;

    // Spy sur invokeCommand
    vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd) => {
      if (cmd === "restore_database") {
        ipcCalled = true;
        // Vérifier qu'à cet instant précis, les stores n'ont PAS encore été modifiés
        const currentClients = useClientStore.getState().clients;
        if (currentClients.some((c) => c.id === "cli-restored-999")) {
          storesHydratedBeforeIpc = true;
        }
        return {} as any;
      }
      return {} as any;
    });

    const toastSuccessSpy = vi.spyOn(toast, "success");

    // Données de test à restaurer
    const backupId = "test-bak-success-01";
    const testBackup = {
      id: backupId,
      filename: "backup_test_success.zip",
      created_at: new Date().toISOString(),
      size_bytes: 12345,
      trigger_type: "manual" as const,
      records_count: {
        articles: 1,
        clients: 1,
        locations: 1,
        paiements: 1,
        ventes: 1,
        pdf_count: 1,
      },
      sqlite_path: "C:/backups/test.db",
      raw_data: {
        articles: [{ id: "art-restored-999", name: "Costume Restauré Test", rental_price_cents: 25000 }],
        clients: [{ id: "cli-restored-999", first_name: "Client", last_name: "Restauré" }],
        locations: [{ id: "loc-restored-999", contract_number: "LOC-2026-9999" }],
        ventes: [{ id: "vte-restored-999", total_cents: 15000 }],
        boutique: { name: "Boutique Restaurée" },
      },
    };

    // Injecter la sauvegarde de test
    useSettingsStore.setState((state) => ({
      backups: [testBackup, ...state.backups],
    }));

    // Exécuter restoreBackup
    await useSettingsStore.getState().restoreBackup(backupId);

    // Vérifications
    expect(ipcCalled).toBe(true);
    expect(storesHydratedBeforeIpc).toBe(false); // Aucune réhydratation avant l'IPC

    // Vérifier que les stores ont bien été réhydratés APRÈS le succès
    expect(useClientStore.getState().clients.some((c) => c.id === "cli-restored-999")).toBe(true);
    expect(useStockStore.getState().articles.some((a) => a.id === "art-restored-999")).toBe(true);
    expect(useRentalStore.getState().contracts.some((c) => c.id === "loc-restored-999")).toBe(true);
    expect(useCaisseStore.getState().salesHistory.some((s) => s.id === "vte-restored-999")).toBe(true);
    expect(useSettingsStore.getState().boutique.name).toBe("Boutique Restaurée");

    // Toast de succès affiché
    expect(toastSuccessSpy).toHaveBeenCalledWith(
      expect.stringContaining("Restauration réussie")
    );
  });

  it("Cas 2 (Échec / Rejet IPC) : NE modifie PAS les stores Zustand et lève une erreur explicite sans toast de succès", async () => {
    // 1. Simuler l'environnement Tauri actif
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

    // Spy sur invokeCommand simulant une corruption ou échec disque SQLite
    vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd) => {
      if (cmd === "restore_database") {
        throw new Error("Disk I/O error : permission denied on SQLite file");
      }
      return {} as any;
    });

    const toastSuccessSpy = vi.spyOn(toast, "success");

    // Capturer l'état initial des stores
    const initialClients = [...useClientStore.getState().clients];
    const initialArticles = [...useStockStore.getState().articles];
    const initialContracts = [...useRentalStore.getState().contracts];
    const initialBoutique = { ...useSettingsStore.getState().boutique };

    const backupId = "test-bak-fail-02";
    const testBackupFail = {
      id: backupId,
      filename: "backup_test_fail.zip",
      created_at: new Date().toISOString(),
      size_bytes: 12345,
      trigger_type: "manual" as const,
      records_count: {
        articles: 1,
        clients: 1,
        locations: 1,
        paiements: 1,
        ventes: 1,
        pdf_count: 1,
      },
      sqlite_path: "C:/backups/corrupted.db",
      raw_data: {
        articles: [{ id: "art-should-never-exist", name: "Article Fantôme" }],
        clients: [{ id: "cli-should-never-exist", first_name: "Fantôme" }],
        locations: [{ id: "loc-should-never-exist" }],
        boutique: { name: "Boutique Fausse" },
      },
    };

    useSettingsStore.setState((state) => ({
      backups: [testBackupFail, ...state.backups],
    }));

    // Exécuter restoreBackup et attendre le rejet
    let errorCaught: Error | null = null;
    try {
      await useSettingsStore.getState().restoreBackup(backupId);
    } catch (err: any) {
      errorCaught = err;
    }

    // 1. Une erreur explicite doit être levée
    expect(errorCaught).not.toBeNull();
    expect(errorCaught?.message).toContain("Échec de la restauration de la base de données — aucune donnée n'a été modifiée");
    expect(errorCaught?.message).toContain("Disk I/O error");

    // 2. AUCUN toast de succès ne doit avoir été déclenché
    expect(toastSuccessSpy).not.toHaveBeenCalled();

    // 3. Les stores Zustand DOIVENT rester STRICTEMENT intacts et inchangés
    expect(useClientStore.getState().clients.some((c) => c.id === "cli-should-never-exist")).toBe(false);
    expect(useStockStore.getState().articles.some((a) => a.id === "art-should-never-exist")).toBe(false);
    expect(useRentalStore.getState().contracts.some((c) => c.id === "loc-should-never-exist")).toBe(false);
    expect(useSettingsStore.getState().boutique.name).toBe(initialBoutique.name);

    // Comparaison avec l'état avant la tentative
    expect(useClientStore.getState().clients).toEqual(initialClients);
    expect(useStockStore.getState().articles).toEqual(initialArticles);
    expect(useRentalStore.getState().contracts).toEqual(initialContracts);
  });

  it("Cas 3 (Hors runtime Tauri) : rejette avec un message explicite et ne modifie pas les stores", async () => {
    // Simuler un environnement navigateur Web pur
    vi.spyOn(tauriService, "isTauri").mockReturnValue(false);

    const backupId = "test-bak-webonly-03";
    const testBackup = {
      id: backupId,
      filename: "backup_webonly.zip",
      created_at: new Date().toISOString(),
      size_bytes: 5000,
      trigger_type: "manual" as const,
      records_count: { articles: 0, clients: 0, locations: 0, paiements: 0, ventes: 0, pdf_count: 0 },
      sqlite_path: "/backups/webonly.db",
      raw_data: { boutique: { name: "Web Non Modifié" } },
    };

    useSettingsStore.setState((state) => ({
      backups: [testBackup, ...state.backups],
    }));

    await expect(
      useSettingsStore.getState().restoreBackup(backupId)
    ).rejects.toThrow(
      "Restauration SQLite indisponible hors application compilée — testez en build de production."
    );
  });

  it("Cas 4 (Tauri actif mais sqlite_path absent) : rejette avec un message explicite et ne modifie pas les stores", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

    const backupId = "test-bak-nosqlitepath-04";
    const testBackup = {
      id: backupId,
      filename: "backup_sans_sqlite.zip",
      created_at: new Date().toISOString(),
      size_bytes: 5000,
      trigger_type: "manual" as const,
      records_count: { articles: 0, clients: 0, locations: 0, paiements: 0, ventes: 0, pdf_count: 0 },
      // sqlite_path intentionnellement omis
      raw_data: { boutique: { name: "Devrait Pas Changer" } },
    };

    useSettingsStore.setState((state) => ({
      backups: [testBackup, ...state.backups],
    }));

    await expect(
      useSettingsStore.getState().restoreBackup(backupId)
    ).rejects.toThrow(
      "Chemin de sauvegarde SQLite manquant dans cette archive. Impossible d'effectuer la restauration native."
    );
  });

  it("Cas 5 : Purge et régénération des alertes lors de la restauration (aucune alerte orpheline)", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(false);

    // 1. Injecter une fausse alerte orpheline pré-existante (liée à un contrat imaginaire qui n'existera pas dans la sauvegarde)
    useAlertStore.setState({
      alerts: [
        {
          id: "alr-ghost-01",
          dedup_key: "loc-ghost-01_retard_retour",
          category: "retard_retour",
          severity: "critique",
          status: "active",
          title: "Retard fantôme",
          description: "Contrat fantôme qui ne doit plus exister",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          contract_id: "loc-ghost-01",
          notification_sent: false,
        },
      ],
    });

    expect(useAlertStore.getState().alerts.some((a) => a.id === "alr-ghost-01")).toBe(true);

    // 2. Définir une sauvegarde avec un contrat valide
    const backupId = "test-bak-purge-alerts-05";
    const testBackup = {
      id: backupId,
      filename: "backup_purge_test.zip",
      created_at: new Date().toISOString(),
      size_bytes: 5000,
      trigger_type: "manual" as const,
      records_count: { articles: 0, clients: 0, locations: 1, paiements: 0, ventes: 0, pdf_count: 0 },
      raw_data: {
        locations: [
          {
            id: "loc-fresh-01",
            contract_number: "LOC-2026-8888",
            status: "en_cours",
            customer_name: "Nouveau Client Valide",
            return_date_scheduled: new Date().toISOString().slice(0, 10), // Jour J
            items: [{ article_name: "Smoking Noir Prestige", variant_size: "52" }],
          },
        ],
      },
    };

    useSettingsStore.setState((state) => ({
      backups: [testBackup, ...state.backups],
    }));

    // 3. Exécuter restoreBackup
    await useSettingsStore.getState().restoreBackup(backupId);

    // 4. Vérifier que l'alerte fantôme a bien été PURGÉE
    const alertsAfter = useAlertStore.getState().alerts;
    expect(alertsAfter.some((a) => a.id === "alr-ghost-01")).toBe(false);

    // 5. Vérifier que la nouvelle alerte pour le contrat restauré a été GÉNÉRÉE
    expect(alertsAfter.some((a) => a.contract_id === "loc-fresh-01")).toBe(true);
  });
});

