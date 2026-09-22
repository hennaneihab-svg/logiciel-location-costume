import { useEffect, useRef } from "react";
import { useRentalStore } from "@/store/rentalStore";
import { usePressingStore } from "@/store/pressingStore";
import { useAlertStore } from "@/store/alertStore";
import { notifyUrgentAlert } from "@/services/notificationService";
import { toast } from "sonner";

/**
 * Moteur d'alertes en arrière-plan :
 * - S'exécute immédiatement au lancement de l'application
 * - Se ré-exécute automatiquement toutes les heures (3600000 ms)
 * - Calcule les retards, Jour-J, J-1, J-2, J-3 à partir des locations en cours
 * - Déclenche une notification système native (Tauri / Browser) + toast pour les alertes urgentes
 */
export function useAlertEngine() {
  const contracts = useRentalStore((s) => s.contracts);
  const dispatches = usePressingStore((s) => s.dispatches);
  const isModuleActive = usePressingStore((s) => s.isModuleActive);
  const isRunningRef = useRef(false);

  useEffect(() => {
    const runCheck = async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;

      try {
        const {
          generateAlertsFromRentals,
          generateAlertsFromPressing,
          markNotificationSent,
        } = useAlertStore.getState();

        // 1. Calcul des alertes de retour depuis les contrats
        const alertIdsToNotify = generateAlertsFromRentals(contracts);

        // 2. Calcul des alertes pressing si le module est actif
        if (isModuleActive) {
          const pressingAlertIds = generateAlertsFromPressing(dispatches);
          alertIdsToNotify.push(...pressingAlertIds);
        }

        // 3. Traitement des notifications pour les alertes urgentes
        const currentAlerts = useAlertStore.getState().alerts;
        for (const alertId of alertIdsToNotify) {
          const alert = currentAlerts.find((a) => a.id === alertId);
          if (!alert) continue;

          // Notification native (Tauri / Web)
          await notifyUrgentAlert(
            alert.category,
            alert.customer_name ?? alert.provider_name ?? "Atelier",
            alert.article_name ?? "Article",
            alert.contract_number ?? alert.pressing_dispatch_number ?? "N/A"
          );

          // Toast in-app
          if (alert.category === "retard_retour") {
            toast.error(`Retard constaté : ${alert.title}`, {
              description: alert.description,
              duration: 8000,
            });
          } else if (alert.category === "retard_pressing") {
            toast.error(`Retard pressing critique : ${alert.title}`, {
              description: alert.description,
              duration: 8000,
            });
          } else if (alert.category === "retour_jour_j") {
            toast.warning(`Retour attendu aujourd'hui : ${alert.title}`, {
              description: alert.description,
              duration: 6000,
            });
          } else if (alert.category === "retour_j1") {
            toast.info(`Rappel J-1 : ${alert.title}`, {
              description: alert.description,
              duration: 5000,
            });
          }

          markNotificationSent(alertId);
        }
      } finally {
        isRunningRef.current = false;
      }
    };

    // Exécution initiale au montage
    runCheck();

    // Exécution récurrente toutes les heures
    const ONE_HOUR = 60 * 60 * 1000;
    const interval = setInterval(runCheck, ONE_HOUR);

    return () => clearInterval(interval);
  }, [contracts, dispatches, isModuleActive]);
}
