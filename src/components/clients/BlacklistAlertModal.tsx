import React from "react";
import { ShieldAlert, AlertTriangle, X, UserX, ArrowRight } from "lucide-react";
import { useClientStore } from "@/store/clientStore";
import { toast } from "sonner";

export const BlacklistAlertModal: React.FC = () => {
  const {
    isBlacklistAlertOpen,
    alertClientForRental,
    closeBlacklistAlert,
    setSelectedClient,
    setDetailModalOpen,
  } = useClientStore();

  if (!isBlacklistAlertOpen || !alertClientForRental) return null;

  const client = alertClientForRental;

  const handleOpenClientSheet = () => {
    closeBlacklistAlert();
    setSelectedClient(client);
    setDetailModalOpen(true);
  };

  const handleForceOverride = () => {
    toast.warning(
      `DÉROGATION EXCEPTIONNELLE : Location autorisée par responsable pour le client bloqué ${client.first_name} ${client.last_name}. Exiger caution maximale !`,
      { duration: 6000 }
    );
    closeBlacklistAlert();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeBlacklistAlert();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg rounded-2xl bg-card border-2 border-red-500/80 shadow-[0_0_50px_rgba(239,68,68,0.35)] overflow-hidden flex flex-col">
        {/* Header d'alerte rouge */}
        <div className="h-16 px-6 bg-red-500/20 border-b border-red-500/40 flex items-center justify-between">
          <div className="flex items-center gap-3 text-red-400">
            <div className="w-10 h-10 rounded-xl bg-red-500/30 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-red-500 dark:text-red-400">
                Alerte Bloquante : Client en Liste Noire
              </h3>
              <p className="text-[11px] text-red-400/90 font-medium">
                Tentative de création d'une nouvelle location détectée
              </p>
            </div>
          </div>
          <button
            onClick={closeBlacklistAlert}
            className="p-1.5 rounded-lg text-red-400 hover:text-red-200 hover:bg-red-500/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps de l'alerte */}
        <div className="p-6 space-y-5">
          {/* Identité du client bloqué */}
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-red-500" />
                <span className="font-bold text-sm text-foreground">
                  {client.first_name} {client.last_name}
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Tél : {client.phone}
              </span>
            </div>

            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">N° Pièce d'identité :</span>{" "}
              {client.identity_card_number || "Non renseigné"}
            </div>
          </div>

          {/* Motif obligatoire enregistré de la Liste Noire */}
          <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Motif du signalement officiel :
            </div>
            <p className="text-xs text-foreground/90 font-medium italic bg-background/60 p-3 rounded-lg border border-border/80">
              "{client.blacklist_reason || "Aucun motif textuel enregistré."}"
            </p>
            {client.blacklist_date && (
              <p className="text-[10px] text-muted-foreground text-right">
                Signalé le {new Date(client.blacklist_date).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Conformément aux règles de gestion du magasin, ce client ne peut contracter
            de nouvelle location sans une validation expresse de la direction.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenClientSheet}
            className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border flex items-center justify-center gap-1.5"
          >
            <span>Consulter la fiche client</span>
            <ArrowRight className="w-3.5 h-3.5 text-primary" />
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={closeBlacklistAlert}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              Refuser la location
            </button>
            <button
              type="button"
              onClick={handleForceOverride}
              className="px-3 py-2 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground border border-border/60 hover:bg-secondary"
            >
              Dérogation responsable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
