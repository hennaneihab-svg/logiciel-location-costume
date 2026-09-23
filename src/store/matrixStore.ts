import { create } from "zustand";
import { invokeCommand, isTauri } from "@/services/tauri";
import type {
  VariantAvailabilityMatrixRow,
} from "@/types/matrix";

// Mock représentatif pour tests et environnement dev hors-Tauri
export const MOCK_MATRIX_ROWS: VariantAvailabilityMatrixRow[] = [
  {
    variante_id: "var-001",
    article_id: "art-001",
    article_nom: "Smoking Col Châle Soie Noir",
    reference: "SMK-NOIR-01",
    taille: "48",
    sous_taille: "Drop 7",
    statut_actuel: "disponible",
    slots: [
      {
        date_debut: "2026-09-18",
        date_fin: "2026-09-22",
        nature: "location",
        reference_id: "loc-001",
        reference_code: "LOC-2026-0001",
        description: "Contrat de location LOC-2026-0001",
        client_nom: "Alexandre De La Tour",
      },
      {
        date_debut: "2026-09-22",
        date_fin: "2026-09-25",
        nature: "pressing",
        reference_id: "loc-001",
        reference_code: "TAMPON-LOC-2026-0001",
        description: "Tampon pressing automatique après restitution",
        client_nom: "Alexandre De La Tour",
      },
    ],
  },
  {
    variante_id: "var-002",
    article_id: "art-001",
    article_nom: "Smoking Col Châle Soie Noir",
    reference: "SMK-NOIR-01",
    taille: "50",
    sous_taille: "Drop 7",
    statut_actuel: "en_location",
    slots: [
      {
        date_debut: "2026-09-10",
        date_fin: "2026-09-14",
        nature: "retard",
        reference_id: "loc-002",
        reference_code: "LOC-2026-0002",
        description: "Retard de restitution constaté - restitution attendue dépassée",
        client_nom: "Jean-Pierre Laurent",
      },
    ],
  },
  {
    variante_id: "var-006",
    article_id: "art-006",
    article_nom: "Costume 3P Prince de Galles",
    reference: "CST-3P-GRIS",
    taille: "52",
    sous_taille: "Drop 8",
    statut_actuel: "en_retard",
    slots: [
      {
        date_debut: "2026-09-14",
        date_fin: "2026-09-16",
        nature: "retard",
        reference_id: "loc-002",
        reference_code: "LOC-2026-0002",
        description: "Retard de restitution constaté - restitution attendue dépassée",
        client_nom: "Jean-Pierre Laurent",
      },
    ],
  },
  {
    variante_id: "var-004",
    article_id: "art-002",
    article_nom: "Smoking Midnight Blue Col Pointe",
    reference: "SMK-BLEU-02",
    taille: "50",
    sous_taille: "Standard",
    statut_actuel: "disponible",
    slots: [
      {
        date_debut: "2026-09-25",
        date_fin: "2026-09-29",
        nature: "location",
        reference_id: "loc-004",
        reference_code: "LOC-2026-0004",
        description: "Contrat de location LOC-2026-0004",
        client_nom: "Édouard Philippe",
      },
      {
        date_debut: "2026-09-29",
        date_fin: "2026-10-02",
        nature: "pressing",
        reference_id: "loc-004",
        reference_code: "TAMPON-LOC-2026-0004",
        description: "Tampon pressing automatique après restitution",
        client_nom: "Édouard Philippe",
      },
    ],
  },
  {
    variante_id: "var-007",
    article_id: "art-004",
    article_nom: "Smoking Velours Vert Émeraude",
    reference: "SMK-VERT-04",
    taille: "50",
    sous_taille: "Standard",
    statut_actuel: "au_pressing",
    slots: [
      {
        date_debut: "2026-09-13",
        date_fin: "2026-09-17",
        nature: "pressing",
        reference_id: "env-001",
        reference_code: "PRS-2026-0001",
        description: "Envoi pressing physique en cours - Pressing Elysée",
        client_nom: null,
      },
    ],
  },
];

