/**
 * Module E — Zustand Store : Alertes & Rappels v2
 *
 * Nouveautés vs v1 :
 *  - generateAlertsFromRentals() : moteur de calcul des alertes de retour
 *  - markAsViewed() / markAsProcessed() : traçabilité
 *  - Déduplication par dedup_key
 *  - notification_sent flag (évite les doublons de notifications)
 *  - Tri par urgence ALERT_URGENCY
 */

import { create } from "zustand";
import type {
  AppAlert,
  AlertFilters,
  AlertSeverity,
  AlertCategory,
} from "@/types/alert";
import { ALERT_URGENCY } from "@/types/alert";
import { CATEGORY_LABELS } from "@/store/alertStore.constants";
import { dbStorage } from "@/services/dbStorage";
import { isTauri } from "@/services/tauri";

export { CATEGORY_LABELS };

// ─── Seed initial (alertes statiques pour la démo) ──────────────────────────
const d = (offsetDays: number): string => {
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString();
};
const dDate = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

/**
 * Alertes statiques de stock et d'inactivité (ne viennent pas du moteur
 * de locations, mais du scan du stock).
 */
const STOCK_SEED_ALERTS: AppAlert[] = [
  {
    id: "alr-007",
    dedup_key: "art-002_stock_bas",
    category: "stock_bas",
    severity: "avertissement",
    status: "active",
    title: "Stock bas — Smoking Midnight Blue Col Pointe",
    description: "Seulement 1 pièce disponible (seuil: 2).",
    created_at: d(-1),
    updated_at: d(-1),
    article_id: "art-002",
    article_name: "Smoking Midnight Blue Col Pointe",
    variant_id: "var-004",
    variant_size: "50",
    current_stock: 1,
    min_stock_threshold: 2,
    notification_sent: false,
  },
  {
    id: "alr-008",
    dedup_key: "art-014_stock_bas",
    category: "stock_bas",
    severity: "critique",
    status: "active",
    title: "Stock épuisé — Derby Bout Fleuri Blanc Cérémonie",
    description: "Aucune pièce disponible — en location ou pressing.",
    created_at: d(-2),
    updated_at: d(-2),
    article_id: "art-014",
    article_name: "Derby Bout Fleuri Blanc Cérémonie",
    variant_id: "var-020",
    variant_size: "42",
    current_stock: 0,
    min_stock_threshold: 1,
    notification_sent: false,
  },
  {
    id: "alr-009",
    dedup_key: "art-009_article_inactif",
    category: "article_inactif",
    severity: "info",
    status: "active",
    title: "Article inactif — Queue-de-Pie Grise Dorée",
    description: "Aucune location depuis 112 jours.",
    created_at: d(-5),
    updated_at: d(-5),
    article_id: "art-009",
    article_name: "Queue-de-Pie Grise Dorée",
    days_since_last_rental: 112,
    notification_sent: true,
  },
  {
    id: "alr-010",
    dedup_key: "art-019_article_inactif",
    category: "article_inactif",
    severity: "info",
    status: "vue",
    title: "Article inactif — Costume Mao Changsam Blanc Crème",
    description: "Aucune location depuis 95 jours.",
    created_at: d(-3),
    updated_at: d(-1),
    article_id: "art-019",
    article_name: "Costume Mao Changsam Blanc Crème",
    days_since_last_rental: 95,
    notification_sent: true,
    viewed_at: d(-1),
    viewed_by: "Administrateur",
  },
  // Alerte acquittée historique
  {
    id: "alr-011",
    dedup_key: "loc-007_retard_retour",
    category: "retard_retour",
    severity: "critique",
    status: "acquittee",
    title: "Retard résolu — LOC-2026-0007",
    description: "Client contacté — retour effectué le lendemain avec pénalité réglée.",
    created_at: d(-8),
    updated_at: d(-7),
    contract_id: "loc-007",
    contract_number: "LOC-2026-0007",
    customer_name: "Sandrine Dupuis",
    customer_phone: "06 22 44 66 88",
    days_overdue: 1,
    late_fee_cents: 2000,
    dismissed_at: d(-7),
    dismissed_by: "Administrateur",
    dismiss_comment: "Client rappelé. Retour effectué avec pénalité de 2 000 DA encaissée.",
    notification_sent: true,
  },
  {
    id: "alr-012",
    dedup_key: "art-018_stock_bas",
    category: "stock_bas",
    severity: "avertissement",
    status: "traitee",
    title: "Stock bas résolu — Jaquette Écossaise Tartan Vert",
    description: "Commande de restockage passée.",
    created_at: d(-10),
    updated_at: d(-9),
    article_id: "art-018",
    article_name: "Jaquette Écossaise Tartan Vert",
    current_stock: 0,
    min_stock_threshold: 1,
    notification_sent: true,
    processed_at: d(-9),
    processed_by: "Administrateur",
    processed_comment: "Commande passée chez le fournisseur, livraison prévue sous 5 jours.",
  },
];

