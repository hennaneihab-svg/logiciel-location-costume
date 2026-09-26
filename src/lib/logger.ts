/**
 * Logger centralisé et conditionnel pour Atelier Prestige
 * En production, les logs de niveau debug et info sont désactivés pour préserver les performances et la confidentialité.
 * Les alertes (warn) et erreurs (error) critiques sont toujours consignées.
 */

const isDev = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug("[DEBUG]", ...args);
    }
  },

  info: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info("[INFO]", ...args);
    }
  },

  warn: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn("[WARN]", ...args);
  },

  error: (contextOrMsg: string, err?: unknown, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${contextOrMsg}`, err, ...args);
  },
};
