/**
 * activityCategories.ts — Catégories et Tailles dynamiques selon le type d'activité de la boutique
 * Atelier Prestige : Supporte les boutiques Homme (Costumes), Femme (Robes/Caftans) et Mixtes.
 */

export interface ActivityCategory {
  id: string;
  label: string;
  type: "costume" | "chaussure" | "accessoire";
}

export const CATEGORIES_BY_ACTIVITY: Record<"homme" | "femme" | "mixte", ActivityCategory[]> = {
  femme: [
    { id: "cat-fem-01", label: "Robes de Soirée & Gala", type: "costume" },
    { id: "cat-fem-02", label: "Robes de Mariée & Cérémonie", type: "costume" },
    { id: "cat-fem-03", label: "Caftans & Karakous", type: "costume" },
    { id: "cat-fem-04", label: "Chaussures & Escarpins", type: "chaussure" },
    { id: "cat-fem-05", label: "Accessoires & Pochettes", type: "accessoire" },
  ],
  homme: [
    { id: "cat-01", label: "Smokings Cérémonie", type: "costume" },
    { id: "cat-02", label: "Costumes 3 Pièces", type: "costume" },
    { id: "cat-03", label: "Costumes 2 Pièces", type: "costume" },
    { id: "cat-04", label: "Chaussures Richelieu & Derbies", type: "chaussure" },
    { id: "cat-06", label: "Accessoires Prestige", type: "accessoire" },
  ],
  mixte: [
    { id: "cat-01", label: "Costumes & Smokings", type: "costume" },
    { id: "cat-fem-01", label: "Robes de Soirée & Mariée", type: "costume" },
    { id: "cat-fem-03", label: "Tenues Traditionnelles", type: "costume" },
    { id: "cat-04", label: "Chaussures Cérémonie", type: "chaussure" },
    { id: "cat-06", label: "Accessoires d'Apparat", type: "accessoire" },
  ],
};

export const SIZES_BY_ACTIVITY: Record<"homme" | "femme" | "mixte", string[]> = {
  femme: ["all", "34", "36", "38", "40", "42", "44", "TU"],
  homme: ["all", "46", "48", "50", "52", "54", "56", "TU"],
  mixte: ["all", "36", "38", "40", "42", "48", "50", "52", "TU"],
};

export function getCategoriesForActivity(activity: string = "homme"): ActivityCategory[] {
  const key = (activity.toLowerCase() as "homme" | "femme" | "mixte") || "homme";
  return CATEGORIES_BY_ACTIVITY[key] || CATEGORIES_BY_ACTIVITY.homme;
}

export function getSizesForActivity(activity: string = "homme"): string[] {
  const key = (activity.toLowerCase() as "homme" | "femme" | "mixte") || "homme";
  return SIZES_BY_ACTIVITY[key] || SIZES_BY_ACTIVITY.homme;
}
