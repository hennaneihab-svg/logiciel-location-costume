import { invokeCommand, isTauri } from "./tauri";
import type {
  RapportsOverviewDto,
  FinancialTransactionRowDto,
  StockInventoryRowDto,
  ReportPeriod,
} from "@/types/reports";
import { formatDA } from "@/lib/utils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { useRentalStore } from "@/store/rentalStore";
import { useCaisseStore } from "@/store/caisseStore";
import { useStockStore } from "@/store/stockStore";
import { usePressingStore } from "@/store/pressingStore";

// ─── 1. Récupération des données réelles SQLite (IPC Tauri) ou repli mémoire ───

export async function fetchRapportsOverview(
  period: ReportPeriod = "mois",
  dateFrom?: string,
  dateTo?: string
): Promise<RapportsOverviewDto> {
  if (isTauri()) {
    try {
      return await invokeCommand<RapportsOverviewDto>("get_rapports_overview", {
        periode: period,
        date_debut: dateFrom || null,
        date_fin: dateTo || null,
      });
    } catch (err) {
      console.warn("[reportService] IPC get_rapports_overview failed, fallback to memory stores:", err);
    }
  }

  return calculateRapportsOverviewFromStores(period, dateFrom, dateTo);
}

export async function fetchFinancialTransactionsReport(
  period: ReportPeriod = "mois",
  dateFrom?: string,
  dateTo?: string
): Promise<FinancialTransactionRowDto[]> {
  if (isTauri()) {
    try {
      return await invokeCommand<FinancialTransactionRowDto[]>("get_financial_transactions_report", {
        periode: period,
        date_debut: dateFrom || null,
        date_fin: dateTo || null,
      });
    } catch (err) {
      console.warn("[reportService] IPC get_financial_transactions_report failed:", err);
    }
  }

  // Fallback mémoire
  const contracts = useRentalStore.getState().contracts;
  const sales = useCaisseStore.getState().salesHistory;
  const rows: FinancialTransactionRowDto[] = [];

  contracts.forEach((c) => {
    if (c.paid_amount_cents > 0) {
      rows.push({
        id: `pay-${c.id}`,
        reference: c.contract_number,
        type_operation: c.remaining_amount_cents === 0 ? "solde" : "acompte",
        client_nom: c.customer_name,
        moyen_paiement: c.payment_method || "especes",
        montant_centimes: c.paid_amount_cents,
        date_operation: c.updated_at || c.created_at,
        operateur_nom: "Administrateur",
      });
    }
  });

  sales.forEach((s) => {
    rows.push({
      id: `vte-pay-${s.id}`,
      reference: s.sale_number,
      type_operation: "vente_directe",
      client_nom: s.customer_name,
      moyen_paiement: s.payment.method,
      montant_centimes: s.total_amount_cents,
      date_operation: s.created_at,
      operateur_nom: s.user_name || "Vendeur",
    });
  });

  return rows.sort((a, b) => b.date_operation.localeCompare(a.date_operation));
}

export async function fetchStockInventoryReport(): Promise<StockInventoryRowDto[]> {
  if (isTauri()) {
    try {
      return await invokeCommand<StockInventoryRowDto[]>("get_stock_inventory_report");
    } catch (err) {
      console.warn("[reportService] IPC get_stock_inventory_report failed:", err);
    }
  }

  // Fallback mémoire
  const articles = useStockStore.getState().articles;
  const rows: StockInventoryRowDto[] = [];

  articles.forEach((art) => {
    art.variants.forEach((v) => {
      rows.push({
        variant_id: v.id,
        article_id: art.id,
        reference: art.reference,
        nom: art.name,
        categorie: art.category_name || "Général",
        taille: v.size || "Unique",
        statut: v.status,
        valeur_remplacement_centimes: art.deposit_price_cents || art.rental_price_cents * 3 || 0,
        cout_pressing_total_centimes: 0,
      });
    });
  });

  return rows;
}

