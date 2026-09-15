import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatCents, calculateRentalDays } from "@/lib/utils";
import type { RentalContract } from "@/types/rental";

export interface GeneratedPdfResult {
  pdfBytes: Uint8Array;
  blobUrl: string;
  archivedPath: string;
  fileName: string;
  download: () => void;
  print: () => void;
}

export async function generateRentalContractPdf(
  contract: RentalContract
): Promise<GeneratedPdfResult> {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Couleurs de la charte Prestige
  const goldColor = rgb(0.83, 0.68, 0.21); // #D4AF37
  const darkColor = rgb(0.08, 0.1, 0.13); // #141A21
  const grayColor = rgb(0.45, 0.48, 0.53);
  const lightBgColor = rgb(0.96, 0.97, 0.98);
  const borderLineColor = rgb(0.85, 0.87, 0.9);
  const redAlertColor = rgb(0.85, 0.2, 0.2);

  // Fonction de génération d'une page complète (Page 1 = Boutique, Page 2 = Client)
  const drawContractPage = (pageTitleBadge: string) => {
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
    const { width, height } = page.getSize();
    let y = height - 40;

    // 1. En-tête Boutique & Badge Exemplaire
    page.drawRectangle({
      x: 30,
      y: y - 55,
      width: width - 60,
      height: 65,
      color: lightBgColor,
      borderColor: goldColor,
      borderWidth: 1,
    });

    // Titre Boutique
    page.drawText("ATELIER PRESTIGE", {
      x: 45,
      y: y - 16,
      size: 16,
      font: fontBold,
      color: goldColor,
    });

    page.drawText("Costumes d'Exception, Smokings Cérémonie & Chaussures de Luxe", {
      x: 45,
      y: y - 30,
      size: 8.5,
      font: fontRegular,
      color: darkColor,
    });

    page.drawText("12 Boulevard Mohamed V, 16000 Alger • Tél: 021 63 45 78 • contact@atelierprestige.dz • NIF 001916010023456", {
      x: 45,
      y: y - 44,
      size: 7.5,
      font: fontRegular,
      color: grayColor,
    });

    // Badge Exemplaire (Page 1 = Boutique, Page 2 = Client)
    const badgeWidth = 150;
    page.drawRectangle({
      x: width - 30 - badgeWidth - 15,
      y: y - 48,
      width: badgeWidth,
      height: 30,
      color: pageTitleBadge.includes("BOUTIQUE") ? darkColor : goldColor,
      borderColor: goldColor,
      borderWidth: 1,
    });

    page.drawText(pageTitleBadge, {
      x: width - 30 - badgeWidth - 5,
      y: y - 35,
      size: 10,
      font: fontBold,
      color: pageTitleBadge.includes("BOUTIQUE") ? rgb(1, 1, 1) : darkColor,
    });

    y -= 80;

    // 2. Ligne N° Contrat & Date
    page.drawText(`BON DE LOCATION : ${contract.contract_number}`, {
      x: 30,
      y,
      size: 13,
      font: fontBold,
      color: darkColor,
    });

    const nowFormatted = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    page.drawText(`Émis le : ${nowFormatted}  |  Statut : ${contract.status.toUpperCase()}`, {
      x: width - 230,
      y: y + 2,
      size: 9,
      font: fontBold,
      color: contract.status === "en_retard" ? redAlertColor : grayColor,
    });

    y -= 15;
    page.drawLine({
      start: { x: 30, y },
      end: { x: width - 30, y },
      thickness: 1,
      color: borderLineColor,
    });

    y -= 15;

    // 3. Deux Blocs : Client (Gauche) & Période / Événement (Droite)
    const colW = (width - 70) / 2;

    // Bloc Client (Gauche)
    page.drawRectangle({
      x: 30,
      y: y - 85,
      width: colW,
      height: 90,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: borderLineColor,
      borderWidth: 1,
    });

    page.drawText("LOCATAIRE / CLIENT :", {
      x: 40,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: goldColor,
    });

    page.drawText(contract.customer_name, {
      x: 40,
      y: y - 24,
      size: 10,
      font: fontBold,
      color: darkColor,
    });

    page.drawText(`Téléphone : ${contract.customer_phone}`, {
      x: 40,
      y: y - 38,
      size: 8.5,
      font: fontRegular,
      color: darkColor,
    });

    page.drawText(`Adresse : ${contract.customer_address || "Non précisée"}`, {
      x: 40,
      y: y - 51,
      size: 8.5,
      font: fontRegular,
      color: darkColor,
    });

    page.drawText(`Garantie CNI/Passeport : ${contract.customer_cni || "Vérifiée au comptoir"}`, {
      x: 40,
      y: y - 65,
      size: 8.5,
      font: fontItalic,
      color: grayColor,
    });

    // Bloc Période & Événement (Droite)
    page.drawRectangle({
      x: 30 + colW + 10,
      y: y - 85,
      width: colW,
      height: 90,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: borderLineColor,
      borderWidth: 1,
    });

    page.drawText("PÉRIODE DE MISE À DISPOSITION :", {
      x: 40 + colW + 10,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: goldColor,
    });

    page.drawText(`Retrait convenu : ${contract.pickup_date}`, {
      x: 40 + colW + 10,
      y: y - 25,
      size: 9,
      font: fontBold,
      color: darkColor,
    });

    const durationDays = calculateRentalDays(contract.pickup_date, contract.return_date_scheduled);

    page.drawText(`Restitution impérative : ${contract.return_date_scheduled} (${durationDays} jour${durationDays > 1 ? "s" : ""})`, {
      x: 40 + colW + 10,
      y: y - 40,
      size: 9,
      font: fontBold,
      color: darkColor,
    });

    page.drawText(`Date de l'événement : ${contract.event_date || "Cérémonie formelle"}`, {
      x: 40 + colW + 10,
      y: y - 55,
      size: 8.5,
      font: fontRegular,
      color: grayColor,
    });

    page.drawText("Pressing de fin de contrat : Pris en charge par la boutique", {
      x: 40 + colW + 10,
      y: y - 70,
      size: 8,
      font: fontItalic,
      color: grayColor,
    });

    y -= 105;

    // 4. Tableau des Pièces Louées
    page.drawText("DÉTAIL DES ARTICLES LOUÉS ET NUMÉROS D'ÉTIQUETTES :", {
      x: 30,
      y,
      size: 9,
      font: fontBold,
      color: darkColor,
    });

    y -= 18;

    // Entête du tableau
    page.drawRectangle({
      x: 30,
      y: y - 5,
      width: width - 60,
      height: 18,
      color: darkColor,
    });

    page.drawText("Article / Modèle", { x: 38, y: y, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Taille / Coupe", { x: 230, y: y, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Code-Barre Unitaire", { x: 310, y: y, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Tarif Loc. TTC", { x: 425, y: y, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText("Caution Réf.", { x: 500, y: y, size: 8, font: fontBold, color: rgb(1, 1, 1) });

    y -= 18;

    // Lignes des articles
    contract.items.forEach((item, idx) => {
      const isEven = idx % 2 === 0;
      page.drawRectangle({
        x: 30,
        y: y - 4,
        width: width - 60,
        height: 18,
        color: isEven ? rgb(1, 1, 1) : lightBgColor,
        borderColor: borderLineColor,
        borderWidth: 0.5,
      });

      const nameTruncated = item.article_name.length > 34 ? item.article_name.substring(0, 32) + "..." : item.article_name;
      page.drawText(nameTruncated, { x: 38, y: y + 1, size: 8, font: fontBold, color: darkColor });
      page.drawText(`T.${item.size} (${item.sub_size || "Std"})`, { x: 230, y: y + 1, size: 8, font: fontRegular, color: darkColor });
      page.drawText(item.barcode, { x: 310, y: y + 1, size: 7.5, font: fontRegular, color: grayColor });
      page.drawText(formatCents(item.unit_price_cents), { x: 425, y: y + 1, size: 8, font: fontBold, color: darkColor });
      page.drawText(formatCents(item.deposit_cents), { x: 500, y: y + 1, size: 8, font: fontRegular, color: grayColor });

      y -= 18;
    });

    y -= 10;

    // 5. Récapitulatif Financier & Caution (Cadre Droit)
    const recapW = 240;
    const recapX = width - 30 - recapW;
    const recapH = 110;

    page.drawRectangle({
      x: recapX,
      y: y - recapH + 10,
      width: recapW,
      height: recapH,
      color: lightBgColor,
      borderColor: goldColor,
      borderWidth: 1,
    });

    let ry = y - 3;
    page.drawText(`Sous-total articles (${durationDays} j.) :`, { x: recapX + 12, y: ry, size: 8, font: fontRegular, color: grayColor });
    page.drawText(formatCents(contract.total_rental_cents), { x: recapX + recapW - 70, y: ry, size: 8, font: fontRegular, color: darkColor });

    ry -= 14;
    page.drawText("Frais de nettoyage inclus :", { x: recapX + 12, y: ry, size: 8, font: fontRegular, color: grayColor });
    page.drawText(formatCents(contract.cleaning_fee_cents), { x: recapX + recapW - 70, y: ry, size: 8, font: fontRegular, color: darkColor });

    if (contract.discount_cents > 0) {
      ry -= 14;
      page.drawText("Remise commerciale :", { x: recapX + 12, y: ry, size: 8, font: fontBold, color: redAlertColor });
      page.drawText(`- ${formatCents(contract.discount_cents)}`, { x: recapX + recapW - 70, y: ry, size: 8, font: fontBold, color: redAlertColor });
    }

    ry -= 14;
    page.drawLine({ start: { x: recapX + 10, y: ry + 5 }, end: { x: recapX + recapW - 10, y: ry + 5 }, thickness: 0.5, color: goldColor });
    page.drawText("TOTAL FACTURÉ TTC :", { x: recapX + 12, y: ry - 4, size: 9, font: fontBold, color: darkColor });
    page.drawText(formatCents(contract.total_amount_cents), { x: recapX + recapW - 75, y: ry - 4, size: 9, font: fontBold, color: goldColor });

    ry -= 18;
    page.drawText(`Caution exigée (${contract.deposit_method}) :`, { x: recapX + 12, y: ry, size: 8, font: fontBold, color: darkColor });
    page.drawText(formatCents(contract.deposit_amount_cents), { x: recapX + recapW - 70, y: ry, size: 8, font: fontBold, color: darkColor });

    ry -= 14;
    page.drawText(`Déjà réglé (${contract.payment_method}) :`, { x: recapX + 12, y: ry, size: 8, font: fontRegular, color: rgb(0.1, 0.6, 0.3) });
    page.drawText(formatCents(contract.paid_amount_cents), { x: recapX + recapW - 70, y: ry, size: 8, font: fontBold, color: rgb(0.1, 0.6, 0.3) });

    ry -= 14;
    page.drawText("RESTE DÛ À LA RESTITUTION :", { x: recapX + 12, y: ry, size: 8.5, font: fontBold, color: contract.remaining_amount_cents > 0 ? redAlertColor : rgb(0.1, 0.6, 0.3) });
    page.drawText(formatCents(contract.remaining_amount_cents), { x: recapX + recapW - 70, y: ry, size: 8.5, font: fontBold, color: contract.remaining_amount_cents > 0 ? redAlertColor : rgb(0.1, 0.6, 0.3) });

    // Notes & Conditions à gauche du récapitulatif
    const leftNotesW = width - 60 - recapW - 15;
    page.drawRectangle({
      x: 30,
      y: y - recapH + 10,
      width: leftNotesW,
      height: recapH,
      color: rgb(0.99, 0.99, 1),
      borderColor: borderLineColor,
      borderWidth: 0.5,
    });

    page.drawText("CONDITIONS GÉNÉRALES & RÈGLEMENTATION :", { x: 38, y: y - 5, size: 7.5, font: fontBold, color: goldColor });
    page.drawText("• Restitution impérative avant l'heure de fermeture le jour prévu.", { x: 38, y: y - 20, size: 7, font: fontRegular, color: darkColor });
    page.drawText("• Pénalité de retard contractuelle : 2 000 DA par jour calendaire entamé.", { x: 38, y: y - 32, size: 7, font: fontRegular, color: darkColor });
    page.drawText("• Le pressing d'usage est inclus. Ne jamais tenter de détacher le costume soi-même.", { x: 38, y: y - 44, size: 7, font: fontRegular, color: darkColor });
    page.drawText("• En cas de brûlure de cigarette, déchirure ou perte, retenue totale ou partielle", { x: 38, y: y - 56, size: 7, font: fontRegular, color: darkColor });
    page.drawText("  de la caution selon le barème atelier.", { x: 38, y: y - 66, size: 7, font: fontRegular, color: darkColor });
    page.drawText("• La caution est restituée immédiatement après vérification contradictoire.", { x: 38, y: y - 78, size: 7, font: fontItalic, color: grayColor });

    y -= (recapH + 15);

    // 6. Zones d'Émargement et de Signature
    const sigW = (width - 70) / 2;

    // Signature Client
    page.drawRectangle({
      x: 30,
      y: y - 75,
      width: sigW,
      height: 80,
      color: rgb(1, 1, 1),
      borderColor: borderLineColor,
      borderWidth: 1,
    });

    page.drawText("Pour le Client :", { x: 40, y: y - 8, size: 8, font: fontBold, color: darkColor });
    page.drawText("Mention manuscrite 'Lu et approuvé, bon pour accord' :", { x: 40, y: y - 20, size: 7, font: fontItalic, color: grayColor });
    page.drawText("Date et signature :", { x: 40, y: y - 68, size: 7.5, font: fontRegular, color: grayColor });

    // Signature Boutique
    page.drawRectangle({
      x: 30 + sigW + 10,
      y: y - 75,
      width: sigW,
      height: 80,
      color: rgb(1, 1, 1),
      borderColor: borderLineColor,
      borderWidth: 1,
    });

    page.drawText("Pour l'Atelier Prestige :", { x: 40 + sigW + 10, y: y - 8, size: 8, font: fontBold, color: darkColor });
    page.drawText("Signature du conseiller et cachet boutique :", { x: 40 + sigW + 10, y: y - 20, size: 7, font: fontItalic, color: grayColor });
    page.drawText("Signature & Cachet :", { x: 40 + sigW + 10, y: y - 68, size: 7.5, font: fontRegular, color: grayColor });

    // Pied de page
    page.drawText(`Atelier Prestige SARL - R.C.S. Paris B 849 201 938 - Document légal contractuel à conserver. Page générée automatiquement.`, {
      x: 45,
      y: 18,
      size: 6.5,
      font: fontRegular,
      color: grayColor,
    });
  };

  // Page 1 : EXEMPLAIRE BOUTIQUE
  drawContractPage("EXEMPLAIRE BOUTIQUE");

  // Page 2 : EXEMPLAIRE CLIENT
  drawContractPage("EXEMPLAIRE CLIENT");

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  // Archivage automatique structuré dans /bons/AAAA-MM/BON-{numero}.pdf
  const dateObj = new Date();
  const yearMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
  const fileName = `BON-${contract.contract_number}.pdf`;
  const archivedPath = `/bons/${yearMonth}/${fileName}`;

  return {
    pdfBytes,
    blobUrl,
    archivedPath,
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
