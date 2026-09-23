import React, { useState, useMemo, useEffect } from "react";
import {
  Lock,
  Unlock,
  Coins,
  CreditCard,
  Banknote,
  FileCheck2,
  FileText,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Building2,
} from "lucide-react";
import { useCaisseStore, AVAILABLE_CASHIERS } from "@/store/caisseStore";
import { formatCents } from "@/lib/utils";
import { generateCloturePdf } from "@/services/receiptPdfService";
import { toast } from "sonner";

export const ClotureCaisseView: React.FC = () => {
  const {
    currentCashier,
    setCurrentCashier,
    todayCloture,
    validateTodayCloture,
    reopenCaisse,
    getTodayTransactions,
    getClotureDraft,
    loadActiveSession,
  } = useCaisseStore();

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  const transactions = useMemo(() => getTodayTransactions(), [getTodayTransactions]);

  // Saisie du comptage physique réel d'espèces
  const [countedCashInput, setCountedCashInput] = useState<string>("");
  const [operatorNotes, setOperatorNotes] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Brouillon temps réel
  const draft = useMemo(() => {
    const parsedDA =
      countedCashInput.trim() !== ""
        ? Math.round(parseFloat(countedCashInput))
        : undefined;
    return getClotureDraft(parsedDA);
  }, [getClotureDraft, countedCashInput]);

  // Si déjà clôturé, on utilise les données scellées
  const activeData = todayCloture || draft;

  const handleValidate = async () => {
    try {
      const countedDA =
        countedCashInput.trim() !== ""
          ? Math.round(parseFloat(countedCashInput))
          : activeData.theoretical_cash_cents;

      const cloture = await validateTodayCloture(countedDA, operatorNotes);
      toast.success("Caisse journalière clôturée et scellée avec succès !");

      // Impression automatique du rapport Z
      try {
        setIsPrinting(true);
        const res = await generateCloturePdf(cloture, transactions);
        res.print();
        setIsPrinting(false);
      } catch (err) {
        console.error(err);
        setIsPrinting(false);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erreur lors de la clôture de la caisse");
    }
  };

  const handlePrintReport = async () => {
    try {
      setIsPrinting(true);
      const res = await generateCloturePdf(activeData, transactions);
      res.print();
      setIsPrinting(false);
      toast.success("Impression du Ticket Z lancée");
    } catch (err) {
      console.error(err);
      setIsPrinting(false);
      toast.error("Erreur lors de la génération du rapport");
    }
  };

  const handleDownloadReport = async () => {
    try {
      const res = await generateCloturePdf(activeData, transactions);
      res.download();
      toast.success("Rapport Z téléchargé");
    } catch (err) {
      console.error(err);
      toast.error("Erreur téléchargement");
    }
  };

  const isClosed = todayCloture !== null && todayCloture.status === "cloturee";

  return (
    <div className="space-y-6">
      {/* 1. Bandeau de Statut et Utilisateur Connecté */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-xl flex items-center justify-center ${
              isClosed
                ? "bg-red-500/15 text-red-500"
                : "bg-emerald-500/15 text-emerald-500"
            }`}
          >
            {isClosed ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Clôture de Caisse Journalière (Ticket Z)
              </h3>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  isClosed
                    ? "bg-red-500/15 text-red-600 border border-red-500/30"
                    : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                }`}
              >
                {isClosed ? "Caisse Clôturée & Scellée" : "Caisse Ouverte (En Cours)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isClosed
                ? `Clôturée le ${new Date(activeData.closed_at).toLocaleTimeString("fr-FR")} par ${activeData.closed_by_user_name}`
                : "Récapitulatif des encaissements en direct (ventes comptoir + locations)"}
            </p>
          </div>
        </div>

        {/* Sélecteur d'opérateur connecté & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/50 border border-border/80 px-3 py-1.5 rounded-xl text-xs">
            <UserCheck className="w-4 h-4 text-primary" />
            <div className="text-left">
              <span className="text-[10px] text-muted-foreground block font-medium">
                Utilisateur connecté :
              </span>
              <select
                disabled={isClosed}
                value={currentCashier.id}
                onChange={(e) => {
                  const u = AVAILABLE_CASHIERS.find((c) => c.id === e.target.value);
                  if (u) setCurrentCashier(u);
                }}
                className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer disabled:opacity-75"
              >
                {AVAILABLE_CASHIERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isClosed && (
            <button
              type="button"
              onClick={reopenCaisse}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-secondary/60 hover:bg-secondary border border-border text-foreground transition-colors"
              title="Réouvrir la caisse pour ajustements"
            >
              Réouvrir
            </button>
          )}
        </div>
      </div>

      {/* 2. Cartes Synthèse CA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Encaissé Aujourd'hui</span>
            <Banknote className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2 font-mono">
            {formatCents(activeData.grand_total_cents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {transactions.length} transaction{transactions.length > 1 ? "s" : ""} traitée{transactions.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Ventes Directes (Boutique)</span>
            <Coins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            {formatCents(activeData.sales_total_cents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Articles neufs & accessoires
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Locations Encaissées</span>
            <CreditCard className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 font-mono">
            {formatCents(activeData.rentals_total_cents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Acomptes & soldes de contrats
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Fonds de Caisse d'Ouverture</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground mt-2 font-mono">
            {formatCents(activeData.initial_cash_float_cents)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Monnaie de fond au démarrage
          </p>
        </div>
      </div>

      {/* 3. Répartition par Mode de Paiement & Réconciliation Tiroir-Caisse */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Répartition par Mode (7 colonnes) */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground">
              Répartition par Mode de Règlement
            </h4>
            <span className="text-xs text-muted-foreground">
              Date : {activeData.date}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Espèces */}
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/70 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Banknote className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground block">Espèces</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {formatCents(activeData.breakdown.especes.total_cents)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {activeData.breakdown.especes.transaction_count} transaction(s)
                </span>
              </div>
            </div>

            {/* Carte Bancaire */}
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/70 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground block">Carte Bancaire</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {formatCents(activeData.breakdown.carte_bancaire.total_cents)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {activeData.breakdown.carte_bancaire.transaction_count} transaction(s)
                </span>
              </div>
            </div>

            {/* Chèques */}
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/70 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground block">Chèques</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {formatCents(activeData.breakdown.cheque.total_cents)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {activeData.breakdown.cheque.transaction_count} transaction(s)
                </span>
              </div>
            </div>

            {/* Virements */}
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/70 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground block">Virements</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {formatCents(activeData.breakdown.virement.total_cents)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  {activeData.breakdown.virement.transaction_count} transaction(s)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Colonne Droite : Réconciliation Tiroir Espèces (5 colonnes) */}
        <div className="lg:col-span-5 bg-card border border-border rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-500" />
              <span>Contrôle & Écart de Caisse</span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Comparaison entre le solde théorique et le comptage physique
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Fonds d'ouverture initial :</span>
              <span className="font-bold font-mono">
                {formatCents(activeData.initial_cash_float_cents)}
              </span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-secondary/30">
              <span className="text-muted-foreground">Espèces encaissées ce jour :</span>
              <span className="font-bold font-mono text-emerald-600">
                + {formatCents(activeData.breakdown.especes.total_cents)}
              </span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-secondary/60 border border-border font-semibold">
              <span>Espèces Théoriques Attendues :</span>
              <span className="font-mono text-foreground font-bold">
                {formatCents(activeData.theoretical_cash_cents)}
              </span>
            </div>
          </div>

          {/* Saisie Comptage Réel */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-foreground block">
              Comptage réel d'espèces dans le tiroir (DA) :
            </label>
            <div className="relative">
              <input
                type="number"
                step="100"
                min="0"
                disabled={isClosed}
                value={
                  isClosed
                    ? activeData.counted_cash_cents.toString()
                    : countedCashInput || activeData.theoretical_cash_cents.toString()
                }
                onChange={(e) => setCountedCashInput(e.target.value)}
                className="w-full h-10 px-3 text-sm font-bold font-mono rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-75"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-xs">
                DA
              </span>
            </div>
          </div>

          {/* Écart de Caisse Dynamique */}
          {(() => {
            const disc = activeData.discrepancy_cents;
            const isExact = disc === 0;
            const isPos = disc > 0;
            return (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  isExact
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isExact ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-bold block">
                      {isExact ? "Caisse Parfaitement Équilibrée" : "Écart de Caisse Constaté"}
                    </span>
                    <span className="text-[10px] opacity-85">
                      {isExact ? "Zéro écart" : isPos ? "Excédent en caisse" : "Déficit constaté"}
                    </span>
                  </div>
                </div>
                <span className="text-base font-black font-mono">
                  {isPos ? "+" : ""}
                  {formatCents(disc)}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 4. Journal Détaillé des Opérations du Jour */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Journal des Opérations du Jour ({transactions.length})
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Détail chronologique des encaissements (ventes directes et contrats)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px] font-semibold border-y border-border">
              <tr>
                <th className="py-2.5 px-3">Heure</th>
                <th className="py-2.5 px-3">Référence</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3">Mode Règlement</th>
                <th className="py-2.5 px-3">Opérateur</th>
                <th className="py-2.5 px-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    Aucune transaction enregistrée aujourd'hui.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {new Date(tx.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                      {tx.reference_number}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          tx.type === "vente_directe"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : tx.type === "location_solde"
                            ? "bg-blue-500/15 text-blue-600"
                            : "bg-amber-500/15 text-amber-600"
                        }`}
                      >
                        {tx.type === "vente_directe"
                          ? "Vente Directe"
                          : tx.type === "location_solde"
                          ? "Loc. Solde"
                          : "Loc. Acompte"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-foreground">
                      {tx.client_name}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-muted-foreground">
                      {tx.payment_method.replace("_", " ")}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {tx.operator_name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {formatCents(tx.amount_cents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Validation Officielle & Clôture */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">
              Validation par l'Utilisateur Connecté
            </h4>
            <span className="text-xs text-primary font-semibold">
              ({currentCashier.name})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isClosed
              ? `Clôture validée avec le numéro officiel ${activeData.cloture_number}.`
              : "En clôturant la caisse, vous scellez le journal du jour et générez le Ticket Z officiel."}
          </p>
          {!isClosed && (
            <input
              type="text"
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="Notes de clôture (ex: Remise en coffre effectuée, aucun incident)..."
              className="mt-2 w-full max-w-md h-8 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          {isClosed ? (
            <>
              <button
                type="button"
                onClick={handlePrintReport}
                disabled={isPrinting}
                className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer Rapport Z (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="p-2.5 rounded-xl border border-border text-foreground hover:bg-secondary transition-colors"
                title="Télécharger le PDF"
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleValidate}
              disabled={isPrinting}
              className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-2 shadow-lg shadow-primary/25 transition-all"
            >
              <Lock className="w-4 h-4" />
              <span>Valider la Clôture & Imprimer Ticket Z</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
