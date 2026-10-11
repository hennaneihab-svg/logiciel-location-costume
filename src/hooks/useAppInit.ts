import { useState, useEffect, useCallback } from "react";
import { useRentalStore } from "@/store/rentalStore";
import { useCaisseStore } from "@/store/caisseStore";
import { useStockStore } from "@/store/stockStore";
import { useClientStore } from "@/store/clientStore";
import { useAlertStore } from "@/store/alertStore";
import { usePackStore } from "@/store/packStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
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
      // 0. Vérification si la base est vierge et requiert l'assistant de premier lancement
      await useAuthStore.getState().checkSetupRequired();

      if (isTauri()) {
        const isVirgin = useAuthStore.getState().isSetupRequired;

        if (isVirgin) {
          // Base vierge : nettoyer tout le localStorage pour éliminer les données démo
          if (typeof window !== "undefined" && window.localStorage) {
            localStorage.clear();
          }
          // Réinitialiser TOUS les stores en mémoire pour garantir une application 100% vierge
          useStockStore.setState({ articles: [] });
          useClientStore.setState({ clients: [] });
          useAlertStore.setState({ alerts: [] });
          useRentalStore.setState({ contracts: [], totalContracts: 0, paginatedContracts: [] });
          useCaisseStore.setState({ salesHistory: [], cart: [] });
          usePackStore.setState({ packs: [] });

          setStatus("ready");
          return;
        }

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
