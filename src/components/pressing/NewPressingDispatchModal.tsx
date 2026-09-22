import React, { useState, useEffect, useMemo } from "react";
import { usePressingStore } from "@/store/pressingStore";
import { useStockStore } from "@/store/stockStore";
import { formatDA } from "@/lib/utils";
import {
  X,
  Sparkles,
  AlertTriangle,
  Building2,
  Calendar,
  Send,
  Layers,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  CreatePressingDispatchInput,
  CreatePressingDispatchResult,
} from "@/types/pressing";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialVariantIds?: string[];
  initialLocationId?: string;
  initialMotif?: string;
  onSuccess?: () => void;
}

export const NewPressingDispatchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialVariantIds = [],
  initialLocationId,
  initialMotif,
  onSuccess,
}) => {
  const { providers, loadProviders, createDispatch } = usePressingStore();
  const { articles } = useStockStore();

  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("interne");
  const [typeTraitement, setTypeTraitement] = useState<string>("nettoyage_sec");
  const [motif, setMotif] = useState<string>(initialMotif || "usage_normal");
  const [coutDA, setCoutDA] = useState<string>("0");
  const [dateRetourPrevue, setDateRetourPrevue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [force, setForce] = useState<boolean>(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [dispatchResult, setDispatchResult] = useState<CreatePressingDispatchResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadProviders(true);
      setDispatchResult(null);
      setConflictWarning(null);

      if (initialVariantIds.length > 0) {
        setSelectedVariantIds(initialVariantIds);
      }
      if (initialMotif) {
        setMotif(initialMotif);
      }

      const d = new Date();
      d.setDate(d.getDate() + 3);
      setDateRetourPrevue(d.toISOString().split("T")[0]);
    }
  }, [isOpen, initialVariantIds, initialMotif, loadProviders]);

  // Mise à jour de la date prévisionnelle et du tarif lors du changement de prestataire
  const handleProviderChange = (provId: string) => {
    setSelectedProviderId(provId);
    if (provId === "interne") {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      setDateRetourPrevue(d.toISOString().split("T")[0]);
      setCoutDA("0");
    } else {
      const p = providers.find((item) => item.id === provId);
      if (p) {
        const d = new Date();
        d.setDate(d.getDate() + (p.delai_defaut_jours || 3));
        setDateRetourPrevue(d.toISOString().split("T")[0]);
        if (p.tarif_defaut_centimes) {
          setCoutDA(String(p.tarif_defaut_centimes));
        }
      }
    }
  };

  const toggleVariantSelection = (id: string) => {
    setSelectedVariantIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVariantIds.length === 0) {
      toast.error("Veuillez sélectionner au moins une pièce à envoyer.");
      return;
    }
    if (!dateRetourPrevue) {
      toast.error("Veuillez indiquer la date de retour prévue.");
      return;
    }

    setIsSubmitting(true);
    setConflictWarning(null);

    try {
      const input: CreatePressingDispatchInput = {
        variante_ids: selectedVariantIds,
        prestataire_id: selectedProviderId === "interne" ? undefined : selectedProviderId,
        location_id: initialLocationId,
        type_traitement: typeTraitement,
        motif,
        cout_centimes: parseInt(coutDA, 10) || 0,
        date_retour_prevue: dateRetourPrevue,
        force,
        notes: notes.trim() || undefined,
      };

      const result = await createDispatch(input);
      if (result.skipped && result.skipped.length > 0) {
        setDispatchResult(result);
        toast.success(
          result.dispatches.length > 1
            ? `${result.dispatches.length} pièces envoyées au pressing.`
            : `1 pièce envoyée au pressing (${result.dispatches[0]?.numero_envoi}).`
        );
        toast.warning(
          `${result.skipped.length} pièce(s) ignorée(s) : déjà au pressing.`,
          { duration: 8000 }
        );
        onSuccess?.();
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes("Conflit de date") || msg.includes("réservée pour le contrat")) {
        setConflictWarning(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const allVariants = useMemo(() => {
    return articles.flatMap((a) =>
      a.variants.map((v) => ({
        id: v.id,
        article_id: a.id,
        article_name: a.name,
        reference: a.reference,
        size: v.size,
        status: v.status,
      }))
    );
  }, [articles]);

  const availableVariants = useMemo(() => {
    return allVariants.filter(
      (v) =>
        selectedVariantIds.includes(v.id) ||
        v.status === "disponible" ||
        v.status === "reserve"
    );
  }, [allVariants, selectedVariantIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* En-tête */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Sparkles className="w-4 h-4 text-sky-500" />
            <span>Nouvel Envoi au Pressing / Atelier</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        {dispatchResult ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Envoi partiel effectué : les pièces disponibles ont été envoyées, mais les pièces déjà actives au pressing ont été ignorées pour éviter les doublons.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Colonne 1 : Confirmation pièces envoyées */}
              <div
                data-testid="dispatched-items-section"
                className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3"
              >
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs border-b border-emerald-500/20 pb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>{dispatchResult.dispatches.length} pièce(s) envoyée(s)</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dispatchResult.dispatches.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-lg bg-card border border-border text-foreground text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{d.article_name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                          {d.numero_envoi}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Taille : {d.size} | Réf : {d.reference}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Colonne 2 : Alerte distincte pièces ignorées */}
              <div
                data-testid="skipped-items-section"
                className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3"
              >
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs border-b border-amber-500/20 pb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{dispatchResult.skipped.length} pièce(s) ignorée(s)</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dispatchResult.skipped.map((s) => (
                    <div
                      key={s.variante_id}
                      className="p-2.5 rounded-lg bg-card border border-border text-foreground text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{s.article_nom}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono font-medium">
                          {s.numero_envoi_actif}
                        </span>
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">
                        {s.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                Terminer et Fermer
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Sélection des pièces */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Pièces à envoyer ({selectedVariantIds.length} sélectionnée(s)) *</span>
              </label>
            </div>

            <div className="border border-border rounded-xl p-2 max-h-44 overflow-y-auto space-y-1.5 bg-background">
              {availableVariants.map((v) => {
                const isSelected = selectedVariantIds.includes(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => toggleVariantSelection(v.id)}
                    className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border/70 hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-border"
                      />
                      <div>
                        <span className="font-semibold text-xs">{v.article_name}</span>
                        <span className="ml-2 text-[11px] opacity-80">
                          Taille : {v.size} | Réf : {v.reference}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSelected ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>
                );
              })}

              {availableVariants.length === 0 && (
                <p className="p-3 text-center text-muted-foreground text-xs">
                  Aucune pièce disponible trouvée.
                </p>
              )}
            </div>
          </div>

          {/* Prestataire et Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-foreground flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>Prestataire ou Atelier *</span>
              </label>
              <select
                value={selectedProviderId}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <option value="interne">Atelier interne (Boutique)</option>
                {providers
                  .filter((p) => p.actif)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} (délai {p.delai_defaut_jours}j
                      {p.tarif_defaut_centimes ? ` - ${formatDA(p.tarif_defaut_centimes)}` : ""})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date de retour prévue *</span>
              </label>
              <input
                type="date"
                required
                value={dateRetourPrevue}
                onChange={(e) => setDateRetourPrevue(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
          </div>

          {/* Type de traitement & Motif */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Type de traitement</label>
              <select
                value={typeTraitement}
                onChange={(e) => setTypeTraitement(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <option value="nettoyage_sec">Nettoyage à sec</option>
                <option value="repassage">Repassage & Défroissage</option>
                <option value="detachage">Détachage spécifique</option>
                <option value="reparation_legere">Retouche / Réparation légère</option>
                <option value="desinfection">Désinfection & Rafraîchissement</option>
                <option value="autre">Autre traitement</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Motif d'envoi</label>
              <select
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <option value="usage_normal">Usage normal (post-location)</option>
                <option value="tache">Tache ou salissure constatée</option>
                <option value="odeur">Odeur persistante</option>
                <option value="reparation_legere">Accroc / Couture défaite</option>
                <option value="preparation_vitrine">Préparation vitrine / shooting</option>
                <option value="autre">Autre motif</option>
              </select>
            </div>
          </div>

          {/* Coût estimé & Notes */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-medium text-foreground">Coût total estimé (DA)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={coutDA}
                onChange={(e) => setCoutDA(e.target.value)}
                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <label className="font-medium text-foreground">Notes / Instructions particulières</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : attention au col satin, tache vin revers gauche..."
                className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
          </div>

          {/* Avertissement de conflit réservation future */}
          {conflictWarning && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{conflictWarning}</span>
              </div>
              <label className="flex items-center gap-2 text-foreground font-semibold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="rounded border-amber-500 text-amber-500 focus:ring-amber-500"
                />
                <span>Forcer l'envoi au pressing malgré la réservation future</span>
              </label>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-secondary text-foreground text-xs font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedVariantIds.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? "Enregistrement..."
                  : `Confirmer l'envoi (${selectedVariantIds.length})`}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  </div>
);
};
