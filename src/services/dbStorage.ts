/**
 * dbStorage.ts — Couche de persistance SQLite universelle (Tauri IPC + LocalStorage Fallback)
 *
 * En mode Tauri natif : les écritures et lectures passent par SQLite via invokeCommand.
 * En mode Navigateur/Dev ou si l'environnement bloque Tauri :
 *   - Lève une erreur si demandé, OU
 *   - Sauvegarde immédiatement dans localStorage sous forme de base locale persistante,
 *   - Ne perd AUCUNE modification au rechargement de page.
 */

import { invokeCommand, isTauri } from "./tauri";
import { toast } from "sonner";

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STORAGE_KEYS = {
  ARTICLES: "atelier_prestige_db_articles",
  CLIENTS: "atelier_prestige_db_clients",
  CONTRACTS: "atelier_prestige_db_contracts",
  SALES: "atelier_prestige_db_sales",
  ALERTS: "atelier_prestige_db_alerts",
  SETTINGS: "atelier_prestige_db_settings",
  AUDIT_LOGS: "atelier_prestige_db_audit_logs",
  BACKUPS: "atelier_prestige_db_backups",
};

export const dbStorage = {
  // --- Sauvegarde & Récupération locale persistante ---
  load<T>(key: string, defaultData: T): T {
    try {
      if (typeof window === "undefined" || !window.localStorage) return defaultData;
      const raw = localStorage.getItem(key);
      if (!raw) {
        // Enregistrer la version initiale
        localStorage.setItem(key, JSON.stringify(defaultData));
        return defaultData;
      }
      return JSON.parse(raw) as T;
    } catch (e) {
      console.error(`[dbStorage] Erreur lecture ${key}:`, e);
      return defaultData;
    }
  },

  save<T>(key: string, data: T): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      console.error(`[dbStorage] Erreur écriture ${key}:`, e);
      toast.error(`Échec de sauvegarde locale pour ${key}`);
      throw e;
    }
  },

  // --- Wrapper d'écriture avec notification d'échec immédiate ---
  async persistWithIpc<T>(
    ipcCommand: string,
    ipcArgs: Record<string, unknown> | undefined,
    storageKey: string,
    stateToPersist: unknown
  ): Promise<T | null> {
    // 1. Toujours persister dans le storage persistant local
    try {
      this.save(storageKey, stateToPersist);
    } catch (e: any) {
      toast.error(`Erreur critique de persistance : ${e.message || "Échec d'écriture"}`);
      throw e;
    }

    // 2. Si environnement Tauri, persister dans SQLite réel
    if (isTauri()) {
      try {
        const res = await invokeCommand<T>(ipcCommand, ipcArgs);
        return res;
      } catch (err: any) {
        console.error(`[dbStorage] Erreur écriture SQLite via "${ipcCommand}":`, err);
        toast.error(`Erreur SQLite : L'opération n'a pas pu être persistée dans la base native.`);
        throw err;
      }
    }

    return null;
  },

  KEYS: STORAGE_KEYS,
};