const LATE_FEE_PER_DAY_CENTS = 2000; // 2 000 DA par jour de retard

// ─── Helpers ────────────────────────────────────────────────────────────────
function daysDiff(isoDate: string): number {
  // Parsing strict YYYY-MM-DD pour éviter le décalage UTC vs fuseau horaire local
  const datePart = isoDate.includes("T") ? isoDate.split("T")[0] : isoDate;
  const [y, m, d] = datePart.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.round((today.getTime() - target.getTime()) / 86400000);
}

function categoryFromDays(daysOverdue: number): AlertCategory | null {
  if (daysOverdue > 0) return "retard_retour";
  if (daysOverdue === 0) return "retour_jour_j";
  if (daysOverdue === -1) return "retour_j1";
  if (daysOverdue === -2) return "retour_j2";
  if (daysOverdue === -3) return "retour_j3";
  return null; // Plus de 3 jours avant le retour : pas d'alerte
}

function severityFromCategory(cat: AlertCategory): AlertSeverity {
  switch (cat) {
    case "retard_retour": return "critique";
    case "retour_jour_j":
    case "retour_j1": return "avertissement";
    default: return "info";
  }
}

// ─── Types du store ──────────────────────────────────────────────────────────
interface AlertStoreState {
  alerts: AppAlert[];
  filters: AlertFilters;
  isDismissDialogOpen: boolean;
  alertToDismiss: AppAlert | null;
  isProcessDialogOpen: boolean;
  alertToProcess: AppAlert | null;
  isPdfExportModalOpen: boolean;
  exportPeriod: { from: string; to: string };

  // Actions — Moteur
  /**
   * Génère / met à jour les alertes de retour depuis les contrats en cours.
   * Retourne les IDs des alertes pour lesquelles une notification doit être envoyée.
   */
  generateAlertsFromRentals: (
    contracts: Array<{
      id: string;
      contract_number: string;
      status: string;
      customer_name: string;
      customer_phone?: string;
      return_date_scheduled: string;
      items: Array<{ article_name: string; variant_size?: string }>;
    }>
  ) => string[]; // IDs des alertes nouvellement critiques (à notifier)

  generateAlertsFromPressing: (
    dispatches: Array<{
      id: string;
      numero_envoi: string;
      statut: string;
      nom_prestataire?: string;
      prestataire_id?: string | null;
      date_retour_prevue: string;
      designation_article?: string;
      taille?: string;
      variante_id?: string;
      article_id?: string;
    }>
  ) => string[];

  // Actions — Traçabilité
  markAsViewed: (alertId: string, by?: string) => void;
  markAsProcessed: (alertId: string, comment: string, by?: string) => void;
  markNotificationSent: (alertId: string) => void;
  markWhatsAppSent: (alertId: string, by?: string) => void;

