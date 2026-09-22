export interface PressingProvider {
  id: string;
  nom: string;
  contact_nom?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  tarif_defaut_centimes?: number | null;
  delai_defaut_jours: number;
  actif: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePressingProviderInput {
  nom: string;
  contact_nom?: string;
  telephone?: string;
  adresse?: string;
  tarif_defaut_centimes?: number;
  delai_defaut_jours?: number;
  notes?: string;
}

export interface UpdatePressingProviderInput {
  id: string;
  nom: string;
  contact_nom?: string;
  telephone?: string;
  adresse?: string;
  tarif_defaut_centimes?: number;
  delai_defaut_jours: number;
  notes?: string;
}

export type PressingStatus = "envoye" | "en_traitement" | "recu" | "probleme" | "annule";
export type PressingPaymentStatus = "a_payer" | "paye";

export interface PressingDispatch {
  id: string;
  numero_envoi: string;
  variante_id: string;
  article_id: string;
  article_name: string;
  reference: string;
  size: string;
  prestataire_id?: string | null;
  prestataire_nom?: string | null;
  location_id?: string | null;
  numero_location?: string | null;
  type_traitement?: string | null;
  motif?: string | null;
  cout_centimes: number;
  statut_paiement_prestataire: PressingPaymentStatus;
  date_paiement_prestataire?: string | null;
  date_envoi: string;
  date_retour_prevue: string;
  date_retour_effective?: string | null;
  statut: PressingStatus;
  notes?: string | null;
  utilisateur_id: string;
  created_at: string;
  updated_at: string;
  has_photo: boolean;
}

export interface CreatePressingDispatchInput {
  variante_ids: string[];
  prestataire_id?: string;
  location_id?: string;
  type_traitement?: string;
  motif?: string;
  cout_centimes?: number;
  date_retour_prevue: string;
  force: boolean;
  notes?: string;
  utilisateur_id?: string;
}
