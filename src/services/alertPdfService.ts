/**
 * Module E — Service d'export PDF pour les Alertes
 * Génère un rapport PDF des alertes (actives + acquittées) via pdf-lib.
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { AppAlert, AlertSeverity, AlertCategory } from "@/types/alert";
import { CATEGORY_LABELS } from "@/store/alertStore";
import { formatDA } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(isoString?: string): string {
  if (!isoString) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function formatCents(cents?: number): string {
  if (cents === undefined || cents === null) return "-";
  return formatDA(cents);
}

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critique: "CRITIQUE",
  avertissement: "AVERTISSEMENT",
  info: "INFO",
};

function getCategoryLabel(cat: AlertCategory): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

// ─── Palette de couleurs PDF ────────────────────────────────────────────────
const COLOR = {
  gold: rgb(0.78, 0.65, 0.25),        // #C7A640
  critique: rgb(0.86, 0.18, 0.18),     // #DC2F2F
  avertissement: rgb(0.90, 0.58, 0.05), // #E69408
  info: rgb(0.22, 0.53, 0.85),         // #3887D9
  acquittee: rgb(0.40, 0.70, 0.40),    // #66B366
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  grayLight: rgb(0.95, 0.95, 0.95),
  grayMid: rgb(0.65, 0.65, 0.65),
  grayDark: rgb(0.25, 0.25, 0.25),
};

function severityColor(s: AlertSeverity) {
  switch (s) {
    case "critique": return COLOR.critique;
    case "avertissement": return COLOR.avertissement;
    case "info": return COLOR.info;
  }
}

// ─── Générateur principal ─────────────────────────────────────────────────────
export async function generateAlertsPdf(
  alerts: AppAlert[],
  periodFrom: string,
  periodTo: string
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595;  // A4
  const PAGE_HEIGHT = 842;
  const MARGIN = 40;
  const COL_WIDTH = PAGE_WIDTH - 2 * MARGIN;

  // ─── Helpers de dessin ─────────────────────────────────────────────────────
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };

  const drawText = (
    text: string,
    opts: {
      x?: number;
      size?: number;
      font?: typeof fontRegular;
      color?: ReturnType<typeof rgb>;
      maxWidth?: number;
    } = {}
  ) => {
    const { x = MARGIN, size = 9, font = fontRegular, color = COLOR.black, maxWidth } = opts;
    let display = text;
    if (maxWidth) {
      // Tronquer si trop long
      while (display.length > 0 && font.widthOfTextAtSize(display, size) > maxWidth) {
        display = display.slice(0, -1);
      }
      if (display.length < text.length) display = display.slice(0, -3) + "...";
    }
    page.drawText(display, { x, y, size, font, color });
  };

  const drawLine = (x1: number, x2: number, thickness = 0.5, color = COLOR.grayMid) => {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  };

  // ─── En-tête (répété sur chaque page via newPage hook) ────────────────────
  const drawHeader = () => {
    // Bandeau doré supérieur
    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 50,
      width: PAGE_WIDTH,
      height: 50,
      color: rgb(0.12, 0.12, 0.16),
    });
    page.drawText("ATELIER PRESTIGE", {
      x: MARGIN,
      y: PAGE_HEIGHT - 28,
      size: 14,
      font: fontBold,
      color: COLOR.gold,
    });
    page.drawText("Costumes & Chaussures d'Événement", {
      x: MARGIN,
      y: PAGE_HEIGHT - 42,
      size: 8,
      font: fontRegular,
      color: COLOR.grayMid,
    });
    page.drawText("RAPPORT D'ALERTES", {
      x: PAGE_WIDTH - MARGIN - 130,
      y: PAGE_HEIGHT - 28,
      size: 12,
      font: fontBold,
      color: COLOR.white,
    });
    const periodLabel = `Période : ${periodFrom} → ${periodTo}`;
    page.drawText(periodLabel, {
      x: PAGE_WIDTH - MARGIN - 130,
      y: PAGE_HEIGHT - 42,
      size: 7,
      font: fontRegular,
      color: COLOR.grayMid,
    });
    y = PAGE_HEIGHT - 70;
  };

  // ─── Statistiques récapitulatives ─────────────────────────────────────────
  const drawStats = () => {
    const active = alerts.filter((a) => a.status === "active");
    const critiques = active.filter((a) => a.severity === "critique").length;
    const avertissements = active.filter((a) => a.severity === "avertissement").length;
    const infos = active.filter((a) => a.severity === "info").length;
    const acquittees = alerts.filter((a) => a.status === "acquittee").length;

    const stats = [
      { label: "Total alertes", value: String(alerts.length), color: COLOR.grayDark },
      { label: "Critiques actives", value: String(critiques), color: COLOR.critique },
      { label: "Avertissements", value: String(avertissements), color: COLOR.avertissement },
      { label: "Infos", value: String(infos), color: COLOR.info },
      { label: "Acquittées", value: String(acquittees), color: COLOR.acquittee },
    ];

    y -= 5;
    const boxW = COL_WIDTH / stats.length - 4;
    stats.forEach((s, i) => {
      const bx = MARGIN + i * (boxW + 4);
      page.drawRectangle({ x: bx, y: y - 36, width: boxW, height: 36, color: COLOR.grayLight });
      page.drawRectangle({ x: bx, y: y - 4, width: boxW, height: 4, color: s.color });
      page.drawText(s.value, {
        x: bx + 8,
        y: y - 20,
        size: 16,
        font: fontBold,
        color: s.color,
      });
      page.drawText(s.label, {
        x: bx + 8,
        y: y - 32,
        size: 7,
        font: fontRegular,
        color: COLOR.grayDark,
      });
    });
    y -= 52;
    drawLine(MARGIN, MARGIN + COL_WIDTH);
    y -= 8;
  };

  // ─── Dessin d'une alerte individuelle ─────────────────────────────────────
  const drawAlert = (alert: AppAlert, index: number) => {
    const cardHeight = 70 + (alert.dismiss_comment ? 16 : 0);
    ensureSpace(cardHeight + 8);

    const isEven = index % 2 === 0;
    // Fond de la ligne
    page.drawRectangle({
      x: MARGIN,
      y: y - cardHeight + 8,
      width: COL_WIDTH,
      height: cardHeight,
      color: isEven ? COLOR.grayLight : COLOR.white,
    });

    // Barre latérale de sévérité
    const barColor = alert.status === "acquittee" ? COLOR.acquittee : severityColor(alert.severity);
    page.drawRectangle({ x: MARGIN, y: y - cardHeight + 8, width: 4, height: cardHeight, color: barColor });

    // Badge sévérité
    const sevLabel = alert.status === "acquittee" ? "ACQUITTÉE" : SEVERITY_LABELS[alert.severity];
    const sevBadgeW = fontBold.widthOfTextAtSize(sevLabel, 7) + 8;
    page.drawRectangle({ x: MARGIN + 10, y: y - 14, width: sevBadgeW, height: 12, color: barColor });
    page.drawText(sevLabel, { x: MARGIN + 14, y: y - 11, size: 7, font: fontBold, color: COLOR.white });

    // Catégorie
    page.drawText(getCategoryLabel(alert.category), {
      x: MARGIN + 10 + sevBadgeW + 6,
      y: y - 11,
      size: 7,
      font: fontRegular,
      color: COLOR.grayDark,
    });

    // Date création
    const dateLabel = `Créée le ${formatDate(alert.created_at)}`;
    page.drawText(dateLabel, {
      x: PAGE_WIDTH - MARGIN - fontRegular.widthOfTextAtSize(dateLabel, 7),
      y: y - 11,
      size: 7,
      font: fontRegular,
      color: COLOR.grayMid,
    });

    // Titre
    y -= 20;
    drawText(alert.title, { size: 10, font: fontBold, maxWidth: COL_WIDTH - 20, x: MARGIN + 10 });

    // Description
    y -= 14;
    drawText(alert.description, { size: 8, color: COLOR.grayDark, maxWidth: COL_WIDTH - 20, x: MARGIN + 10 });

    // Détails contextuels
    y -= 13;
    const details: string[] = [];
    if (alert.customer_name) details.push(`Client : ${alert.customer_name}`);
    if (alert.customer_phone) details.push(`📞 ${alert.customer_phone}`);
    if (alert.contract_number) details.push(`Contrat : ${alert.contract_number}`);
    if (alert.days_overdue !== undefined && alert.days_overdue > 0)
      details.push(`Retard : ${alert.days_overdue}j`);
    if (alert.late_fee_cents) details.push(`Pénalité : ${formatCents(alert.late_fee_cents)}`);
    if (alert.article_name) details.push(`Article : ${alert.article_name}`);
    if (alert.variant_size) details.push(`Taille : ${alert.variant_size}`);
    if (alert.current_stock !== undefined)
      details.push(`Stock dispo : ${alert.current_stock}`);
    if (alert.days_since_last_rental !== undefined)
      details.push(`Inactif depuis : ${alert.days_since_last_rental}j`);

    const detailStr = details.join("  •  ");
    drawText(detailStr, { size: 7.5, color: COLOR.grayDark, maxWidth: COL_WIDTH - 20, x: MARGIN + 10 });

    // Acquittement
    if (alert.dismiss_comment) {
      y -= 13;
      const dismissStr = `✓ Acquittée par ${alert.dismissed_by ?? "?"} le ${formatDate(alert.dismissed_at)} — "${alert.dismiss_comment}"`;
      drawText(dismissStr, { size: 7, color: COLOR.acquittee, maxWidth: COL_WIDTH - 20, x: MARGIN + 10 });
    }

    y -= 16;
  };

  // ─── Construction du document ──────────────────────────────────────────────
  drawHeader();
  drawStats();

  // Titre section alertes actives
  const active = alerts.filter((a) => a.status === "active");
  const dismissed = alerts.filter((a) => a.status === "acquittee");

  if (active.length > 0) {
    ensureSpace(30);
    y -= 5;
    page.drawText(`Alertes actives (${active.length})`, {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: COLOR.black,
    });
    y -= 16;
    drawLine(MARGIN, MARGIN + COL_WIDTH, 1, COLOR.gold);
    y -= 4;
    active.forEach((a, i) => drawAlert(a, i));
  }

  if (dismissed.length > 0) {
    ensureSpace(40);
    y -= 12;
    page.drawText(`Alertes acquittées (${dismissed.length})`, {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: COLOR.grayDark,
    });
    y -= 16;
    drawLine(MARGIN, MARGIN + COL_WIDTH, 1, COLOR.acquittee);
    y -= 4;
    dismissed.forEach((a, i) => drawAlert(a, i));
  }

  // Pied de page sur toutes les pages
  const pageCount = pdfDoc.getPageCount();
  for (let p = 0; p < pageCount; p++) {
    const pg = pdfDoc.getPage(p);
    pg.drawText(`Page ${p + 1} / ${pageCount}  •  Généré le ${formatDate(new Date().toISOString())}  •  Atelier Prestige`, {
      x: MARGIN,
      y: 20,
      size: 7,
      font: fontRegular,
      color: COLOR.grayMid,
    });
  }

  // ─── Export et téléchargement ─────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const today = new Date().toISOString().slice(0, 10);
  const filename = `ALERTES-${today}.pdf`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