export function calculateRapportsOverviewFromStores(
  period: ReportPeriod = "mois",
  dateFrom?: string,
  dateTo?: string
): RapportsOverviewDto {
  const contracts = useRentalStore.getState().contracts;
  const sales = useCaisseStore.getState().salesHistory;
  const articles = useStockStore.getState().articles;
  const dispatches = usePressingStore.getState().dispatches;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const isInPeriod = (isoDate: string): boolean => {
    if (period === "personnalise" && dateFrom && dateTo) {
      return isoDate >= dateFrom && isoDate <= dateTo + "T23:59:59Z";
    }
    const d = new Date(isoDate);
    if (period === "aujourdhui") return isoDate.slice(0, 10) === todayStr;
    if (period === "semaine") {
      const w = new Date(now.getTime() - 7 * 86400000);
      return d >= w && d <= now;
    }
    if (period === "annee") return d.getFullYear() === now.getFullYear();
    // mois
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  const pContracts = contracts.filter((c) => isInPeriod(c.created_at) && c.status !== "annule");
  const pSales = sales.filter((s) => isInPeriod(s.created_at));

  const ca_locations_centimes = pContracts.reduce((sum, c) => sum + c.total_amount_cents, 0);
  const ca_ventes_centimes = pSales.reduce((sum, s) => sum + s.total_amount_cents, 0);
  const ca_total_centimes = ca_locations_centimes + ca_ventes_centimes;

  const lateContracts = pContracts.filter((c) => c.status === "en_retard");
  const taux_retard_pourcentage = pContracts.length > 0
    ? Math.round((lateContracts.length / pContracts.length) * 1000) / 10
    : 0;

  const totalOps = pContracts.length + pSales.length;
  const panier_moyen_centimes = totalOps > 0 ? Math.round(ca_total_centimes / totalOps) : 0;

  // Caisse
  let total_reglements_centimes = 0;
  let nbTransactions = 0;
  const modesMap: Record<string, { total: number; count: number }> = {
    especes: { total: 0, count: 0 },
    carte_bancaire: { total: 0, count: 0 },
    cheque: { total: 0, count: 0 },
    virement: { total: 0, count: 0 },
  };

  pContracts.forEach((c) => {
    if (c.paid_amount_cents > 0) {
      const m = c.payment_method || "especes";
      if (!modesMap[m]) modesMap[m] = { total: 0, count: 0 };
      modesMap[m].total += c.paid_amount_cents;
      modesMap[m].count += 1;
      total_reglements_centimes += c.paid_amount_cents;
      nbTransactions += 1;
    }
  });

  pSales.forEach((s) => {
    const m = s.payment.method || "especes";
    if (!modesMap[m]) modesMap[m] = { total: 0, count: 0 };
    modesMap[m].total += s.total_amount_cents;
    modesMap[m].count += 1;
    total_reglements_centimes += s.total_amount_cents;
    nbTransactions += 1;
  });

  const labels: Record<string, string> = {
    especes: "Espèces",
    carte_bancaire: "Carte Bancaire",
    cheque: "Chèque",
    virement: "Virement",
  };

  const reglements_par_mode = Object.keys(modesMap).map((k) => ({
    moyen: k,
    label: labels[k] || k,
    montant_centimes: modesMap[k].total,
    nb_transactions: modesMap[k].count,
  }));

  // Stock
  let nombre_articles_total = 0;
  let pieces_en_location = 0;
  let pieces_en_pressing = 0;
  let valeur_totale_stock_centimes = 0;

  articles.forEach((art) => {
    art.variants.forEach((v) => {
      nombre_articles_total++;
      if (v.status === "en_location") pieces_en_location++;
      if (v.status === "au_pressing") pieces_en_pressing++;
      valeur_totale_stock_centimes += art.deposit_price_cents || art.rental_price_cents * 3 || 0;
    });
  });

  const periodDispatches = dispatches.filter((d) => isInPeriod(d.date_envoi) && d.statut !== "annule");
  const cout_pressing_centimes = periodDispatches.reduce((acc, d) => acc + (d.cout_centimes || 0), 0);

  return {
    periode: period,
    date_debut: dateFrom || todayStr,
    date_fin: dateTo || todayStr,
    financier: {
      ca_total_centimes,
      ca_locations_centimes,
      ca_ventes_centimes,
      nombre_contrats: pContracts.length,
      nombre_ventes: pSales.length,
      taux_retard_pourcentage,
      panier_moyen_centimes,
    },
    caisse: {
      total_reglements_centimes,
      reglements_par_mode,
      nombre_transactions: nbTransactions,
    },
    stock: {
      valeur_totale_stock_centimes,
      nombre_articles_total,
      pieces_en_location,
      pieces_en_pressing,
      cout_pressing_centimes,
    },
  };
}

// ─── 2. Moteur d'export réel (CSV & PDF) ──────────────────────────────────────

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  // \uFEFF garantit la détection UTF-8 dans Excel
  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFinancialReportCsv(
  overview: RapportsOverviewDto,
  transactions: FinancialTransactionRowDto[] = []
): void {
  const filename = `rapport_financier_${overview.periode}_${overview.date_debut}_au_${overview.date_fin}.csv`;
  const headers = [
    "Référence",
    "Type Opération",
    "Client",
    "Moyen Paiement",
    "Montant (DA)",
    "Date Opération",
    "Opérateur",
  ];

  const rows = transactions.map((t) => [
    `"${t.reference}"`,
    `"${t.type_operation}"`,
    `"${t.client_nom}"`,
    `"${t.moyen_paiement}"`,
    t.montant_centimes,
    `"${t.date_operation}"`,
    `"${t.operateur_nom}"`,
  ]);

  // Ajout lignes récapitulatives en haut
  const recap = [
    ["SYNTHESE DU RAPPORT FINANCIER", ""],
    ["Période", `${overview.periode} (${overview.date_debut} au ${overview.date_fin})`],
    ["Chiffre d'Affaires Global (DA)", overview.financier.ca_total_centimes],
    ["CA Locations (DA)", overview.financier.ca_locations_centimes],
    ["CA Ventes Directes (DA)", overview.financier.ca_ventes_centimes],
    ["Nombre de Contrats", overview.financier.nombre_contrats],
    ["Taux de Retard (%)", `${overview.financier.taux_retard_pourcentage}%`],
    ["Panier Moyen (DA)", overview.financier.panier_moyen_centimes],
    ["", ""],
    headers,
  ];

  const csvRows = [...recap.map((r) => r.join(";")), ...rows.map((r) => r.join(";"))];
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCaisseJournalCsv(
  overview: RapportsOverviewDto,
  transactions: FinancialTransactionRowDto[] = []
): void {
  const filename = `journal_caisse_${overview.periode}_${overview.date_debut}_au_${overview.date_fin}.csv`;
  const headers = [
    "Date Transaction",
    "Référence",
    "Type",
    "Client",
    "Mode de Règlement",
    "Montant (DA)",
    "Opérateur",
  ];

  const rows = transactions.map((t) => [
    `"${t.date_operation}"`,
    `"${t.reference}"`,
    `"${t.type_operation}"`,
    `"${t.client_nom}"`,
    `"${t.moyen_paiement}"`,
    t.montant_centimes,
    `"${t.operateur_nom}"`,
  ]);

  const recapModes = overview.caisse.reglements_par_mode.map((m) => [
    `Total ${m.label} (DA)`,
    m.montant_centimes,
    `(${m.nb_transactions} transactions)`,
  ]);

  const recap = [
    ["JOURNAL DE CAISSE ET REGLEMENTS", ""],
    ["Période", `${overview.periode} (${overview.date_debut} au ${overview.date_fin})`],
    ["Total Encaissé (DA)", overview.caisse.total_reglements_centimes],
    ["Nombre Total d'Encaissements", overview.caisse.nombre_transactions],
    ...recapModes,
    ["", ""],
    headers,
  ];

  const csvRows = [...recap.map((r) => r.join(";")), ...rows.map((r) => r.join(";"))];
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportStockInventoryCsv(rows: StockInventoryRowDto[]): void {
  const today = new Date().toISOString().slice(0, 10);
  const filename = `inventaire_valorisation_stock_${today}.csv`;
  const headers = [
    "Référence",
    "Nom Article",
    "Catégorie",
    "Taille",
    "Statut Stock",
    "Valeur Remplacement (DA)",
    "Coût Pressing Cumulé (DA)",
  ];

  const csvRows = rows.map((r) => [
    `"${r.reference}"`,
    `"${r.nom}"`,
    `"${r.categorie}"`,
    `"${r.taille}"`,
    `"${r.statut}"`,
    r.valeur_remplacement_centimes,
    r.cout_pressing_total_centimes,
  ]);

  downloadCsv(filename, headers, csvRows);
}

export async function exportFinancialReportPdf(
  overview: RapportsOverviewDto,
  transactions: FinancialTransactionRowDto[] = []
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const MARGIN = 40;
  let y = 800;

  // En-tête
  page.drawText("ATELIER PRESTIGE — RAPPORT FINANCIER D'ACTIVITÉ", {
    x: MARGIN,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 18;

  page.drawText(
    `Période : ${overview.periode.toUpperCase()}  |  Du ${overview.date_debut} au ${overview.date_fin}  |  Généré le ${new Date().toLocaleDateString("fr-FR")}`,
    {
      x: MARGIN,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    }
  );
  y -= 25;

  // Ligne de séparation dorée
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: 595.28 - MARGIN, y },
    thickness: 1.5,
    color: rgb(0.78, 0.65, 0.25),
  });
  y -= 25;

  // Cadre des KPI
  page.drawText("SYNTHÈSE FINANCIÈRE DE LA PÉRIODE", {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  const kpis = [
    { label: "Chiffre d'Affaires Global :", val: formatDA(overview.financier.ca_total_centimes) },
    { label: "Revenus Locations :", val: formatDA(overview.financier.ca_locations_centimes) },
    { label: "Ventes Directes Comptoir :", val: formatDA(overview.financier.ca_ventes_centimes) },
    { label: "Nombre de Contrats :", val: `${overview.financier.nombre_contrats} contrat(s)` },
    { label: "Taux de Retard :", val: `${overview.financier.taux_retard_pourcentage} %` },
    { label: "Panier Moyen :", val: formatDA(overview.financier.panier_moyen_centimes) },
  ];

  kpis.forEach((k) => {
    page.drawText(k.label, { x: MARGIN + 10, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(k.val, { x: MARGIN + 220, y, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  });

  y -= 15;
  page.drawText("RÉPARTITION DES RÈGLEMENTS DE CAISSE", {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  overview.caisse.reglements_par_mode.forEach((m) => {
    page.drawText(`${m.label} :`, { x: MARGIN + 10, y, size: 9, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(`${formatDA(m.montant_centimes)} (${m.nb_transactions} op.)`, {
      x: MARGIN + 220,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;
  });

  y -= 20;
  // Tableau des écritures récentes
  page.drawText(`ÉCRITURES COMPTABLES DE LA PÉRIODE (${transactions.length} opération(s))`, {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  // En-têtes du tableau
  page.drawText("Date", { x: MARGIN, y, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Référence", { x: MARGIN + 70, y, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Client", { x: MARGIN + 160, y, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Mode", { x: MARGIN + 310, y, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Montant", { x: MARGIN + 400, y, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: 595.28 - MARGIN, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 14;

  const displayTx = transactions.slice(0, 25);
  for (const t of displayTx) {
    if (y < 40) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
    }
    const dateStr = t.date_operation.slice(0, 10);
    const clientStr = t.client_nom.length > 22 ? t.client_nom.slice(0, 20) + "..." : t.client_nom;
    page.drawText(dateStr, { x: MARGIN, y, size: 8, font: fontRegular });
    page.drawText(t.reference, { x: MARGIN + 70, y, size: 8, font: fontRegular });
    page.drawText(clientStr, { x: MARGIN + 160, y, size: 8, font: fontRegular });
    page.drawText(t.moyen_paiement, { x: MARGIN + 310, y, size: 8, font: fontRegular });
    page.drawText(formatDA(t.montant_centimes), { x: MARGIN + 400, y, size: 8, font: fontBold });
    y -= 14;
  }

  // Pied de page
  const pageCount = pdfDoc.getPageCount();
  for (let p = 0; p < pageCount; p++) {
    const pg = pdfDoc.getPage(p);
    pg.drawText(`Page ${p + 1} / ${pageCount}  •  Document officiel certifié Atelier Prestige`, {
      x: MARGIN,
      y: 20,
      size: 7,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rapport_financier_${overview.periode}_${overview.date_debut}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
