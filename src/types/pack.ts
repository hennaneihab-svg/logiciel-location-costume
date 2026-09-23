export interface PackItem {
  id: string;
  pack_id: string;
  categorie_id: string;
  article_id?: string;
  quantite: number;
  obligatoire: number;
}

export interface Pack {
  id: string;
  nom: string;
  cible: "homme" | "femme" | "mixte";
  prix_forfait_centimes?: number;
  est_actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackWithItems {
  pack: Pack;
  items: PackItem[];
}

export interface PackItemChoice {
  pack_item_id: string;
  article_id?: string;
  variante_id?: string;
  quantite?: number;
}

export interface ReservePackInput {
  pack_id: string;
  choices: PackItemChoice[];
}

/** Résultat de la sélection d'un pack — chaque slot du pack génère une ReservedLine */
export interface ReservedLine {
  pack_item_id: string;
  pack_id: string;           // ID du pack parent (pour la traçabilité)
  article_id: string;
  article_nom: string;
  variante_id?: string;
  quantite: number;
  mode_gestion: "variante" | "quantite";
}

/**
 * Format transmis à createRentalContract pour les lignes issues de packs.
 * Correspond exactement à PackLineItemDto côté Rust.
 */
export interface PackLineInput {
  pack_id: string;
  variante_id?: string;
  article_id?: string;
  quantite: number;
}

