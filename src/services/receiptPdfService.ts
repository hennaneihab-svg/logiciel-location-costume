import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatCents } from "@/lib/utils";
import type { DirectSale, ClotureCaisse, CaisseTransactionItem } from "@/types/caisse";

export interface GeneratedPdfReceiptResult {
  pdfBytes: Uint8Array;
  blobUrl: string;
  fileName: string;
  download: () => void;
  print: () => void;
}

/**
 * Génère un Ticket de Caisse simple et élégant au format 80mm
 */
export async function generateReceiptPdf(
  sale: DirectSale
): Promise<GeneratedPdfReceiptResult> {
  const pdfDoc = await PDFDocument.create();

  // Dimensions d'un ticket de caisse standard 80mm (largeur 226 pt, hauteur dynamique ou 500 pt)
  const pageWidth = 226.77; // ~80mm
  // Hauteur adaptée au nombre d'articles
  const baseHeight = 360;
  const itemHeight = 22;
  const pageHeight = Math.max(480, baseHeight + sale.items.length * itemHeight);

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const darkColor = rgb(0.1, 0.1, 0.12);
  const grayColor = rgb(0.4, 0.42, 0.45);
  const lightGrayColor = rgb(0.85, 0.85, 0.88);
  const goldColor = rgb(0.75, 0.58, 0.15);

  let y = pageHeight - 25;

  // Helper centrage texte
  const drawCenteredText = (
    text: string,
    fontSize: number,
    font = fontRegular,
    color = darkColor
  ) => {
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: Math.max(10, (pageWidth - textWidth) / 2),
      y,
      size: fontSize,
      font,
      color,
    });
    y -= fontSize + 4;
  };

  // 1. En-tête Boutique
  drawCenteredText("ATELIER PRESTIGE", 14, fontBold, goldColor);
  drawCenteredText("Location & Vente de Prestige", 8, fontRegular, darkColor);
  drawCenteredText("12 Boulevard Mohamed V, 16000 Alger", 7, fontRegular, grayColor);
  drawCenteredText("Tél : 021 63 45 78", 7, fontRegular, grayColor);
  drawCenteredText("NIF : 001916010023456", 6.5, fontRegular, grayColor);

  y -= 4;
  // Ligne de séparation
  page.drawLine({
    start: { x: 15, y },
    end: { x: pageWidth - 15, y },
    thickness: 0.8,
    color: lightGrayColor,
  });
  y -= 10;

  // 2. Métadonnées Ticket
  const dateObj = new Date(sale.created_at);
  const dateFormatted = dateObj.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  page.drawText(`TICKET N° : ${sale.sale_number}`, {
    x: 15,
    y,
    size: 7.5,
    font: fontBold,
    color: darkColor,
  });
  y -= 11;

  page.drawText(`Date : ${dateFormatted}`, {
    x: 15,
    y,
    size: 7,
    font: fontRegular,
    color: grayColor,
  });
  y -= 10;

  page.drawText(`Vendeur : ${sale.user_name}`, {
    x: 15,
    y,
    size: 7,
    font: fontRegular,
    color: grayColor,
  });
  y -= 10;

  page.drawText(`Client : ${sale.customer_name}`, {
    x: 15,
    y,
    size: 7,
    font: fontRegular,
    color: grayColor,
  });
  y -= 10;

  // Ligne pointillée
  page.drawLine({
    start: { x: 15, y },
    end: { x: pageWidth - 15, y },
    thickness: 0.5,
    color: lightGrayColor,
  });
  y -= 12;

  // 3. En-tête Colonnes Articles
  page.drawText("Article", { x: 15, y, size: 7, font: fontBold, color: darkColor });
  page.drawText("Qté", { x: 125, y, size: 7, font: fontBold, color: darkColor });
  page.drawText("P.U.", { x: 150, y, size: 7, font: fontBold, color: darkColor });
  page.drawText("Total", { x: 185, y, size: 7, font: fontBold, color: darkColor });
  y -= 8;

  page.drawLine({
    start: { x: 15, y },
    end: { x: pageWidth - 15, y },
    thickness: 0.5,
    color: lightGrayColor,
  });
  y -= 10;

  // 4. Lignes d'articles
  for (const item of sale.items) {
    const itemName = item.name.length > 20 ? item.name.substring(0, 19) + "…" : item.name;
    page.drawText(itemName, {
      x: 15,
      y,
      size: 6.8,
      font: fontRegular,
      color: darkColor,
    });
    page.drawText(`${item.quantity}`, {
      x: 130,
      y,
      size: 6.8,
      font: fontRegular,
      color: darkColor,
    });
    page.drawText(formatCents(item.unit_price_cents), {
      x: 148,
      y,
      size: 6.5,
      font: fontRegular,
      color: grayColor,
    });
    page.drawText(formatCents(item.subtotal_cents), {
      x: 180,
      y,
      size: 6.8,
      font: fontBold,
      color: darkColor,
    });
    y -= 12;
  }

  y -= 4;
  page.drawLine({
    start: { x: 15, y },
    end: { x: pageWidth - 15, y },
    thickness: 0.8,
    color: darkColor,
  });
  y -= 12;

  // 5. Totaux Financiers
  const totalHtCents = Math.round(sale.total_amount_cents / (1 + sale.tax_rate));
  const tvaCents = sale.total_amount_cents - totalHtCents;

  const drawRow = (label: string, value: string, isBold = false, fontSize = 7.5) => {
    page.drawText(label, {
      x: 15,
      y,
      size: fontSize,
      font: isBold ? fontBold : fontRegular,
      color: isBold ? darkColor : grayColor,
    });
    const valWidth = (isBold ? fontBold : fontRegular).widthOfTextAtSize(value, fontSize);
    page.drawText(value, {
      x: pageWidth - 15 - valWidth,
      y,
      size: fontSize,
      font: isBold ? fontBold : fontRegular,
      color: darkColor,
    });
    y -= fontSize + 4;
  };

  drawRow("Total HT :", formatCents(totalHtCents));
  drawRow(`TVA (${(sale.tax_rate * 100).toFixed(0)}%) :`, formatCents(tvaCents));
  y -= 2;
  drawRow("TOTAL TTC :", formatCents(sale.total_amount_cents), true, 10);
  y -= 6;

  page.drawLine({
    start: { x: 15, y },
    end: { x: pageWidth - 15, y },
    thickness: 0.5,
    color: lightGrayColor,
  });
  y -= 10;

  // 6. Détail Paiement
  const methodLabels: Record<string, string> = {
    especes: "Espèces",
    carte_bancaire: "Carte Bancaire",
    cheque: "Chèque",
    virement: "Virement",
    autre: "Autre",
  };

  drawRow("Règlement :", methodLabels[sale.payment.method] || sale.payment.method, true, 7.5);

  if (sale.payment.method === "especes") {
    if (sale.payment.cash_received_cents !== undefined) {
      drawRow("Montant remis :", formatCents(sale.payment.cash_received_cents));
    }
    if (sale.payment.change_returned_cents !== undefined) {
      drawRow("Monnaie rendue :", formatCents(sale.payment.change_returned_cents), true);
    }
  } else if (sale.payment.method === "carte_bancaire") {
    const ref = sale.payment.transaction_ref || "TPE-AUTO";
    drawRow("Réf. Transaction :", ref);
  } else if (sale.payment.method === "cheque") {
    const chequeNum = sale.payment.cheque_number || "CHQ-COMPTOIR";
    drawRow("N° Chèque :", chequeNum);
  }

  y -= 10;
  // 7. Bas de page / Mentions Légales
  drawCenteredText("Merci de votre confiance !", 8, fontBold, darkColor);
  drawCenteredText("Conservez ce ticket pour vos garanties.", 6.5, fontRegular, grayColor);
  drawCenteredText("Articles neufs ni repris ni échangés sans preuve.", 6, fontOblique, grayColor);
  drawCenteredText("www.atelierprestige.fr", 6.5, fontRegular, goldColor);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const fileName = `TICKET-${sale.sale_number}.pdf`;

  return {
    pdfBytes,
    blobUrl,
    fileName,
    download: () => {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    print: () => {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };
    },
  };
}

