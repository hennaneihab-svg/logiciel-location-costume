export type SlotNature = "location" | "pressing" | "retard" | "essayage";

export interface EssaiCabineDetailDto {
  id: string;
  numero_essai: string;
  variante_id: string;
  article_id: string;
  article_nom: string;
  article_reference: string;
  taille: string;
  client_id: string | null;
  client_nom: string | null;
  date_debut: string;
  date_fin_prevue: string;
  date_fin_effective: string | null;
  statut: "en_cours" | "termine" | "annule";
  resultat: "convient" | "retouche_necessaire" | "refuse" | null;
  pressing_envoi_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateEssaiCabineDto {
  variante_id: string;
  client_id?: string | null;
  client_nom_libre?: string | null;
  date_debut?: string | null;
  date_fin_prevue?: string | null;
  notes?: string | null;
  utilisateur_id?: string | null;
}

export interface FinishEssaiCabineDto {
  essai_id: string;
  resultat: "convient" | "retouche_necessaire" | "refuse";
  notes?: string | null;
  envoyer_retouche?: boolean | null;
  retouche_motif?: string | null;
  retouche_prestataire_id?: string | null;
  retouche_date_retour_prevue?: string | null;
  retouche_cout_centimes?: number | null;
}

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
}

export interface RescheduleRentalLineDto {
  location_id: string;
  current_variant_id: string;
  target_variant_id: string;
  new_pickup_date: string;
  new_return_date: string;
}

export interface RescheduleRentalResult {
  success: boolean;
  location_id: string;
  numero_location: string;
  current_variant_id: string;
  target_variant_id: string;
  new_pickup_date: string;
  new_return_date: string;
  message: string;
}

export interface PendingRescheduleProposal {
  slot: AvailabilitySlot;
  sourceRow: VariantAvailabilityMatrixRow;
  targetRow: VariantAvailabilityMatrixRow;
  newStartDate: string;
  newEndDate: string;
  durationDays: number;
}
