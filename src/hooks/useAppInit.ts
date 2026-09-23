import { useState, useEffect, useCallback } from "react";
import { useRentalStore } from "@/store/rentalStore";
import { useCaisseStore } from "@/store/caisseStore";
import { useSettingsStore } from "@/store/settingsStore";
import { isTauri, invokeCommand } from "@/services/tauri";

export type AppInitStatus = "initializing" | "ready" | "error";

export interface AppInitState {
  status: AppInitStatus;
  isReady: boolean;
  error: string | null;
  retry: () => void;
}

export function useAppInit(): AppInitState {
  const [status, setStatus] = useState<AppInitStatus>("initializing");
  const [error, setError] = useState<string | null>(null);

  const initApp = useCallback(async () => {
    setStatus("initializing");
    setError(null);

    try {
      if (isTauri()) {
        // 1. Chargement des paramètres depuis SQLite (avec migration one-shot si existant)
        await useSettingsStore.getState().loadSettings();

        // 2. Migration automatique one-shot des données historiques localStorage vers SQLite
        if (typeof window !== "undefined" && window.localStorage) {
          const legacyContractsRaw = localStorage.getItem("atelier_prestige_db_contracts");
          const legacySalesRaw = localStorage.getItem("atelier_prestige_db_sales");
          if (legacyContractsRaw || legacySalesRaw) {
            try {
              const contracts = legacyContractsRaw ? JSON.parse(legacyContractsRaw) : undefined;
              const sales = legacySalesRaw ? JSON.parse(legacySalesRaw) : undefined;
              if ((contracts && contracts.length > 0) || (sales && sales.length > 0)) {
                await invokeCommand("import_legacy_localstorage", { payload: { contracts, sales } });
              }
            } catch (e) {
              console.warn("[useAppInit] Import legacy localStorage ignoré ou déjà effectué:", e);
            }
          }
        }

        // 3. Chargement des contrats et des données de caisse depuis SQLite
        await useRentalStore.getState().loadContracts();
        await useCaisseStore.getState().loadSales();
        await useCaisseStore.getState().loadActiveSession();
      }
      setStatus("ready");
    } catch (err: any) {
      console.error("[useAppInit] Erreur d'initialisation SQLite :", err);
      setError(err?.message || "Échec d'accès à la base de données locale.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    initApp();
  }, [initApp]);

  return {
    status,
    isReady: status === "ready",
    error,
    retry: initApp,
  };
}
