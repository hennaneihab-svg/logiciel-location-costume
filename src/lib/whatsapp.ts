/**
 * Utilitaires et service d'ouverture WhatsApp via lien direct wa.me
 * Atelier Prestige — Solution 100% autonome sans API payante.
 */

import { isTauri } from "@/services/tauri";

/**
 * Nettoie et normalise un numéro de téléphone pour WhatsApp.
 * - Supprime tous les espaces, tirets, parenthèses, points, slashes.
 * - Gère le format local algérien standard : commence par '0' (ex: 0555123456) -> remplace par '213' -> 213555123456.
 * - Gère les formats avec indicatif : +213..., 00213..., ou déjà 213...
 * - Retourne uniquement des chiffres, sans '+', ou null si invalide.
 */
export function formatPhoneForWhatsApp(rawPhone: string): string | null {
  if (!rawPhone || typeof rawPhone !== "string") {
    return null;
  }

  // Retirer tous les caractères non numériques sauf un éventuel '+' initial
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.\/\\]/g, "");

  if (!cleaned) {
    return null;
  }

  // Traiter l'indicatif international avec '+'
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }

  // Vérifier qu'il ne reste que des chiffres
  if (!/^\d+$/.test(cleaned)) {
    return null;
  }

  // Format local algérien standard (9 ou 10 chiffres commençant par 0)
  // Ex: 0555123456 (10 chiffres) -> 213555123456
  if (cleaned.startsWith("0")) {
    cleaned = "213" + cleaned.slice(1);
  }

  // Un numéro mobile international valide doit avoir au moins 9 chiffres (ex: 213 + 9 chiffres)
  if (cleaned.length < 9 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Construit un lien wa.me pré-rempli.
 * Retourne null si le numéro est invalide.
 */
export function buildWhatsAppLink(rawPhone: string, message?: string): string | null {
  const formattedPhone = formatPhoneForWhatsApp(rawPhone);
  if (!formattedPhone) {
    return null;
  }

  if (message && message.trim().length > 0) {
    const encoded = encodeURIComponent(message.trim());
    return `https://wa.me/${formattedPhone}?text=${encoded}`;
  }

  return `https://wa.me/${formattedPhone}`;
}

export interface WhatsAppOpenResult {
  success: boolean;
  error?: string;
}

/**
 * Ouvre la discussion WhatsApp dans l'application par défaut (WhatsApp Desktop ou Navigateur / Web).
 * Compatible à la fois avec le runtime Tauri natif et le navigateur Web standard.
 */
export async function ouvrirWhatsApp(rawPhone: string, message?: string): Promise<WhatsAppOpenResult> {
  const link = buildWhatsAppLink(rawPhone, message);

  if (!link) {
    return {
      success: false,
      error: "Numéro de téléphone invalide ou manquant",
    };
  }

  try {
    if (isTauri()) {
      try {
        // Tente d'utiliser le plugin shell si disponible
        const shellPlugin = await import("@tauri-apps/plugin-shell");
        if (shellPlugin && typeof shellPlugin.open === "function") {
          await shellPlugin.open(link);
          return { success: true };
        }
      } catch (pluginErr) {
        console.warn("[WhatsApp] Plugin shell non disponible, utilisation du fallback navigateur :", pluginErr);
      }
    }

    // Fallback environnement Web / Dev / Navigateur par défaut
    if (typeof window !== "undefined") {
      window.open(link, "_blank", "noopener,noreferrer");
      return { success: true };
    }

    return {
      success: false,
      error: "Impossible d'ouvrir le navigateur depuis cet environnement.",
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[WhatsApp Error]", errMsg);
    return {
      success: false,
      error: `Erreur lors de l'ouverture de WhatsApp : ${errMsg}`,
    };
  }
}
