import { create } from "zustand";
import type { PackWithItems, ReservePackInput, ReservedLine } from "@/types/pack";
import { invokeCommand, isTauri } from "@/services/tauri";
import { toast } from "sonner";

export const INITIAL_PACKS: PackWithItems[] = [
  {
    pack: {
      id: "pack-marie-01",
      nom: "Pack Marié Prestige Cérémonie",
      cible: "homme",
      prix_forfait_centimes: 28000,
      est_actif: true,
      created_at: "2026-09-17T10:00:00.000Z",
      updated_at: "2026-09-17T10:00:00.000Z",
    },
    items: [
      { id: "pitem-001", pack_id: "pack-marie-01", categorie_id: "cat-01", article_id: undefined, quantite: 1, obligatoire: 1 },
      { id: "pitem-002", pack_id: "pack-marie-01", categorie_id: "cat-04", article_id: undefined, quantite: 1, obligatoire: 1 },
      { id: "pitem-003", pack_id: "pack-marie-01", categorie_id: "cat-06", article_id: "art-018", quantite: 1, obligatoire: 1 },
      { id: "pitem-004", pack_id: "pack-marie-01", categorie_id: "cat-06", article_id: "art-019", quantite: 1, obligatoire: 1 },
    ],
  },
  {
    pack: {
      id: "pack-cocktail-02",
      nom: "Pack Soirée Cocktail & Gala",
      cible: "homme",
      prix_forfait_centimes: 22000,
      est_actif: true,
      created_at: "2026-09-17T10:00:00.000Z",
      updated_at: "2026-09-17T10:00:00.000Z",
    },
    items: [
      { id: "pitem-005", pack_id: "pack-cocktail-02", categorie_id: "cat-01", article_id: undefined, quantite: 1, obligatoire: 1 },
      { id: "pitem-006", pack_id: "pack-cocktail-02", categorie_id: "cat-06", article_id: "art-018", quantite: 1, obligatoire: 1 },
    ],
  },
];

interface PackStoreState {
  packs: PackWithItems[];
  selectedPack: PackWithItems | null;
  isLoading: boolean;
  isModalOpen: boolean;

  // Actions
  fetchPacks: () => Promise<void>;
  setSelectedPack: (pack: PackWithItems | null) => void;
  setModalOpen: (open: boolean) => void;
  reservePack: (input: ReservePackInput) => Promise<ReservedLine[]>;
}

export const usePackStore = create<PackStoreState>((set, get) => ({
  packs: INITIAL_PACKS,
  selectedPack: null,
  isLoading: false,
  isModalOpen: false,

  fetchPacks: async () => {
    set({ isLoading: true });
    try {
      if (isTauri()) {
        const nativePacks = await invokeCommand<PackWithItems[]>("list_packs");
        if (nativePacks && nativePacks.length > 0) {
          set({ packs: nativePacks });
        }
      }
    } catch (err) {
      console.warn("[packStore] Erreur récupération packs natifs, conservation état local :", err);
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedPack: (pack) => set({ selectedPack: pack }),
  setModalOpen: (open) => set({ isModalOpen: open }),

  reservePack: async (input: ReservePackInput) => {
    // 1. Validation de présence
    const pack = get().packs.find((p) => p.pack.id === input.pack_id);
    if (!pack) {
      throw new Error(`Pack introuvable : ${input.pack_id}`);
    }

    // 2. Appel IPC transactionnel
    try {
      const reservedLines = await invokeCommand<ReservedLine[]>("reserve_pack", {
        dto: input,
      });

      toast.success(`Pack "${pack.pack.nom}" réservé avec succès ! (${reservedLines.length} articles alloués)`);
      return reservedLines;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      toast.error(`Échec de réservation du pack : ${errorMsg}`);
      throw err;
    }
  },
}));
