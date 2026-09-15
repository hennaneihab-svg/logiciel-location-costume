import React, { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { formatCents, eurosToCents } from "@/lib/utils";
import { useRentalStore } from "@/store/rentalStore";
import { toast } from "sonner";

export const ReturnProcessModal: React.FC = () => {
  const {
    isReturnModalOpen,
    selectedContractForReturn,
    setReturnModalOpen,
    processReturn,
  } = useRentalStore();

  const [itemsConditions, setItemsConditions] = useState<
    Record<
      string,
      {
        condition: "bon_etat" | "a_nettoyer" | "endommage";
        damageFeeEuros: string;
        damageNotes: string;
      }
    >
  >({});

  useEffect(() => {
    if (selectedContractForReturn) {
      const initial: Record<
        string,
        {
          condition: "bon_etat" | "a_nettoyer" | "endommage";
          damageFeeEuros: string;
          damageNotes: string;
        }
      > = {};

      selectedContractForReturn.items.forEach((item) => {
        initial[item.variant_id] = {
          condition: "bon_etat",
          damageFeeEuros: "0",
          damageNotes: "",
        };
      });

      setItemsConditions(initial);
    }
  }, [selectedContractForReturn]);

  if (!isReturnModalOpen || !selectedContractForReturn) return null;

  const contract = selectedContractForReturn;

  const handleConditionChange = (
    variantId: string,
    cond: "bon_etat" | "a_nettoyer" | "endommage"
  ) => {
    setItemsConditions((prev) => {
      const existing = prev[variantId] || {
        condition: "bon_etat",
        damageFeeEuros: "0",
        damageNotes: "",
      };

      // Si endommagé, suggérer automatiquement une retenue forfaitaire (ex: 3 000 DA)
      const fee = cond === "endommage" ? "3000" : "0";

      return {
        ...prev,
        [variantId]: {
          ...existing,
          condition: cond,
          damageFeeEuros: fee,
        },
      };
    });
  };

  const handleDamageFeeChange = (variantId: string, val: string) => {
    setItemsConditions((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        damageFeeEuros: val,
      },
    }));
  };

  const handleDamageNotesChange = (variantId: string, val: string) => {
    setItemsConditions((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        damageNotes: val,
      },
    }));
  };

  // Calcul du total des retenues sur caution
  const totalDamageFeeCents = Object.values(itemsConditions).reduce(
    (sum, val) => sum + (val.condition === "endommage" ? eurosToCents(val.damageFeeEuros || "0") : 0),
    0
  );

  const returnedDepositCents = Math.max(
    0,
    contract.deposit_amount_cents - totalDamageFeeCents
  );

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();

    // Vérifier si un commentaire est saisi pour les articles endommagés
    for (const [, val] of Object.entries(itemsConditions)) {
      if (val.condition === "endommage" && !val.damageNotes.trim()) {
        toast.error("Veuillez renseigner le motif du dommage / dégradation pour chaque article endommagé.");
        return;
      }
    }

    const payload = contract.items.map((item) => {
      const state = itemsConditions[item.variant_id] || {
        condition: "bon_etat" as const,
        damageFeeEuros: "0",
        damageNotes: "",
      };
      return {
        variant_id: item.variant_id,
        condition: state.condition,
        damage_fee_cents: eurosToCents(state.damageFeeEuros || "0"),
        damage_notes: state.damageNotes.trim() || undefined,
      };
    });

    processReturn(contract.id, payload);

    if (totalDamageFeeCents > 0) {
      toast.warning(
        `Retour clôturé avec litige : Retenue de ${formatCents(totalDamageFeeCents)} appliquée sur la caution. Reste restitué : ${formatCents(returnedDepositCents)}.`
      );
    } else {
      toast.success(
        `Retour conforme validé pour le contrat ${contract.contract_number} ! Caution intégrale (${formatCents(contract.deposit_amount_cents)}) restituée au client.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal Retour */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <RotateCcw className="w-4 h-4 text-amber-500" />
            <span>Contrôle d'État & Clôture de Retour — {contract.contract_number}</span>
          </div>
          <button
            onClick={() => setReturnModalOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps Formulaire de Retour */}
        <form onSubmit={handleSubmitReturn} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Bloc Résumé du Contrat */}
          <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-foreground text-sm">
                {contract.customer_name}
              </div>
              <p className="text-muted-foreground mt-0.5">
                Période : {contract.pickup_date} au {contract.return_date_scheduled}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Caution Initiale ({contract.deposit_method})
              </span>
              <span className="font-extrabold text-foreground text-sm">
                {formatCents(contract.deposit_amount_cents)}
              </span>
            </div>
          </div>

          {/* Liste de chaque article loué pour inspection contradictoire */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              Contrôle Pièce par Pièce ({contract.items.length} article(s))
            </h4>

            {contract.items.map((item) => {
              const condState = itemsConditions[item.variant_id] || {
                condition: "bon_etat",
                damageFeeEuros: "0",
                damageNotes: "",
              };

              return (
                <div
                  key={item.variant_id}
                  className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {item.barcode}
                        </span>
                        <span className="font-bold text-xs text-foreground">
                          {item.article_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Taille {item.size} • État au départ : {item.pickup_condition}
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-muted-foreground">
                      Valeur caution : {formatCents(item.deposit_cents)}
                    </span>
                  </div>

                  {/* Choix d'état au retour */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        id: "bon_etat",
                        label: "Bon état / Conforme",
                        color: "border-emerald-500/40 text-emerald-500",
                        activeBg: "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold",
                      },
                      {
                        id: "a_nettoyer",
                        label: "À nettoyer (pressing)",
                        color: "border-slate-500/40 text-slate-400",
                        activeBg: "bg-slate-500/20 border-slate-400 text-slate-200 font-bold",
                      },
                      {
                        id: "endommage",
                        label: "Endommagé / Dégradé",
                        color: "border-red-500/40 text-red-500",
                        activeBg: "bg-red-500/20 border-red-500 text-red-400 font-bold",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          handleConditionChange(item.variant_id, opt.id as any)
                        }
                        className={`py-2 px-2 rounded-lg text-xs border text-center transition-all ${
                          condState.condition === opt.id
                            ? opt.activeBg
                            : "bg-secondary/30 hover:bg-secondary/60 text-muted-foreground border-border"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Si l'article est endommagé : montant de retenue + motif */}
                  {condState.condition === "endommage" && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 space-y-2.5 animate-in fade-in">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>Retenue proposée sur caution pour cet article</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-medium text-foreground block mb-1">
                            Montant de la retenue (DA)
                          </label>
                          <input
                            type="number"
                            step="500"
                            min="0"
                            value={condState.damageFeeEuros}
                            onChange={(e) =>
                              handleDamageFeeChange(item.variant_id, e.target.value)
                            }
                            placeholder="60"
                            className="w-full h-8 px-2.5 rounded bg-background border border-border text-xs text-foreground font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-medium text-foreground block mb-1">
                            Motif du dommage * (obligatoire)
                          </label>
                          <input
                            type="text"
                            required
                            value={condState.damageNotes}
                            onChange={(e) =>
                              handleDamageNotesChange(item.variant_id, e.target.value)
                            }
                            placeholder="Ex : Brûlure de cigarette revers manche, accroc pantalon..."
                            className="w-full h-8 px-2.5 rounded bg-background border border-border text-xs text-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bilan du Sort de la Caution */}
          <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Caution initiale déposée :</span>
              <span className="font-semibold text-foreground">
                {formatCents(contract.deposit_amount_cents)}
              </span>
            </div>

            {totalDamageFeeCents > 0 && (
              <div className="flex items-center justify-between text-red-400 font-bold">
                <span>Retenue totale dégradation :</span>
                <span>- {formatCents(totalDamageFeeCents)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                {totalDamageFeeCents > 0 ? (
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
                <span>Montant de caution à restituer au client :</span>
              </span>
              <span className="font-black text-emerald-500 text-base">
                {formatCents(returnedDepositCents)}
              </span>
            </div>
          </div>

          {/* Footer Validation */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setReturnModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider le Retour & Libérer la Caution</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