  // Actions — Acquittement (compat v1)
  openDismissDialog: (alert: AppAlert) => void;
  closeDismissDialog: () => void;
  dismissAlert: (alertId: string, comment: string, by?: string) => void;
  reactivateAlert: (alertId: string) => void;

  // Actions — Dialog "Traiter"
  openProcessDialog: (alert: AppAlert) => void;
  closeProcessDialog: () => void;

  // Actions — PDF
  setExportPeriod: (from: string, to: string) => void;
  openPdfExport: () => void;
  closePdfExport: () => void;

  // Actions — Filtres
  setFilters: (partial: Partial<AlertFilters>) => void;
  resetFilters: () => void;

  // Actions — Réinitialisation & Nettoyage des alertes orphelines (Restauration / Sync)
  resetAndRecomputeAlerts: (
    contracts: Array<{
      id: string;
      contract_number: string;
      status: string;
      customer_name: string;
      customer_phone?: string;
      return_date_scheduled: string;
      items: Array<{ article_name: string; variant_size?: string }>;
    }>
  ) => void;

  // Sélecteurs
  getActiveCount: () => number;
  getCriticalCount: () => number;
  getUnviewedCount: () => number;
  getRetoursDuJour: () => AppAlert[];
  getFilteredAlerts: () => AppAlert[];
}

const DEFAULT_FILTERS: AlertFilters = {
  severity: "all",
  category: "all",
  status: "active",
  searchQuery: "",
};

// ─── Tri par urgence ─────────────────────────────────────────────────────────
function sortByUrgency(a: AppAlert, b: AppAlert): number {
  const urgA = ALERT_URGENCY[a.category] ?? 99;
  const urgB = ALERT_URGENCY[b.category] ?? 99;
  if (urgA !== urgB) return urgA - urgB;
  // Même urgence → retard le plus long d'abord
  return (b.days_overdue ?? 0) - (a.days_overdue ?? 0);
}

