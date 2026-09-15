/**
 * Templates de messages WhatsApp pour Atelier Prestige.
 * Textes soignés, polis et personnalisés. Facilement configurables et modifiables.
 */

export const WHATSAPP_TEMPLATES = {
  RAPPEL_RETOUR: (clientNom: string, articleNom: string, dateRetour: string, retardJours?: number): string => {
    const salutation = `Bonjour ${clientNom || "Cher client"},`;
    let corps = "";

    if (retardJours && retardJours > 0) {
      corps = `Nous constatons que la location de votre tenue "${articleNom}" était prévue pour retour le ${dateRetour} (retard de ${retardJours} jour${retardJours > 1 ? "s" : ""}).\nMerci de bien vouloir nous contacter ou vous présenter en boutique pour régulariser la restitution.`;
    } else {
      corps = `Nous vous rappelons que la restitution de votre tenue "${articleNom}" est prévue pour le ${dateRetour}.\nNous vous attendons en boutique pour la vérification et la clôture de votre contrat.`;
    }

    return `${salutation}\n\n${corps}\n\nPour toute question, nous restons à votre entière disposition.\n\nCordialement,\nL'équipe Atelier Prestige ✨`;
  },

  CONFIRMATION_RESERVATION: (clientNom: string, articleNom: string, dateRetrait: string, dateRetour?: string): string => {
    const salutation = `Bonjour ${clientNom || "Cher client"},`;
    const retourInfo = dateRetour ? `\n- Date de retour prévue : ${dateRetour}` : "";
    const corps = `Votre réservation pour "${articleNom}" a bien été enregistrée chez Atelier Prestige.\n\nRécapitulatif :\n- Retrait prévu : ${dateRetrait}${retourInfo}\n\nNous préparons soigneusement votre tenue pour la date convenue. N'hésitez pas à nous contacter si vous avez la moindre modification à apporter.`;

    return `${salutation}\n\n${corps}\n\nÀ très bientôt en boutique !\n\nCordialement,\nL'équipe Atelier Prestige ✨`;
  },

  CONTACT_LIBRE: (clientNom?: string): string => {
    if (!clientNom) return "";
    return `Bonjour ${clientNom}, nous prenons contact avec vous depuis la boutique Atelier Prestige.`;
  },
};

/**
 * Construit un message de rappel de retour
 */
export function buildRappelRetourMessage(
  clientNom: string,
  articleNom: string,
  dateRetour: string,
  retardJours?: number
): string {
  return WHATSAPP_TEMPLATES.RAPPEL_RETOUR(clientNom, articleNom, dateRetour, retardJours);
}

/**
 * Construit un message de confirmation de réservation
 */
export function buildConfirmationReservationMessage(
  clientNom: string,
  articleNom: string,
  dateRetrait: string,
  dateRetour?: string
): string {
  return WHATSAPP_TEMPLATES.CONFIRMATION_RESERVATION(clientNom, articleNom, dateRetrait, dateRetour);
}
