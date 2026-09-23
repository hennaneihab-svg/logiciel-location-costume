import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSettingsStore } from "@/store/settingsStore";
import * as tauriService from "@/services/tauri";

describe("D2 — settingsStore migration vers SQLite & zéro écriture localStorage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("Cas 1 : migration one-shot depuis localStorage vers SQLite si base vide", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

    const legacyBoutique = {
      name: "Boutique Historique LocalStorage",
      slogan: "Slogan LocalStorage",
      city: "Annaba",
      address: "10 Rue de la Révolution",
      postal_code: "23000",
      phone: "038 12 34 56",
      email: "contact@annaba.dz",
      siret: "123456789",
      rcs: "23/00-12345",
      website: "www.annaba.dz",
      logo_url: "logo.png",
      legal_notice: "TVA 19%",
    };

    localStorage.setItem("atelier_prestige_db_settings", JSON.stringify(legacyBoutique));

    const invokedCommands: { cmd: string; args: any }[] = [];
    vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd, args) => {
      invokedCommands.push({ cmd, args });
      if (cmd === "get_all_settings") {
        // Base SQLite vierge / non encore initialisée
        return {} as any;
      }
      return {} as any;
    });

    await useSettingsStore.getState().loadSettings();

    // Vérifier que la migration one-shot a envoyé les réglages à SQLite
    const setSettingCalls = invokedCommands.filter((c) => c.cmd === "set_setting");
    expect(setSettingCalls.some((c) => c.args?.cle === "boutique")).toBe(true);

    // Vérifier que le store Zustand a pris la valeur migrée
    expect(useSettingsStore.getState().boutique.name).toBe("Boutique Historique LocalStorage");
  });

  it("Cas 2 : après initialisation, settingsStore ne touche plus JAMAIS localStorage en écriture", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

    const sqliteSettings = {
      boutique: JSON.stringify({
        name: "Boutique Pure SQLite",
        slogan: "Excellence",
        city: "Alger",
      }),
      numerotation: JSON.stringify({
        rental_prefix: "LOC",
        sale_prefix: "VTE",
        quote_prefix: "DEV",
        year_format: "YYYY",
        padding_digits: 4,
      }),
      fiscalite: JSON.stringify({
        default_vat_rate: 0.19,
        currency: "DZD",
        currency_symbol: "DA",
      }),
      backups: "[]",
      audit_logs: "[]",
    };

    const invokedCommands: { cmd: string; args: any }[] = [];
    vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd, args) => {
      invokedCommands.push({ cmd, args });
      if (cmd === "get_all_settings") {
        return sqliteSettings as any;
      }
      return {} as any;
    });

    // Charger les settings depuis SQLite
    await useSettingsStore.getState().loadSettings();

    // Espionner localStorage.setItem pour s'assurer qu'il n'est PLUS JAMAIS appelé
    const localStorageSetItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // 1. Mise à jour de la boutique
    useSettingsStore.getState().updateBoutiqueSettings({
      name: "Boutique Modifiée Sans LocalStorage",
      city: "Oran",
    });

    // 2. Mise à jour de la numérotation
    useSettingsStore.getState().updateNumberingSettings({
      rental_prefix: "PRESTIGE-LOC",
    });

    // 3. Mise à jour de la fiscalité
    useSettingsStore.getState().updateTaxSettings({
      default_vat_rate: 0.15,
    });

    // 4. Ajout d'un événement d'audit
    useSettingsStore.getState().logAuditEvent(
      "UPDATE_SETTINGS",
      "parametres",
      "test",
      "Modification réglages"
    );

    // 5. Purge de l'audit
    useSettingsStore.getState().clearAuditLogs();

    // Vérification formelle : AUCUN appel à localStorage.setItem n'a été fait !
    expect(localStorageSetItemSpy).not.toHaveBeenCalled();

    // Vérification formelle : les écritures ont été dirigées vers SQLite via invokeCommand
    const setCalls = invokedCommands.filter((c) => c.cmd === "set_setting");
    expect(setCalls.length).toBeGreaterThanOrEqual(4);
    expect(setCalls.some((c) => c.args?.cle === "boutique")).toBe(true);
    expect(setCalls.some((c) => c.args?.cle === "numerotation")).toBe(true);
    expect(setCalls.some((c) => c.args?.cle === "fiscalite")).toBe(true);
    expect(setCalls.some((c) => c.args?.cle === "audit_logs")).toBe(true);

    // Vérifier l'état dans Zustand
    expect(useSettingsStore.getState().boutique.name).toBe("Boutique Modifiée Sans LocalStorage");
    expect(useSettingsStore.getState().numbering.rental_prefix).toBe("PRESTIGE-LOC");
    expect(useSettingsStore.getState().tax.default_vat_rate).toBe(0.15);
  });
});
