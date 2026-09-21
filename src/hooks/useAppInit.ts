import { useState, useEffect, useCallback } from "react";
import { useRentalStore } from "@/store/rentalStore";
import { isTauri } from "@/lib/utils";

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
        // Chargement des contrats depuis SQLite
        await useRentalStore.getState().loadContracts();
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
