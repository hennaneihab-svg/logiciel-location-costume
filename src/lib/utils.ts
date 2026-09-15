import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant en Dinars Algériens (DA)
 * Stocké en ENTIER DA.
 * Ex: 1500 -> "1 500 DA"
 */
export function formatDA(montant: number | string): string {
  const val = typeof montant === "string" ? parseFloat(montant) : montant;
  if (isNaN(val) || val === null || val === undefined) return "0 DA";
  const entier = Math.round(val);
  // Formatage avec espace insécable ou espace classique comme séparateur de milliers
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(entier).replace(/\u202F/g, " ");
  return `${formatted} DA`;
}

/**
 * Alias de compatibilité pour le code existant : tous les montants sont maintenant en DA
 */
export function formatCents(centsOrDA: number): string {
  return formatDA(centsOrDA);
}

/**
 * Convertit une chaîne ou un nombre en entier DA
 */
export function parseDA(amount: number | string): number {
  if (typeof amount === "number") return Math.round(amount);
  const clean = amount.replace(/[^0-9.-]+/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num);
}

/**
 * Ancien helper eurosToCents maintenu pour compatibilité en retournant un entier DA
 */
export function eurosToCents(amount: number | string): number {
  return parseDA(amount);
}

/**
 * Formate une date ISO 8601 en format français lisible
 */
export function formatDate(isoString: string): string {
  if (!isoString) return "-";
  const d = new Date(isoString);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Calcule le nombre de jours de location entre deux dates (arrondi au jour entier supérieur, minimum 1 jour)
 */
export function calculateRentalDays(pickupDate: string, returnDate: string): number {
  if (!pickupDate || !returnDate) return 1;
  const d1 = new Date(pickupDate).getTime();
  const d2 = new Date(returnDate).getTime();
  if (isNaN(d1) || isNaN(d2)) return 1;
  const diffDays = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}
