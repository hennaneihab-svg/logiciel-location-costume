import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, CheckCircle2, AlertTriangle, Scissors, Clock, User } from "lucide-react";
import { EssaiCabineDetailDto } from "../../types/matrix";

interface EssaiCabineModalProps {
  isOpen: boolean;
  onClose: () => void;
  varianteId?: string;
  articleNom?: string;
  articleRef?: string;
  taille?: string;
  activeEssai?: EssaiCabineDetailDto | null;
  onSuccess: () => void;
}

export const EssaiCabineModal: React.FC<EssaiCabineModalProps> = ({
  isOpen,
  onClose,
  varianteId,
  articleNom,
  articleRef,
  taille,
  activeEssai,
  onSuccess,
}) => {
  const [clients, setClients] = useState<Array<{ id: string; prenom: string; nom: string; telephone: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientNomLibre, setClientNomLibre] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pour la clôture d'un essayage existant
  const [resultat, setResultat] = useState<"convient" | "retouche_necessaire" | "refuse">("convient");
  const [envoyerRetouche, setEnvoyerRetouche] = useState<boolean>(true);
  const [retoucheMotif, setRetoucheMotif] = useState<string>("");
  const [retoucheDateRetour, setRetoucheDateRetour] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setError(null);
      invoke<Array<{ id: string; prenom: string; nom: string; telephone: string }>>("list_clients")
        .then(setClients)
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isFinishing = Boolean(activeEssai && activeEssai.statut === "en_cours");

  const handleStartEssai = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!varianteId) return;

    setLoading(true);
    setError(null);

    try {
      await invoke("create_essai_cabine", {
        dto: {
          variante_id: varianteId,
          client_id: selectedClientId || null,
          client_nom_libre: selectedClientId ? null : clientNomLibre || "Cliente en cabine",
          notes: notes || null,
        },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.toString() || "Erreur lors du lancement de l'essayage");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishEssai = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEssai) return;

    setLoading(true);
    setError(null);

    try {
      await invoke("finish_essai_cabine", {
        dto: {
          essai_id: activeEssai.id,
          resultat,
          notes: notes || null,
          envoyer_retouche: resultat === "retouche_necessaire" ? envoyerRetouche : false,
          retouche_motif: retoucheMotif || null,
          retouche_date_retour_prevue: retoucheDateRetour || null,
        },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.toString() || "Erreur lors de la clôture de l'essayage");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 px-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-status-fitting-bg text-status-fitting border border-status-fitting-border flex items-center justify-center shadow-xs">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {isFinishing ? `Clôture essayage ${activeEssai?.numero_essai}` : "Mise en cabine d'essayage"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {articleNom} ({articleRef}) — Taille {taille}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-status-late-bg text-status-late border border-status-late-border text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isFinishing ? (
          /* Formulaire de fin d'essayage */
          <form onSubmit={handleFinishEssai} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Issue de l'essayage en cabine
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setResultat("convient")}
                  className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all text-xs font-medium ${
                    resultat === "convient"
                      ? "border-status-completed bg-status-completed-bg text-status-completed shadow-xs font-bold"
                      : "border-border hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Convient</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResultat("retouche_necessaire")}
                  className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all text-xs font-medium ${
                    resultat === "retouche_necessaire"
                      ? "border-status-fitting bg-status-fitting-bg text-status-fitting shadow-xs font-bold"
                      : "border-border hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <Scissors className="w-4 h-4" />
                  <span>Retouche</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResultat("refuse")}
                  className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all text-xs font-medium ${
                    resultat === "refuse"
                      ? "border-status-late bg-status-late-bg text-status-late shadow-xs font-bold"
                      : "border-border hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <X className="w-4 h-4" />
                  <span>Ne convient pas</span>
                </button>
              </div>
            </div>

            {/* Enchaînement retouche */}
            {resultat === "retouche_necessaire" && (
              <div className="p-3.5 rounded-xl bg-status-fitting-bg/40 border border-status-fitting-border/50 space-y-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-status-fitting cursor-pointer">
                  <input
                    type="checkbox"
                    checked={envoyerRetouche}
                    onChange={(e) => setEnvoyerRetouche(e.target.checked)}
                    className="rounded border-status-fitting-border text-status-fitting focus:ring-status-fitting"
                  />
                  <span>Transférer immédiatement en atelier de retouche (statut : en_retouche)</span>
                </label>

                {envoyerRetouche && (
                  <div className="space-y-2 pt-1 text-xs">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">
                        Description de la retouche (ourlet, taille, pinces...)
                      </label>
                      <input
                        type="text"
                        value={retoucheMotif}
                        onChange={(e) => setRetoucheMotif(e.target.value)}
                        placeholder="Ex: Reprendre 2cm à la taille, raccourcir l'ourlet de 3cm"
                        className="w-full h-8 px-2.5 rounded-lg bg-card border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">
                        Date de fin d'atelier prévue
                      </label>
                      <input
                        type="date"
                        value={retoucheDateRetour}
                        onChange={(e) => setRetoucheDateRetour(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-card border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Remarques / Notes d'essayage
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: La robe tombe bien mais ajustement du bustier souhaité."
                rows={2}
                className="w-full p-2.5 rounded-lg bg-secondary/30 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-border hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-8 px-4 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
              >
                {loading ? "Enregistrement..." : "Valider la sortie de cabine"}
              </button>
            </div>
          </form>
        ) : (
          /* Formulaire de début d'essayage */
          <form onSubmit={handleStartEssai} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>Cliente en cabine</span>
              </label>

              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  if (e.target.value) setClientNomLibre("");
                }}
                className="w-full h-9 px-3 rounded-lg bg-secondary/40 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-2"
              >
                <option value="">-- Sélectionner une cliente enregistrée --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prenom} {c.nom} ({c.telephone})
                  </option>
                ))}
              </select>

              {!selectedClientId && (
                <div>
                  <input
                    type="text"
                    value={clientNomLibre}
                    onChange={(e) => setClientNomLibre(e.target.value)}
                    placeholder="Ou nom libre pour visiteuse de passage (ex: Mme Dupont)"
                    className="w-full h-8 px-2.5 rounded-lg bg-secondary/30 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Notes ou instructions cabine
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Essaye avec talons de 8cm pour un mariage le mois prochain."
                rows={2}
                className="w-full p-2.5 rounded-lg bg-secondary/30 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="p-3 rounded-xl bg-status-fitting-bg/30 border border-status-fitting-border/40 text-[11px] text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-status-fitting shrink-0" />
              <span>
                La pièce sera immédiatement marquée en essayage et signalée en cabine sur la Matrice de Disponibilité.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 rounded-lg text-xs font-medium border border-border hover:bg-secondary transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-8 px-4 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
              >
                {loading ? "Enregistrement..." : "Lancer l'essayage en cabine"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