// ─── Store Zustand ────────────────────────────────────────────────────────────
export const useAlertStore = create<AlertStoreState>((set, get) => ({
  alerts: isTauri()
    ? []
    : dbStorage.load<AppAlert[]>(dbStorage.KEYS.ALERTS, STOCK_SEED_ALERTS),
  filters: DEFAULT_FILTERS,
  isDismissDialogOpen: false,
  alertToDismiss: null,
  isProcessDialogOpen: false,
  alertToProcess: null,
  isPdfExportModalOpen: false,
  exportPeriod: {
    from: dDate(-30),
    to: dDate(0),
  },

  // ── Moteur principal ────────────────────────────────────────────────────
  generateAlertsFromRentals: (contracts) => {
    const now = new Date().toISOString();
    const newAlertIds: string[] = [];

    set((state) => {
      const alertsMap = new Map<string, AppAlert>(
        state.alerts.map((a) => [a.dedup_key, a])
      );

      for (const contract of contracts) {
        // On ne calcule que pour les locations "en_cours" ou "en_retard"
        if (
          contract.status !== "en_cours" &&
          contract.status !== "en_retard"
        )
          continue;

        const daysOverdue = daysDiff(contract.return_date_scheduled);
        const category = categoryFromDays(daysOverdue);
        if (!category) continue; // Plus de 3j avant retour

        const dedupKey = `${contract.id}_${category}`;
        const existing = alertsMap.get(dedupKey);

        // Nom du premier article
        const firstItem = contract.items[0];
        const articleName = firstItem?.article_name ?? "Article inconnu";
        const variantSize = firstItem?.variant_size;

        const severity = severityFromCategory(category);
        const lateFee =
          daysOverdue > 0 ? daysOverdue * LATE_FEE_PER_DAY_CENTS : undefined;

        const labels: Record<AlertCategory, string> = {
          retard_retour: `Retard +${daysOverdue}j — ${contract.contract_number}`,
          retard_pressing: "",
          retour_jour_j: `Retour Aujourd'hui — ${contract.contract_number}`,
          retour_j1: `Rappel J-1 — ${contract.contract_number}`,
          retour_j2: `Rappel J-2 — ${contract.contract_number}`,
          retour_j3: `Rappel J-3 — ${contract.contract_number}`,
          stock_bas: "",
          article_inactif: "",
        };

        const descriptions: Record<AlertCategory, string> = {
          retard_retour: `${articleName} non restitué depuis ${daysOverdue} jour${daysOverdue > 1 ? "s" : ""}.`,
          retard_pressing: "",
          retour_jour_j: `${articleName} doit être rendu aujourd'hui (avant 19h).`,
          retour_j1: `${articleName} retour prévu demain.`,
          retour_j2: `${articleName} retour prévu dans 2 jours.`,
          retour_j3: `${articleName} retour prévu dans 3 jours.`,
          stock_bas: "",
          article_inactif: "",
        };

        if (existing) {
          // Mise à jour : recalcule les jours, met à jour le titre/desc
          const needsNotif =
            !existing.notification_sent &&
            ["retard_retour", "retour_jour_j", "retour_j1"].includes(category);

          const updated: AppAlert = {
            ...existing,
            severity,
            category,
            title: labels[category],
            description: descriptions[category],
            days_overdue: daysOverdue,
            late_fee_cents: lateFee,
            updated_at: now,
            // Si le retard empire → repasse "active" même si "vue"
            status:
              existing.status === "active" || existing.status === "vue"
                ? daysOverdue > (existing.days_overdue ?? 0)
                  ? "active"
                  : existing.status
                : existing.status,
          };

          if (needsNotif) newAlertIds.push(existing.id);
          alertsMap.set(dedupKey, updated);
        } else {
          // Nouvelle alerte
          const newId = `alr-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;
          const shouldNotify = ["retard_retour", "retour_jour_j", "retour_j1"].includes(
            category
          );
          const newAlert: AppAlert = {
            id: newId,
            dedup_key: dedupKey,
            category,
            severity,
            status: "active",
            title: labels[category],
            description: descriptions[category],
            created_at: now,
            updated_at: now,
            contract_id: contract.id,
            contract_number: contract.contract_number,
            customer_name: contract.customer_name,
            customer_phone: contract.customer_phone,
            return_date_scheduled: contract.return_date_scheduled,
            days_overdue: daysOverdue,
            late_fee_cents: lateFee,
            article_name: articleName,
            variant_size: variantSize,
            notification_sent: !shouldNotify,
          };
          if (shouldNotify) newAlertIds.push(newId);
          alertsMap.set(dedupKey, newAlert);
        }
      }

      const updated = Array.from(alertsMap.values());
      dbStorage.save(dbStorage.KEYS.ALERTS, updated);
      return { alerts: updated };
    });

    return newAlertIds;
  },

  generateAlertsFromPressing: (dispatches) => {
    const now = new Date().toISOString();
    const newAlertIds: string[] = [];

    set((state) => {
      const alertsMap = new Map<string, AppAlert>(
        state.alerts.map((a) => [a.dedup_key, a])
      );

      for (const d of dispatches) {
        const dedupKey = `${d.id}_retard_pressing`;

        // Si l'envoi est reçu ou annulé, on résout/supprime l'alerte
        if (d.statut === "recu" || d.statut === "annule") {
          if (alertsMap.has(dedupKey)) {
            alertsMap.delete(dedupKey);
          }
          continue;
        }

        const daysOverdue = daysDiff(d.date_retour_prevue);
        if (daysOverdue <= 0) {
          // Pas de retard
          if (alertsMap.has(dedupKey)) {
            alertsMap.delete(dedupKey);
          }
          continue;
        }

        // Retard avéré
        const severity: AlertSeverity = daysOverdue >= 3 ? "critique" : "avertissement";
        const providerName =
          d.nom_prestataire || (d.prestataire_id ? "Prestataire" : "Atelier interne");
        const title = `Retard pressing +${daysOverdue}j — ${d.numero_envoi}`;
        const description = `Pièce ${d.designation_article || "envoi"} non revenue de ${providerName} (date prévue : ${d.date_retour_prevue}).`;

        const existing = alertsMap.get(dedupKey);
        if (existing) {
          const wasOverdue = existing.days_overdue ?? 0;
          const updated: AppAlert = {
            ...existing,
            severity,
            title,
            description,
            days_overdue: daysOverdue,
            updated_at: now,
            status:
              existing.status === "active" || existing.status === "vue"
                ? daysOverdue > wasOverdue
                  ? "active"
                  : existing.status
                : existing.status,
          };
          if (!existing.notification_sent && severity === "critique") {
            newAlertIds.push(existing.id);
          }
          alertsMap.set(dedupKey, updated);
        } else {
          const newId = `alr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newAlert: AppAlert = {
            id: newId,
            dedup_key: dedupKey,
            category: "retard_pressing",
            severity,
            status: "active",
            title,
            description,
            created_at: now,
            updated_at: now,
            pressing_dispatch_id: d.id,
            pressing_dispatch_number: d.numero_envoi,
            provider_name: providerName,
            article_id: d.article_id,
            article_name: d.designation_article,
            variant_id: d.variante_id,
            variant_size: d.taille,
            return_date_scheduled: d.date_retour_prevue,
            days_overdue: daysOverdue,
            notification_sent: false,
          };
          newAlertIds.push(newId);
          alertsMap.set(dedupKey, newAlert);
        }
      }

      const updated = Array.from(alertsMap.values());
      dbStorage.save(dbStorage.KEYS.ALERTS, updated);
      return { alerts: updated };
    });

    return newAlertIds;
  },

  resetAndRecomputeAlerts: (contracts) => {
    // 1. Purge de toutes les anciennes alertes de location pour éliminer les orphelines
    const rentalCategories = new Set([
      "retard_retour",
      "retour_jour_j",
      "retour_j1",
      "retour_j2",
      "retour_j3",
    ]);

    set((state) => {
      const nonRentalAlerts = state.alerts.filter((a) => !rentalCategories.has(a.category));
      dbStorage.save(dbStorage.KEYS.ALERTS, nonRentalAlerts);
      return { alerts: nonRentalAlerts };
    });

    // 2. Recalcul propre et déterministe depuis les contrats fournis
    if (contracts && contracts.length > 0) {
      get().generateAlertsFromRentals(contracts);
    }
  },

  // ── Traçabilité ────────────────────────────────────────────────────────
  markAsViewed: (alertId, by = "Administrateur") => {
    set((state) => {
      const alerts: AppAlert[] = state.alerts.map((a) =>
        a.id === alertId && a.status === "active"
          ? { ...a, status: "vue" as const, viewed_at: new Date().toISOString(), viewed_by: by }
          : a
      );
      dbStorage.save(dbStorage.KEYS.ALERTS, alerts);
      return { alerts };
    });
  },

  markAsProcessed: (alertId, comment, by = "Administrateur") => {
    const now = new Date().toISOString();
    set((state) => {
      const alerts: AppAlert[] = state.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status: "traitee" as const,
              processed_at: now,
              processed_by: by,
              processed_comment: comment,
              updated_at: now,
            }
          : a
      );
      dbStorage.save(dbStorage.KEYS.ALERTS, alerts);
      return { alerts, isProcessDialogOpen: false, alertToProcess: null };
    });
  },

  markNotificationSent: (alertId) => {
    set((state) => {
      const alerts: AppAlert[] = state.alerts.map((a) =>
        a.id === alertId ? { ...a, notification_sent: true } : a
      );
      dbStorage.save(dbStorage.KEYS.ALERTS, alerts);
      return { alerts };
    });
  },

  markWhatsAppSent: (alertId, by = "Vendeur") => {
    set((state) => {
      const now = new Date().toISOString();
      const alerts: AppAlert[] = state.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              whatsapp_sent_at: now,
              whatsapp_sent_by: by,
              updated_at: now,
            }
          : a
      );
      dbStorage.save(dbStorage.KEYS.ALERTS, alerts);
      return { alerts };
    });
  },

  // ── Dialog traiter ─────────────────────────────────────────────────────
  openProcessDialog: (alert) =>
    set({ isProcessDialogOpen: true, alertToProcess: alert }),
  closeProcessDialog: () =>
    set({ isProcessDialogOpen: false, alertToProcess: null }),

  // ── Acquittement (compat v1) ───────────────────────────────────────────
  openDismissDialog: (alert) =>
    set({ isDismissDialogOpen: true, alertToDismiss: alert }),
  closeDismissDialog: () =>
    set({ isDismissDialogOpen: false, alertToDismiss: null }),

  dismissAlert: (alertId, comment, by = "Administrateur") => {
    const now = new Date().toISOString();
    set((state) => {
      const alerts: AppAlert[] = state.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status: "acquittee" as const,
              dismissed_at: now,
              dismissed_by: by,
              dismiss_comment: comment,
              updated_at: now,
            }
          : a
      );
      dbStorage.save(dbStorage.KEYS.ALERTS, alerts);
      return {
        alerts,
        isDismissDialogOpen: false,
        alertToDismiss: null,
      };
    });
  },

  reactivateAlert: (alertId) => {
    set((state) => {
      const alerts: AppAlert[] = state.alerts.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status: "active" as const,
              dismissed_at: undefined,
              dismissed_by: undefined,
              dismiss_comment: undefined,
              processed_at: undefined,
              processed_comment: undefined,
            }
          : a
      );
      dbStorage.save(dbStorage.KEYS.ALERTS, alerts);
      return { alerts };
    });
  },

  // ── PDF ────────────────────────────────────────────────────────────────
  setExportPeriod: (from, to) => set({ exportPeriod: { from, to } }),
  openPdfExport: () => set({ isPdfExportModalOpen: true }),
  closePdfExport: () => set({ isPdfExportModalOpen: false }),

  // ── Filtres ───────────────────────────────────────────────────────────
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  // ── Sélecteurs ────────────────────────────────────────────────────────
  getActiveCount: () =>
    get().alerts.filter(
      (a) => a.status === "active" || a.status === "vue"
    ).length,

  getCriticalCount: () =>
    get().alerts.filter(
      (a) =>
        (a.status === "active" || a.status === "vue") &&
        a.severity === "critique"
    ).length,

  getUnviewedCount: () =>
    get().alerts.filter((a) => a.status === "active").length,

  getRetoursDuJour: () =>
    get()
      .alerts.filter(
        (a) =>
          (a.category === "retour_jour_j" || a.category === "retard_retour") &&
          (a.status === "active" || a.status === "vue")
      )
      .sort(sortByUrgency),

  getFilteredAlerts: () => {
    const { alerts, filters } = get();
    return alerts
      .filter((a) => {
        // Statut "active" dans les filtres inclut aussi "vue" (non traitées)
        if (filters.status === "active") {
          if (a.status !== "active" && a.status !== "vue") return false;
        } else if (filters.status !== "all" && a.status !== filters.status) {
          return false;
        }
        if (filters.severity !== "all" && a.severity !== filters.severity)
          return false;
        if (filters.category !== "all" && a.category !== filters.category)
          return false;
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          const haystack = [
            a.title,
            a.description,
            a.customer_name,
            a.contract_number,
            a.article_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (filters.dateFrom && a.created_at < filters.dateFrom) return false;
        if (
          filters.dateTo &&
          a.created_at > filters.dateTo + "T23:59:59Z"
        )
          return false;
        return true;
      })
      .sort(sortByUrgency);
  },
}));
