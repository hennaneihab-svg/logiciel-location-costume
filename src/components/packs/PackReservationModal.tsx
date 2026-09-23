import React, { useState } from "react";
import { usePackStore } from "@/store/packStore";
import { useStockStore } from "@/store/stockStore";
import { formatDA } from "@/lib/utils";
import { Package, CheckCircle2, X } from "lucide-react";
import type { PackLineInput, ReservedLine } from "@/types/pack";

interface PackReservationModalProps {
  /** Contrôle l'ouverture / fermeture du modal */
  isOpen: boolean;
  /** Appelé quand l'utilisateur ferme sans confirmer */
  onClose: () => void;
  /**
   * Appelé avec les lignes résultantes quand l'utilisateur confirme.
   * Le parent (CreateRentalModal) est responsable d'incorporer ces lignes dans
   * le contrat avant de le soumettre. Aucun appel IPC n'est émis ici.
   */
  onConfirm: (lines: PackLineInput[], displayLines: ReservedLine[]) => void;
}

export const PackReservationModal: React.FC<PackReservationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { packs } = usePackStore();
  const articles = useStockStore((s) => s.articles);

  const [selectedPackId, setSelectedPackId] = useState<string>(packs[0]?.pack.id || "");
  const [choices, setChoices] = useState<Record<string, { articleId?: string; variantId?: string; qty?: number }>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const activePack = packs.find((p) => p.pack.id === selectedPackId);

  const handleVariantSelect = (packItemId: string, articleId: string, variantId: string) => {
    setChoices((prev) => ({
      ...prev,
      [packItemId]: { ...prev[packItemId], articleId, variantId },
    }));
    setValidationError(null);
  };

  const handleConfirm = () => {
    if (!activePack) return;

    // Validation : tous les slots obligatoires doivent avoir un choix
    const missingSlots = activePack.items
      .filter((item) => item.obligatoire === 1)
      .filter((item) => {
        const choice = choices[item.id];
        if (item.article_id) {
          // Article fixe : pas de choix requis
          return false;
        }
        // Slot catégorie libre : doit avoir un articleId sélectionné
        return !choice?.articleId && !choice?.variantId;
      });

    if (missingSlots.length > 0) {
      setValidationError(
        `Veuillez compléter tous les éléments obligatoires du pack (${missingSlots.length} manquant${missingSlots.length > 1 ? "s" : ""}).`
      );
      return;
    }

    // Construction des lignes à transmettre au formulaire parent
    const packLines: PackLineInput[] = [];
    const displayLines: ReservedLine[] = [];

    for (const item of activePack.items) {
      const userChoice = choices[item.id];
      const resolvedArticleId = item.article_id || userChoice?.articleId;
      const resolvedVariantId = userChoice?.variantId;
      const qty = userChoice?.qty || item.quantite;

      if (!resolvedArticleId) continue; // slot non rempli non-obligatoire

      const art = articles.find((a) => a.id === resolvedArticleId);
      const artNom = art?.name || resolvedArticleId;
      const modeGestion: "variante" | "quantite" = resolvedVariantId ? "variante" : "quantite";

      packLines.push({
        pack_id: activePack.pack.id,
        variante_id: resolvedVariantId || undefined,
        article_id: modeGestion === "quantite" ? resolvedArticleId : undefined,
        quantite: qty,
      });

      displayLines.push({
        pack_item_id: item.id,
        pack_id: activePack.pack.id,
        article_id: resolvedArticleId,
        article_nom: artNom,
        variante_id: resolvedVariantId,
        quantite: qty,
        mode_gestion: modeGestion,
      });
    }

    onConfirm(packLines, displayLines);
    // Réinitialisation pour la prochaine ouverture
    setChoices({});
    setValidationError(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card w-full max-w-2xl rounded-xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* En-tête */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base text-foreground">
              Ajouter un Pack à la Location
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Sélection du Pack */}
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Choisir un Pack
            </label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {packs.map((p) => (
                <button
                  key={p.pack.id}
                  onClick={() => {
                    setSelectedPackId(p.pack.id);
                    setChoices({});
                    setValidationError(null);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedPackId === p.pack.id
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium text-sm text-foreground">{p.pack.nom}</div>
                  <div className="text-xs text-primary font-semibold mt-1">
                    {p.pack.prix_forfait_centimes ? formatDA(p.pack.prix_forfait_centimes) : "Tarif à la carte"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                    Cible : {p.pack.cible} ({p.items.length} éléments)
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Slots du pack actif */}
          {activePack && (
            <div className="space-y-4">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Composition & Choix des Pièces
              </label>

              <div className="space-y-3">
                {activePack.items.map((item, index) => {
                  const fixedArticle = item.article_id
                    ? articles.find((a) => a.id === item.article_id)
                    : null;

                  const categoryArticles = !item.article_id
                    ? articles.filter((a) => a.category_id === item.categorie_id)
                    : [];

                  const selectedArticleId = choices[item.id]?.articleId || item.article_id;
                  const currentArticle = articles.find((a) => a.id === selectedArticleId);
                  const availableVariants = currentArticle?.variants.filter((v) => v.status === "disponible") || [];

                  return (
                    <div key={item.id} className="p-3.5 rounded-lg border border-border bg-secondary/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          Élément #{index + 1} : {fixedArticle ? fixedArticle.name : `Slot Catégorie (${item.categorie_id})`}
                        </span>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                          {item.obligatoire === 1 ? "Obligatoire" : "Optionnel"}
                        </span>
                      </div>

                      {!item.article_id && (
                        <div>
                          <select
                            className="w-full text-xs p-2 rounded border border-border bg-card text-foreground"
                            value={selectedArticleId || ""}
                            onChange={(e) => {
                              const artId = e.target.value;
                              const art = articles.find((a) => a.id === artId);
                              const defaultVar = art?.variants.find((v) => v.status === "disponible");
                              setChoices((prev) => ({
                                ...prev,
                                [item.id]: { articleId: artId, variantId: defaultVar?.id },
                              }));
                              setValidationError(null);
                            }}
                          >
                            <option value="">-- Sélectionner un modèle --</option>
                            {categoryArticles.map((art) => (
                              <option key={art.id} value={art.id}>
                                {art.name} ({art.reference})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {currentArticle && availableVariants.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground">Taille :</span>
                          <div className="flex flex-wrap gap-1.5">
                            {availableVariants.map((v) => (
                              <button
                                key={v.id}
                                onClick={() => handleVariantSelect(item.id, currentArticle.id, v.id)}
                                className={`px-2.5 py-1 text-xs rounded border transition-all ${
                                  choices[item.id]?.variantId === v.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:bg-muted"
                                }`}
                              >
                                {v.size} {v.sub_size ? `(${v.sub_size})` : ""}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {validationError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {validationError}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="p-4 border-t border-border flex justify-end gap-2 bg-secondary/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!activePack}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            Ajouter ce Pack à la Location
          </button>
        </div>
      </div>
    </div>
  );
};
