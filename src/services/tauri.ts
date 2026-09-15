/**
 * Couche d'abstraction IPC pour les appels Tauri 2.
 * Toutes les requêtes vers le backend Rust doivent passer par ce service
 * plutôt que d'effectuer des invocations directes dispersées dans les composants.
 */

// Helper pour vérifier si on tourne dans l'environnement natif Tauri
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

let _isRestorationInProgress = false;

export const setRestorationInProgress = (inProgress: boolean): void => {
  _isRestorationInProgress = inProgress;
};

export const isRestorationInProgress = (): boolean => _isRestorationInProgress;

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  // Pendant la fenêtre critique de restauration/redémarrage, bloquer tout IPC parasite (sauf le redémarrage et la restauration elle-même)
  if (_isRestorationInProgress && command !== "restore_database" && command !== "restart_app") {
    console.info(`[Tauri IPC] Appel à "${command}" suspendu car une restauration/redémarrage est en cours.`);
    return {} as T;
  }

  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(command, args);
    } catch (error) {
      console.error(`[Tauri IPC Error] Command "${command}" failed:`, error);
      throw new Error(`[Tauri IPC Error] La commande "${command}" a échoué : ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Mode dev navigateur Web : ne plus masquer silencieusement avec un objet vide
    const errorMsg = `[Tauri IPC] Impossible d'exécuter "${command}" : l'application ne s'exécute pas dans le runtime Tauri natif.`;
    console.error(errorMsg, args);
    throw new Error(errorMsg);
  }
}

/**
 * Redémarre l'application entière :
 * - En environnement Tauri : relance le processus natif complet via l'IPC Rust `restart_app` (app.restart()).
 * - En mode navigateur (dev) : recharge la page via window.location.reload().
 */
export async function restartApplication(): Promise<void> {
  if (isTauri()) {
    try {
      await invokeCommand("restart_app");
      return;
    } catch (err) {
      console.warn("[restartApplication] Échec de relance native du processus, fallback sur reload :", err);
    }
  }
  window.location.reload();
}
