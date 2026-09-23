export type SlotNature = "location" | "pressing" | "retard";

export interface AvailabilitySlot {
  date_debut: string; // Format YYYY-MM-DD
  date_fin: string;   // Format YYYY-MM-DD
  nature: SlotNature;
  reference_id: string | null;
  reference_code: string | null;
  description: string;
  client_nom: string | null;
}

export interface VariantAvailabilityMatrixRow {
  variante_id: string;
  article_id: string;
  article_nom: string;
  reference: string;
  taille: string;
  sous_taille: string | null;
  statut_actuel: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilityValidationResult {
  disponible: boolean;
  motif_refus: string | null;
  conflit_nature: SlotNature | null;
  conflit_reference: string | null;
  tampon_pressing_jours: number;
}
