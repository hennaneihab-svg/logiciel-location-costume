import React, { useState, useEffect } from "react";
import { ShieldAlert, X, AlertOctagon } from "lucide-react";
import { useClientStore } from "@/store/clientStore";
import { toast } from "sonner";

export const BlacklistDialog: React.FC = () => {
  const {
    isBlacklistDialogOpen,
    targetBlacklistClient,
    closeBlacklistDialog,
    toggleBlacklist,
  } = useClientStore();

  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (targetBlacklistClient) {
      setReason(targetBlacklistClient.blacklist_reason || "");
      setErrorMsg("");
    }
  }, [targetBlacklistClient]);

  if (!isBlacklistDialogOpen || !targetBlacklistClient) return null;

  const client = targetBlacklistClient;
  const isCurrentlyBlacklisted = client.is_blacklisted;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCurrentlyBlacklisted && reason.trim().length < 5) {
      setErrorMsg("Le motif du signalement est obligatoire (minimum 5 caractères).");
      return;
    }

    const result = toggleBlacklist(client.id, !isCurrentlyBlacklisted, reason.trim());

    if (!result.success) {
      setErrorMsg(result.error || "Erreur lors de la mise à jour.");
      return;
    }

    if (!isCurrentlyBlacklisted) {
      toast.error(
        `Client ${client.first_name} ${client.last_name} placé en Liste Noire avec motif enregistré.`
      );
    } else {
      toast.success(
        `Client ${client.first_name} ${client.last_name} réhabilité et retiré de la Liste Noire.`
      );
    }

    closeBlacklistDialog();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-5 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <ShieldAlert
              className={`w-4 h-4 ${
                isCurrentlyBlacklisted ? "text-emerald-500" : "text-red-500"
              }`}
            />
            <span>
              {isCurrentlyBlacklisted
                ? "Retirer de la Liste Noire"
                : "Placer en Liste Noire"}
            </span>
          </div>
          <button
            onClick={closeBlacklistDialog}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-secondary/40 border border-border text-xs">
            <span className="text-muted-foreground font-medium block">Client concerné :</span>
            <span className="font-bold text-foreground text-sm">
              {client.first_name} {client.last_name}
            </span>
            <span className="text-muted-foreground block text-[11px] mt-0.5">
              Tél : {client.phone} • {client.city}
            </span>
          </div>

          {!isCurrentlyBlacklisted ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Motif obligatoire de blocage *</span>
                <span className="text-[10px] text-red-400 font-normal">
                  Justification d'audit requise
                </span>
              </label>

              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                placeholder="Ex : Retard répété de plus de 4 jours sur contrat LOC-2026-0011, refus de payer les pénalités, costume rendu taché sans dédommagement..."
                className="w-full p-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-red-500 leading-relaxed"
              />

              {errorMsg && (
                <div className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Ce motif s'affichera immédiatement en rouge clignotant dès qu'un vendeur
                tentera de créer une nouvelle réservation pour ce client.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
                <span className="font-bold text-emerald-500 block">
                  Confirmation de réhabilitation
                </span>
                <p className="text-muted-foreground text-[11px]">
                  Le client sera réautorisé à louer des costumes et chaussures normalement.
                  L'alerte bloquante rouge sera levée.
                </p>
              </div>

              {client.blacklist_reason && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Ancien motif :</span>{" "}
                  <em>"{client.blacklist_reason}"</em>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeBlacklistDialog}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 ${
                isCurrentlyBlacklisted
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>
                {isCurrentlyBlacklisted
                  ? "Confirmer la réhabilitation"
                  : "Valider la Liste Noire"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