// Formate une date en YYYY-MM-DD
export function formatDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Ajoute N jours à une date
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface MatrixStoreState {
  startDate: string; // YYYY-MM-DD
  daysCount: number; // Toujours 30 par défaut
  rows: VariantAvailabilityMatrixRow[];
  isLoading: boolean;
  error: string | null;

  // Filtres
  searchQuery: string;
  selectedArticleId: string | null;
  selectedCategory: string | null;

  // Pagination des variantes
  page: number;
  pageSize: number;

  // Fiche contrat sélectionnée
  selectedContractId: string | null;
  selectedContractCode: string | null;

  // Actions
  loadMatrix: (startDate?: string) => Promise<void>;
  setStartDate: (date: string) => void;
  shiftDays: (delta: number) => void;
  resetToToday: () => void;
  setSearchQuery: (query: string) => void;
  setSelectedArticleId: (articleId: string | null) => void;
  setSelectedCategory: (category: string | null) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSelectedContract: (contractId: string | null, code?: string | null) => void;
}

export const useMatrixStore = create<MatrixStoreState>((set, get) => ({
  startDate: "2026-09-14", // Date par défaut alignée sur le contexte applicatif
  daysCount: 30,
  rows: [],
  isLoading: false,
  error: null,

  searchQuery: "",
  selectedArticleId: null,
  selectedCategory: null,

  page: 1,
  pageSize: 20,

  selectedContractId: null,
  selectedContractCode: null,

  loadMatrix: async (targetStartDate?: string) => {
    const state = get();
    const startIso = targetStartDate || state.startDate;
    const startDateObj = parseIsoDate(startIso);
    const endDateObj = addDays(startDateObj, state.daysCount - 1);
    const endIso = formatDateToIso(endDateObj);

    set({ isLoading: true, error: null, startDate: startIso });

    try {
      if (isTauri()) {
        const articleIds = state.selectedArticleId ? [state.selectedArticleId] : undefined;
        const res = await invokeCommand<VariantAvailabilityMatrixRow[]>("get_availability_matrix", {
          dateDebut: startIso,
          dateFin: endIso,
          articleIds,
        });
        set({ rows: res || [], isLoading: false });
      } else {
        // Environnement mock / test
        set({ rows: MOCK_MATRIX_ROWS, isLoading: false });
      }
    } catch (err: any) {
      console.warn("[matrixStore] Échec IPC get_availability_matrix, bascule sur mock :", err);
      set({
        rows: MOCK_MATRIX_ROWS,
        isLoading: false,
        error: err?.message || "Erreur de chargement de la matrice",
      });
    }
  },

  setStartDate: (date: string) => {
    set({ startDate: date });
    get().loadMatrix(date);
  },

  shiftDays: (delta: number) => {
    const current = parseIsoDate(get().startDate);
    const shifted = addDays(current, delta);
    const newStart = formatDateToIso(shifted);
    get().setStartDate(newStart);
  },

  resetToToday: () => {
    const now = new Date();
    // En environnement de démonstration 2026, si nous sommes en 2026 nous utilisons today, sinon '2026-09-14'
    const todayIso = formatDateToIso(now);
    const defaultDate = todayIso.startsWith("2026") ? todayIso : "2026-09-14";
    get().setStartDate(defaultDate);
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, page: 1 });
  },

  setSelectedArticleId: (articleId: string | null) => {
    set({ selectedArticleId: articleId, page: 1 });
    get().loadMatrix();
  },

  setSelectedCategory: (category: string | null) => {
    set({ selectedCategory: category, page: 1 });
  },

  setPage: (page: number) => {
    set({ page });
  },

  setPageSize: (pageSize: number) => {
    set({ pageSize, page: 1 });
  },

  setSelectedContract: (contractId: string | null, code?: string | null) => {
    set({ selectedContractId: contractId, selectedContractCode: code || null });
  },
}));
