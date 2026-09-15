/**
 * Module E — Service de notifications système
 * Wrapper unifié : Tauri v2 → Browser Notification API → fallback silencieux
 */

export interface NotificationPayload {
  title: string;
  body: string;
  /** Icône optionnelle (chemin relatif à l'asset Tauri) */
  icon?: string;
}

/**
 * Vérifie si l'API Tauri est disponible (app desktop).
 * En mode Vite dev browser, __TAURI__ n'existe pas.
 */
function isTauriAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Envoie une notification système native.
 *
 * Priorité :
 *  1. Tauri v2 plugin-notification (app desktop packagée)
 *  2. Browser Notification API (Vite dev / navigateur)
 *  3. Fallback silencieux (console.info)
 */
export async function sendSystemNotification(
  payload: NotificationPayload
): Promise<void> {
  // ── 1. Tauri v2 ──────────────────────────────────────────────────────────
  if (isTauriAvailable()) {
    try {
      // Tauri v2 : @tauri-apps/plugin-notification
      const { sendNotification } = await import(
        "@tauri-apps/plugin-notification"
      );
      sendNotification({ title: payload.title, body: payload.body });
      return;
    } catch {
      // Plugin non chargé (dev mode sans plugin), passe au fallback
    }
  }

  // ── 2. Browser Notification API ──────────────────────────────────────────
  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") {
      new Notification(payload.title, {
        body: payload.body,
        icon: "/favicon.ico",
      });
      return;
    }
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification(payload.title, {
          body: payload.body,
          icon: "/favicon.ico",
        });
        return;
      }
    }
  }

  // ── 3. Fallback silencieux ────────────────────────────────────────────────
  console.info(
    `[Notification] ${payload.title} — ${payload.body}`
  );
}

/**
 * Envoie les notifications pour les alertes critiques / urgentes.
 * Catégories déclenchant une notif : retard_retour, retour_jour_j, retour_j1
 */
export async function notifyUrgentAlert(
  category: string,
  customerName: string,
  articleName: string,
  contractNumber: string
): Promise<void> {
  const messages: Record<string, { title: string; body: string }> = {
    retard_retour: {
      title: "🔴 Retard de retour !",
      body: `${customerName} — ${articleName} (${contractNumber}) n'a pas été restitué.`,
    },
    retour_jour_j: {
      title: "🟠 Retour attendu aujourd'hui",
      body: `${customerName} doit rendre ${articleName} (${contractNumber}) avant 19h.`,
    },
    retour_j1: {
      title: "⚠️ Rappel J-1",
      body: `${customerName} — ${articleName} (${contractNumber}) retour prévu demain.`,
    },
  };

  const msg = messages[category];
  if (msg) {
    await sendSystemNotification(msg);
  }
}
