import React, { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import {
  FileBarChart,
  Download,
  FileText,
  Calendar,
  RefreshCw,
  X,
  CreditCard,
  Shirt,
  DollarSign,
} from "lucide-react";
import type {
  ReportPeriod,
  RapportsOverviewDto,
  FinancialTransactionRowDto,
  StockInventoryRowDto,
} from "@/types/reports";
import {
  fetchRapportsOverview,
  fetchFinancialTransactionsReport,
  fetchStockInventoryReport,
  exportFinancialReportCsv,
  exportFinancialReportPdf,
  exportCaisseJournalCsv,
  exportStockInventoryCsv,
} from "@/services/reportService";
import { formatDA } from "@/lib/utils";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export const RapportsPage: React.FC = () => {
  const [period, setPeriod] = useState<ReportPeriod>("mois");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [overview, setOverview] = useState<RapportsOverviewDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [, startTransition] = useTransition();

  // Modale d'aperçu
  const [activeModal, setActiveModal] = useState<"financier" | "caisse" | "stock" | null>(null);
  const [transactions, setTransactions] = useState<FinancialTransactionRowDto[]>([]);
  const [inventoryRows, setInventoryRows] = useState<StockInventoryRowDto[]>([]);

  const loadReportsData = async () => {
    setIsLoading(true);
    try {
      const [overviewData, txData, stockData] = await Promise.all([
        fetchRapportsOverview(period, dateFrom, dateTo),
        fetchFinancialTransactionsReport(period, dateFrom, dateTo),
        fetchStockInventoryReport(),
      ]);
      setOverview(overviewData);
      setTransactions(txData);
      setInventoryRows(stockData);
    } catch (err) {
      logger.error("RapportsPage: Erreur chargement données rapports", err);
      toast.error("Erreur lors du chargement des données de rapports");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportsData();
  }, [period, dateFrom, dateTo]);

  // Ouverture d'aperçu (consomme directement les données déjà résolues en mémoire)
  const handleOpenPreview = (type: "financier" | "caisse" | "stock") => {
    setActiveModal(type);
  };

  // Exports directs depuis les données résolues et affichées (zéro second appel IPC divergent)
  const handleExportFinancierPdf = async () => {
    if (!overview) return;
    try {
      toast.info("Génération du rapport financier PDF...");
      await exportFinancialReportPdf(overview, transactions);
      toast.success("Rapport financier PDF exporté");
    } catch (err) {
      logger.error("RapportsPage: Erreur export PDF financier", err);
      toast.error("Erreur lors de l'export PDF");
    }
  };

  const handleExportFinancierCsv = () => {
    if (!overview) return;
    try {
      exportFinancialReportCsv(overview, transactions);
      toast.success("Rapport financier CSV exporté");
    } catch (err) {
      logger.error("RapportsPage: Erreur export CSV financier", err);
      toast.error("Erreur lors de l'export CSV");
    }
  };

  const handleExportCaisseCsv = () => {
    if (!overview) return;
    try {
      exportCaisseJournalCsv(overview, transactions);
      toast.success("Journal de caisse CSV exporté");
    } catch (err) {
      logger.error("RapportsPage: Erreur export CSV caisse", err);
      toast.error("Erreur lors de l'export CSV");
    }
  };

  const handleExportStockCsv = () => {
    try {
      exportStockInventoryCsv(inventoryRows);
      toast.success("Inventaire de valorisation CSV exporté");
    } catch (err) {
      logger.error("RapportsPage: Erreur export CSV stock", err);
      toast.error("Erreur lors de l'export CSV");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 select-none"
    >
      {/* ── 1. En-tête & Sélecteur de période ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Rapports &amp; Exports
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bilan d'activité, registre des mouvements de caisse, TVA et valorisation de l'inventaire
          </p>
        </div>

        {/* Sélecteur de période */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1 text-xs">
            {(
              [
                { id: "aujourdhui", label: "Aujourd'hui" },
                { id: "semaine", label: "7 jours" },
                { id: "mois", label: "Ce mois" },
                { id: "annee", label: "Cette année" },
                { id: "personnalise", label: "Personnalisé" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setPeriod(p.id);
                  });
                }}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  period === p.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === "personnalise" && (
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent border-none text-xs text-foreground focus:outline-hidden"
              />
              <span className="text-muted-foreground">à</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent border-none text-xs text-foreground focus:outline-hidden"
              />
            </div>
          )}

          <button
            type="button"
            onClick={loadReportsData}
            disabled={isLoading}
            className="p-2 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Rafraîchir les rapports"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── 2. Les 3 Cartes de Rapports avec Métriques Réelles ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CARTE 1 : RAPPORT FINANCIER */}
        <div className="p-5 rounded-xl bg-card border border-border flex flex-col justify-between hover:border-border/80 transition-colors shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-lg bg-status-completed-bg text-status-completed border border-status-completed-border">
                <DollarSign className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border">
                PDF &amp; Excel
              </span>
            </div>
            <h3 className="font-semibold text-sm text-foreground">Rapport Financier</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Synthèse des revenus de location, acomptes perçus et ventes directes.
            </p>

            {/* Chiffres Réels */}
            <div className="space-y-2.5 p-3 rounded-lg bg-muted/30 border border-border text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Chiffre d'Affaires Global :</span>
                <span className="font-bold text-foreground text-sm font-mono" data-testid="ca-total">
                  {overview ? formatDA(overview.financier.ca_total_centimes) : "..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                <span>• Revenus Locations :</span>
                <span className="font-semibold text-foreground font-mono" data-testid="ca-locations">
                  {overview ? formatDA(overview.financier.ca_locations_centimes) : "..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                <span>• Ventes Directes :</span>
                <span className="font-semibold text-foreground font-mono" data-testid="ca-ventes">
                  {overview ? formatDA(overview.financier.ca_ventes_centimes) : "..."}
                </span>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between items-center">
                <span className="text-muted-foreground">Contrats / Ventes :</span>
                <span className="font-medium text-foreground" data-testid="nb-contrats">
                  {overview ? `${overview.financier.nombre_contrats} loc. / ${overview.financier.nombre_ventes} vte.` : "..."}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Taux de Retard :</span>
                <span
                  className={`font-semibold ${
                    overview && overview.financier.taux_retard_pourcentage > 0 ? "text-status-late" : "text-status-completed"
                  }`}
                  data-testid="taux-retard"
                >
                  {overview ? `${overview.financier.taux_retard_pourcentage}%` : "..."}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenPreview("financier")}
              className="flex-1 py-1.5 px-3 rounded-md bg-muted/60 border border-border text-xs font-medium text-foreground hover:bg-muted flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              Aperçu
            </button>
            <button
              type="button"
              onClick={handleExportFinancierPdf}
              className="py-1.5 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
              title="Exporter le rapport financier en PDF"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              type="button"
              onClick={handleExportFinancierCsv}
              className="py-1.5 px-3 rounded-md bg-secondary text-secondary-foreground border border-border text-xs font-medium hover:bg-secondary/80 flex items-center gap-1.5 transition-colors"
              title="Exporter le rapport financier en CSV / Excel"
            >
              CSV
            </button>
          </div>
        </div>

        {/* CARTE 2 : JOURNAL DE CAISSE */}
        <div className="p-5 rounded-xl bg-card border border-border flex flex-col justify-between hover:border-border/80 transition-colors shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-lg bg-status-reserved-bg text-status-reserved border border-status-reserved-border">
                <CreditCard className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border">
                CSV / Excel
              </span>
            </div>
            <h3 className="font-semibold text-sm text-foreground">Journal de Caisse &amp; Règlements</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Détail de toutes les écritures comptables par mode de paiement.
            </p>

            {/* Chiffres Réels */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Encaissé :</span>
                <span className="font-bold text-foreground text-sm font-mono" data-testid="total-reglements">
                  {overview ? formatDA(overview.caisse.total_reglements_centimes) : "..."}
                </span>
              </div>
              <div className="border-t border-border/60 pt-2 space-y-1">
                {overview &&
                  overview.caisse.reglements_par_mode.map((m) => (
                    <div key={m.moyen} className="flex justify-between items-center text-[11px] text-muted-foreground">
                      <span>• {m.label} :</span>
                      <span className="font-medium text-foreground font-mono">
                        {formatDA(m.montant_centimes)} ({m.nb_transactions})
                      </span>
                    </div>
                  ))}
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between items-center">
                <span className="text-muted-foreground">Volume Transactions :</span>
                <span className="font-medium text-foreground" data-testid="nb-transactions">
                  {overview ? `${overview.caisse.nombre_transactions} transaction(s)` : "..."}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenPreview("caisse")}
              className="flex-1 py-1.5 px-3 rounded-lg bg-muted/60 border border-border text-xs font-medium text-foreground hover:bg-muted active:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              Aperçu
            </button>
            <button
              type="button"
              onClick={handleExportCaisseCsv}
              className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter CSV
            </button>
          </div>
        </div>

        {/* CARTE 3 : VALORISATION DU PARC */}
        <div className="p-5 rounded-xl bg-card border border-border flex flex-col justify-between hover:border-border/80 transition-colors shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2 rounded-lg bg-status-cleaning-bg text-status-cleaning border border-status-cleaning-border">
                <Shirt className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono uppercase bg-muted px-2 py-0.5 rounded text-muted-foreground border border-border">
                Export CSV
              </span>
            </div>
            <h3 className="font-semibold text-sm text-foreground">Valorisation du Parc de Stock</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              État du stock complet, taux d'usure, amortissements et coûts de pressing.
            </p>

            {/* Chiffres Réels */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Valeur Totale du Parc :</span>
                <span className="font-bold text-foreground text-sm font-mono" data-testid="valeur-stock">
                  {overview ? formatDA(overview.stock.valeur_totale_stock_centimes) : "..."}
                </span>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between items-center text-[11px] text-muted-foreground">
                <span>• Pièces en Stock Total :</span>
                <span className="font-medium text-foreground" data-testid="total-pieces">
                  {overview ? `${overview.stock.nombre_articles_total} pièce(s)` : "..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                <span>• Pièces en Location :</span>
                <span className="font-medium text-foreground" data-testid="pieces-location">
                  {overview ? `${overview.stock.pieces_en_location} pièce(s)` : "..."}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                <span>• Pièces au Pressing :</span>
                <span className="font-medium text-foreground" data-testid="pieces-pressing">
                  {overview ? `${overview.stock.pieces_en_pressing} pièce(s)` : "..."}
                </span>
              </div>
              <div className="border-t border-border/60 pt-2 flex justify-between items-center">
                <span className="text-muted-foreground">Coût Pressing (Période) :</span>
                <span className="font-medium text-foreground" data-testid="cout-pressing">
                  {overview ? formatDA(overview.stock.cout_pressing_centimes) : "..."}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenPreview("stock")}
              className="flex-1 py-1.5 px-3 rounded-md bg-muted/60 border border-border text-xs font-medium text-foreground hover:bg-muted flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              Aperçu
            </button>
            <button
              type="button"
              onClick={handleExportStockCsv}
              className="py-1.5 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. MODALE D'APERÇU DES DONNÉES ── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <FileBarChart className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {activeModal === "financier" && "Aperçu du Rapport Financier"}
                    {activeModal === "caisse" && "Aperçu du Journal de Caisse & Règlements"}
                    {activeModal === "stock" && "Aperçu de l'Inventaire & Valorisation du Stock"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {overview && `Période active : ${overview.periode} (${overview.date_debut} au ${overview.date_fin})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Chargement des données détaillées...</span>
                </div>
              ) : activeModal === "stock" ? (
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Total : <strong className="text-foreground">{inventoryRows.length}</strong> référence(s) / variante(s) analysée(s).
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-2.5">Référence</th>
                          <th className="p-2.5">Article</th>
                          <th className="p-2.5">Catégorie</th>
                          <th className="p-2.5">Taille</th>
                          <th className="p-2.5">Statut</th>
                          <th className="p-2.5 text-right">Valeur Remplacement</th>
                          <th className="p-2.5 text-right">Coût Pressing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {inventoryRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="p-2.5 font-mono text-[11px] font-medium">{r.reference}</td>
                            <td className="p-2.5 font-medium text-foreground">{r.nom}</td>
                            <td className="p-2.5 text-muted-foreground">{r.categorie}</td>
                            <td className="p-2.5 text-muted-foreground">{r.taille}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-muted text-foreground border border-border">
                                {r.statut}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-medium">{formatDA(r.valeur_remplacement_centimes)}</td>
                            <td className="p-2.5 text-right text-muted-foreground">
                              {r.cout_pressing_total_centimes > 0 ? formatDA(r.cout_pressing_total_centimes) : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    Total : <strong className="text-foreground">{transactions.length}</strong> opération(s) trouvée(s) sur la période.
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Référence</th>
                          <th className="p-2.5">Opération</th>
                          <th className="p-2.5">Client</th>
                          <th className="p-2.5">Mode</th>
                          <th className="p-2.5 text-right">Montant</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {transactions.map((t) => (
                          <tr key={t.id} className="hover:bg-muted/20">
                            <td className="p-2.5 text-muted-foreground">{t.date_operation.slice(0, 10)}</td>
                            <td className="p-2.5 font-mono text-[11px] font-medium text-foreground">{t.reference}</td>
                            <td className="p-2.5 text-muted-foreground">{t.type_operation}</td>
                            <td className="p-2.5 font-medium">{t.client_nom}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-muted text-foreground border border-border">
                                {t.moyen_paiement}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold text-foreground">
                              {formatDA(t.montant_centimes)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border bg-muted/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Document synchronisé en temps réel avec la base de données SQLite
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted text-muted-foreground"
                >
                  Fermer
                </button>
                {activeModal === "financier" && (
                  <button
                    type="button"
                    onClick={handleExportFinancierPdf}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter PDF
                  </button>
                )}
                {activeModal === "caisse" && (
                  <button
                    type="button"
                    onClick={handleExportCaisseCsv}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter CSV
                  </button>
                )}
                {activeModal === "stock" && (
                  <button
                    type="button"
                    onClick={handleExportStockCsv}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter CSV
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
