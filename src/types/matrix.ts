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