/**
 * Génère le Ticket Z / Rapport de Clôture de Caisse Journalière au format A4
 */
export async function generateCloturePdf(
  cloture: ClotureCaisse,
  transactions: CaisseTransactionItem[]
): Promise<GeneratedPdfReceiptResult> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const goldColor = rgb(0.83, 0.68, 0.21);
  const darkColor = rgb(0.08, 0.1, 0.13);
  const grayColor = rgb(0.45, 0.48, 0.53);
  const lightBgColor = rgb(0.96, 0.97, 0.98);
  const borderColor = rgb(0.85, 0.87, 0.9);
  const emeraldColor = rgb(0.1, 0.6, 0.3);
  const redColor = rgb(0.85, 0.2, 0.2);

  let y = height - 40;

  // En-tête
  page.drawRectangle({
    x: 35,
    y: y - 55,
    width: width - 70,
    height: 65,
    color: lightBgColor,
    borderColor: goldColor,
    borderWidth: 1,
  });

  page.drawText("RAPPORT JOURNALIER DE CLÔTURE DE CAISSE (TICKET Z)", {
    x: 50,
    y: y - 18,
    size: 13,
    font: fontBold,
    color: goldColor,
  });

  page.drawText(`Atelier Prestige — 12 Boulevard Mohamed V, 16000 Alger • NIF : 001916010023456`, {
    x: 50,
    y: y - 32,
    size: 8,
    font: fontRegular,
    color: darkColor,
  });

  page.drawText(
    `N° Clôture : ${cloture.cloture_number}   |   Date : ${cloture.date}   |   Clôturé le : ${new Date(
      cloture.closed_at
    ).toLocaleTimeString("fr-FR")} par ${cloture.closed_by_user_name} (${cloture.closed_by_role})`,
    {
      x: 50,
      y: y - 46,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    }
  );

  y -= 75;

  // 1. Synthèse Chiffre d'Affaires Global
  page.drawText("1. SYNTHÈSE DES ENCAISSEMENTS DU JOUR", {
    x: 35,
    y,
    size: 10,
    font: fontBold,
    color: darkColor,
  });
  y -= 16;

  // 3 boîtes récapitulatives
  const boxWidth = (width - 70 - 20) / 3;
  const drawKpiBox = (xPos: number, title: string, amount: string, subtitle: string) => {
    page.drawRectangle({
      x: xPos,
      y: y - 45,
      width: boxWidth,
      height: 45,
      color: lightBgColor,
      borderColor,
      borderWidth: 0.8,
    });
    page.drawText(title, { x: xPos + 10, y: y - 14, size: 7.5, font: fontRegular, color: grayColor });
    page.drawText(amount, { x: xPos + 10, y: y - 28, size: 11, font: fontBold, color: goldColor });
    page.drawText(subtitle, { x: xPos + 10, y: y - 40, size: 6.5, font: fontRegular, color: darkColor });
  };

  drawKpiBox(35, "Ventes Directes (Comptoir)", formatCents(cloture.sales_total_cents), "Articles & accessoires");
  drawKpiBox(35 + boxWidth + 10, "Locations Encaissées", formatCents(cloture.rentals_total_cents), "Acomptes & soldes");
  drawKpiBox(35 + (boxWidth + 10) * 2, "TOTAL ENCAISSÉ DU JOUR", formatCents(cloture.grand_total_cents), "Hors cautions en dépôt");

  y -= 60;

  // 2. Répartition par Mode de Règlement
  page.drawText("2. RÉPARTITION PAR MODE DE PAIEMENT", {
    x: 35,
    y,
    size: 10,
    font: fontBold,
    color: darkColor,
  });
  y -= 16;

  // Tableau des modes
  const tableHeaderY = y;
  page.drawRectangle({
    x: 35,
    y: tableHeaderY - 18,
    width: width - 70,
    height: 20,
    color: rgb(0.92, 0.94, 0.96),
  });

  page.drawText("Mode de Paiement", { x: 45, y: tableHeaderY - 12, size: 8, font: fontBold, color: darkColor });
  page.drawText("Nb Transactions", { x: 220, y: tableHeaderY - 12, size: 8, font: fontBold, color: darkColor });
  page.drawText("Total Encaissé", { x: 380, y: tableHeaderY - 12, size: 8, font: fontBold, color: darkColor });
  page.drawText("Part CA %", { x: 480, y: tableHeaderY - 12, size: 8, font: fontBold, color: darkColor });
  y -= 22;

  const modes = [
    { label: "Espèces (Billets & Pièces)", data: cloture.breakdown.especes },
    { label: "Carte Bancaire (TPE)", data: cloture.breakdown.carte_bancaire },
    { label: "Chèques", data: cloture.breakdown.cheque },
    { label: "Virements bancaires", data: cloture.breakdown.virement },
  ];

  for (const m of modes) {
    const pct = cloture.grand_total_cents > 0
      ? ((m.data.total_cents / cloture.grand_total_cents) * 100).toFixed(1) + "%"
      : "0.0%";

    page.drawText(m.label, { x: 45, y, size: 8, font: fontRegular, color: darkColor });
    page.drawText(`${m.data.transaction_count}`, { x: 230, y, size: 8, font: fontRegular, color: darkColor });
    page.drawText(formatCents(m.data.total_cents), { x: 380, y, size: 8, font: fontBold, color: darkColor });
    page.drawText(pct, { x: 485, y, size: 8, font: fontRegular, color: grayColor });

    y -= 4;
    page.drawLine({
      start: { x: 35, y },
      end: { x: width - 35, y },
      thickness: 0.5,
      color: borderColor,
    });
    y -= 14;
  }

  y -= 10;

  // 3. Réconciliation Tiroir-Caisse (Espèces)
  page.drawText("3. RÉCONCILIATION TIROIR-CAISSE (ESPÈCES)", {
    x: 35,
    y,
    size: 10,
    font: fontBold,
    color: darkColor,
  });
  y -= 14;

  page.drawRectangle({
    x: 35,
    y: y - 60,
    width: width - 70,
    height: 65,
    color: lightBgColor,
    borderColor,
    borderWidth: 0.8,
  });

  page.drawText(`• Fonds de caisse d'ouverture : ${formatCents(cloture.initial_cash_float_cents)}`, {
    x: 45,
    y: y - 14,
    size: 8,
    font: fontRegular,
    color: darkColor,
  });
  page.drawText(`• Espèces encaissées ce jour : ${formatCents(cloture.breakdown.especes.total_cents)}`, {
    x: 45,
    y: y - 26,
    size: 8,
    font: fontRegular,
    color: darkColor,
  });
  page.drawText(`• Total Espèces Théorique attendu : ${formatCents(cloture.theoretical_cash_cents)}`, {
    x: 45,
    y: y - 38,
    size: 8.5,
    font: fontBold,
    color: darkColor,
  });

  const isExact = cloture.discrepancy_cents === 0;
  const isPositive = cloture.discrepancy_cents > 0;
  const discrepancyColor = isExact ? emeraldColor : redColor;
  const discrepancyText = isExact
    ? "Écart : 0 DA (Caisse conforme et équilibrée)"
    : `Écart constaté : ${isPositive ? "+" : ""}${formatCents(cloture.discrepancy_cents)} (${
        isPositive ? "Excédent" : "Déficit"
      })`;

  page.drawText(`• Comptage physique réel : ${formatCents(cloture.counted_cash_cents)}`, {
    x: 300,
    y: y - 26,
    size: 8.5,
    font: fontBold,
    color: darkColor,
  });
  page.drawText(`• ${discrepancyText}`, {
    x: 300,
    y: y - 40,
    size: 8.5,
    font: fontBold,
    color: discrepancyColor,
  });

  y -= 80;

  // 4. Dernières opérations de la journée
  page.drawText(`4. JOURNAL DES OPÉRATIONS DU JOUR (${transactions.length} enregistrements)`, {
    x: 35,
    y,
    size: 10,
    font: fontBold,
    color: darkColor,
  });
  y -= 14;

  const txHeaderY = y;
  page.drawRectangle({
    x: 35,
    y: txHeaderY - 16,
    width: width - 70,
    height: 18,
    color: rgb(0.92, 0.94, 0.96),
  });

  page.drawText("Heure", { x: 40, y: txHeaderY - 11, size: 7, font: fontBold, color: darkColor });
  page.drawText("Référence", { x: 85, y: txHeaderY - 11, size: 7, font: fontBold, color: darkColor });
  page.drawText("Type", { x: 175, y: txHeaderY - 11, size: 7, font: fontBold, color: darkColor });
  page.drawText("Client", { x: 260, y: txHeaderY - 11, size: 7, font: fontBold, color: darkColor });
  page.drawText("Règlement", { x: 380, y: txHeaderY - 11, size: 7, font: fontBold, color: darkColor });
  page.drawText("Montant", { x: 480, y: txHeaderY - 11, size: 7, font: fontBold, color: darkColor });
  y -= 20;

  const displayTx = transactions.slice(0, 10);
  for (const tx of displayTx) {
    const time = new Date(tx.created_at).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const typeLabel =
      tx.type === "vente_directe"
        ? "Vente Directe"
        : tx.type === "location_acompte"
        ? "Loc. Acompte"
        : tx.type === "location_solde"
        ? "Loc. Solde"
        : "Loc. Caution";

    const methodLabel =
      tx.payment_method === "especes"
        ? "Espèces"
        : tx.payment_method === "carte_bancaire"
        ? "Carte Bancaire"
        : tx.payment_method === "cheque"
        ? "Chèque"
        : "Virement";

    page.drawText(time, { x: 40, y, size: 7, font: fontRegular, color: grayColor });
    page.drawText(tx.reference_number, { x: 85, y, size: 7, font: fontBold, color: darkColor });
    page.drawText(typeLabel, { x: 175, y, size: 7, font: fontRegular, color: darkColor });
    page.drawText(tx.client_name.substring(0, 20), { x: 260, y, size: 7, font: fontRegular, color: darkColor });
    page.drawText(methodLabel, { x: 380, y, size: 7, font: fontRegular, color: grayColor });
    page.drawText(formatCents(tx.amount_cents), { x: 480, y, size: 7, font: fontBold, color: darkColor });

    y -= 13;
  }

  // 5. Visa et Signature de validation
  y = 80;
  page.drawRectangle({
    x: 35,
    y: y - 40,
    width: width - 70,
    height: 50,
    color: rgb(0.98, 0.98, 0.99),
    borderColor,
    borderWidth: 0.8,
  });

  page.drawText(`Visa & Signature du Responsable : ${cloture.closed_by_user_name} (${cloture.closed_by_role})`, {
    x: 45,
    y: y - 12,
    size: 8,
    font: fontBold,
    color: darkColor,
  });
  page.drawText(
    `Document certifié conforme et scellé électroniquement le ${new Date(cloture.closed_at).toLocaleString("fr-FR")}`,
    { x: 45, y: y - 26, size: 7, font: fontOblique, color: grayColor }
  );

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const fileName = `CLOTURE-${cloture.cloture_number}.pdf`;

  return {
    pdfBytes,
    blobUrl,
    fileName,
    download: () => {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    print: () => {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      };
    },
  };
}
