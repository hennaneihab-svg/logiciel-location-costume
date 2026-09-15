import React, { useState } from "react";
import { usePackStore } from "@/store/packStore";
import { useStockStore } from "@/store/stockStore";
import { formatDA } from "@/lib/utils";
import { Package, CheckCircle2, AlertCircle, X } from "lucide-react";
import type { PackItemChoice } from "@/types/pack";

export const PackReservationModal: React.FC = () => {
  const { packs, isModalOpen, setModalOpen, reservePack } = usePackStore();
  const articles = useStockStore((s) => s.articles);

  const [selectedPackId, setSelectedPackId] = useState<string>(packs[0]?.pack.id || "");
  const [choices, setChoices] = useState<Record<string, { articleId?: string; variantId?: string; qty?: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isModalOpen) return null;

  const activePack = packs.find((p) => p.pack.id === selectedPackId);

  const handleVariantSelect = (packItemId: string, articleId: string, variantId: string) => {
    setChoices((prev) => ({
      ...prev,
      [packItemId]: { ...prev[packItemId], articleId, variantId },
    }));
  };

  const handleReserve = async () => {
    if (!activePack) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessResult(null);

    try {
      const payloadChoices: PackItemChoice[] = activePack.items.map((item) => {
        const userChoice = choices[item.id];
        return {
          pack_item_id: item.id,
          article_id: item.article_id || userChoice?.articleId,
          variante_id: userChoice?.variantId,
          quantite: userChoice?.qty || item.quantite,
        };
      });

      const lines = await reservePack({
        pack_id: activePack.pack.id,
        choices: payloadChoices,
      });

      setSuccessResult(lines);
    } catch (err: any) {
      setErrorMessage(err?.message || "Erreur de réservation du pack");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card w-full max-w-2xl rounded-xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* En-tête */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base text-foreground">
              Réservation Transactionnelle de Pack
            </h3>
          </div>
          <button
            onClick={() => setModalOpen(false)}
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
                    setSuccessResult(null);
                    setErrorMessage(null);
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
                          {fixedArticle?.cleaning_fee_cents ? "Quantité" : "Variante individuelle"}
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

          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successResult && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Réservation transactionnelle validée !
              </div>
              <ul className="list-disc list-inside space-y-0.5 pt-1 text-[11px]">
                {successResult.map((l: any, i: number) => (
                  <li key={i}>
                    {l.article_nom} — {l.mode_gestion === "quantite" ? `Quantité : ${l.quantite}` : `Variante ID : ${l.variante_id}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="p-4 border-t border-border flex justify-end gap-2 bg-secondary/10">
          <button
            onClick={() => setModalOpen(false)}
            className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
          >
            Fermer
          </button>
          <button
            onClick={handleReserve}
            disabled={isSubmitting || !activePack}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? "Réservation en cours..." : "Confirmer la Réservation du Pack"}
          </button>
        </div>
      </div>
    </div>
  );
};
