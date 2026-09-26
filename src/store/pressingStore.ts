import { create } from "zustand";
import { invokeCommand, isTauri } from "@/services/tauri";
import { toast } from "sonner";
import type {
  PressingProvider,
  PressingDispatch,
  CreatePressingProviderInput,
  UpdatePressingProviderInput,
  CreatePressingDispatchInput,
  CreatePressingDispatchResult,
  SkippedPressingItem,
} from "@/types/pressing";
import { useAuthStore } from "./authStore";
import { useStockStore } from "./stockStore";
import { logger } from "@/lib/logger";

interface PressingStoreState {
  providers: PressingProvider[];
  dispatches: PressingDispatch[];
  isModuleActive: boolean;
  isLoading: boolean;

  // Actions Module
  loadModuleActive: () => Promise<boolean>;
  setModuleActive: (active: boolean) => Promise<void>;

  // Actions Prestataires
  loadProviders: (onlyActive?: boolean) => Promise<void>;
  createProvider: (input: CreatePressingProviderInput) => Promise<PressingProvider>;
  updateProvider: (input: UpdatePressingProviderInput) => Promise<PressingProvider>;
  deactivateProvider: (id: string) => Promise<void>;
  reactivateProvider: (id: string) => Promise<void>;

  // Actions Envois
  loadDispatches: (filters?: {
    statut?: string;
    prestataire_id?: string;
    variante_id?: string;
    date_debut?: string;
    date_fin?: string;
  }) => Promise<void>;
  createDispatch: (input: CreatePressingDispatchInput) => Promise<CreatePressingDispatchResult>;
  receiveDispatch: (envoiId: string, dateRetourEffective?: string, notes?: string) => Promise<void>;
  markProblem: (envoiId: string, notes?: string) => Promise<void>;
  cancelDispatch: (envoiId: string) => Promise<void>;
  payProvider: (envoiId: string, datePaiement?: string) => Promise<void>;
  getVariantHistory: (varianteId: string) => Promise<PressingDispatch[]>;

  // Actions Photos
  setDispatchPhoto: (envoiId: string, dataBase64: string, thumbBase64: string, mime?: string) => Promise<void>;
  getDispatchPhotoThumb: (envoiId: string) => Promise<string | null>;
  getDispatchPhotoFull: (envoiId: string) => Promise<string | null>;
}

export const usePressingStore = create<PressingStoreState>((set, get) => ({
  providers: [],
  dispatches: [],
  isModuleActive: true,
  isLoading: false,

  loadModuleActive: async () => {
    if (isTauri()) {
      try {
        const active = await invokeCommand<boolean>("get_pressing_module_active");
        set({ isModuleActive: active });
        return active;
      } catch (err) {
        logger.error("pressingStore: Erreur chargement statut module pressing", err);
      }
    }
    return get().isModuleActive;
  },

  setModuleActive: async (active: boolean) => {
    if (isTauri()) {
      try {
        await invokeCommand("set_pressing_module_active", { actif: active });
      } catch (err) {
        logger.error("pressingStore: Erreur sauvegarde statut module pressing", err);
        toast.error("Impossible de modifier l'état du module pressing.");
        return;
      }
    }
    set({ isModuleActive: active });
    toast.success(active ? "Module Pressing activé." : "Module Pressing désactivé.");
  },

  loadProviders: async (onlyActive = false) => {
    set({ isLoading: true });
    try {
      if (isTauri()) {
        const list = await invokeCommand<PressingProvider[]>("list_pressing_providers", {
          onlyActive: onlyActive ? true : null,
        });
        set({ providers: list });
      }
    } catch (err) {
      logger.error("pressingStore: Erreur chargement prestataires", err);
      toast.error("Impossible de charger les prestataires de pressing.");
    } finally {
      set({ isLoading: false });
    }
  },

  createProvider: async (input) => {
    set({ isLoading: true });
    try {
      if (isTauri()) {
        const provider = await invokeCommand<PressingProvider>("create_pressing_provider", {
          dto: input,
        });
        set((state) => ({ providers: [provider, ...state.providers] }));
        toast.success(`Prestataire "${provider.nom}" ajouté.`);
        return provider;
      } else {
        const mock: PressingProvider = {
          id: `prs-prv-${Date.now()}`,
          nom: input.nom,
          contact_nom: input.contact_nom,
          telephone: input.telephone,
          adresse: input.adresse,
          tarif_defaut_centimes: input.tarif_defaut_centimes,
          delai_defaut_jours: input.delai_defaut_jours || 3,
          actif: true,
          notes: input.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({ providers: [mock, ...state.providers] }));
        return mock;
      }
    } catch (err: any) {
      logger.error("pressingStore: Erreur création prestataire", err);
      toast.error(err.message || "Erreur lors de la création du prestataire.");
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateProvider: async (input) => {
    set({ isLoading: true });
    try {
      if (isTauri()) {
        const updated = await invokeCommand<PressingProvider>("update_pressing_provider", {
          dto: input,
        });
        set((state) => ({
          providers: state.providers.map((p) => (p.id === updated.id ? updated : p)),
        }));
        toast.success(`Prestataire "${updated.nom}" mis à jour.`);
        return updated;
      } else {
        const updated: PressingProvider = {
          ...input,
          actif: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({
          providers: state.providers.map((p) => (p.id === input.id ? updated : p)),
        }));
        return updated;
      }
    } catch (err: any) {
      logger.error("pressingStore: Erreur modification prestataire", err);
      toast.error(err.message || "Erreur lors de la modification du prestataire.");
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  deactivateProvider: async (id) => {
    try {
      if (isTauri()) {
        await invokeCommand("deactivate_pressing_provider", { id });
      }
      set((state) => ({
        providers: state.providers.map((p) => (p.id === id ? { ...p, actif: false } : p)),
      }));
      toast.success("Prestataire désactivé.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la désactivation du prestataire.");
      throw err;
    }
  },

  reactivateProvider: async (id) => {
    try {
      if (isTauri()) {
        await invokeCommand("reactivate_pressing_provider", { id });
      }
      set((state) => ({
        providers: state.providers.map((p) => (p.id === id ? { ...p, actif: true } : p)),
      }));
      toast.success("Prestataire réactivé.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réactivation du prestataire.");
      throw err;
    }
  },

  loadDispatches: async (filters) => {
    set({ isLoading: true });
    try {
      if (isTauri()) {
        const list = await invokeCommand<PressingDispatch[]>("list_pressing_dispatches", {
          statut: filters?.statut || null,
          prestataireId: filters?.prestataire_id || null,
          varianteId: filters?.variante_id || null,
          dateDebut: filters?.date_debut || null,
          dateFin: filters?.date_fin || null,
        });
        set({ dispatches: list });
      }
    } catch (err) {
      logger.error("pressingStore: Erreur chargement envois pressing", err);
      toast.error("Impossible de charger les envois de pressing.");
    } finally {
      set({ isLoading: false });
    }
  },

  createDispatch: async (input) => {
    set({ isLoading: true });
    try {
      const currentUser = useAuthStore.getState().currentUser;
      const payload: CreatePressingDispatchInput = {
        ...input,
        utilisateur_id: currentUser?.id || "usr-001",
      };

      if (isTauri()) {
        const result = await invokeCommand<CreatePressingDispatchResult>("create_pressing_dispatch", {
          dto: payload,
        });
        set((state) => ({ dispatches: [...result.dispatches, ...state.dispatches] }));
        if (result.skipped.length === 0) {
          toast.success(
            result.dispatches.length > 1
              ? `${result.dispatches.length} pièces envoyées au pressing.`
              : `Pièce envoyée au pressing (${result.dispatches[0]?.numero_envoi}).`
          );
        }
        return result;
      } else {
        const activeDispatches = get().dispatches.filter(
          (d) => d.statut === "envoye" || d.statut === "en_traitement"
        );
        const skipped: SkippedPressingItem[] = [];
        const validVariantIds: string[] = [];

        for (const vId of input.variante_ids) {
          const existing = activeDispatches.find((d) => d.variante_id === vId);
          if (existing) {
            skipped.push({
              variante_id: vId,
              article_nom: existing.article_name || "Costume Mock",
              numero_envoi_actif: existing.numero_envoi,
              message: `La pièce '${existing.article_name || "Costume Mock"}' est déjà envoyée au pressing sous ${existing.numero_envoi}`,
            });
          } else {
            validVariantIds.push(vId);
          }
        }

        if (validVariantIds.length === 0 && skipped.length > 0) {
          throw new Error(skipped[0].message);
        }

        const createdMock: PressingDispatch[] = validVariantIds.map((vId, idx) => {
          const found = useStockStore
            .getState()
            .articles?.flatMap((a: any) =>
              a.variants?.map((v: any) => ({
                ...v,
                artName: a.name || a.nom,
                artRef: a.reference,
              }))
            )
            ?.find((v: any) => v.id === vId);

          const artName = found?.artName || "Costume Mock";
          const ref = found?.artRef || "CST-01";
          const size = found?.size || found?.taille || "50";

          return {
            id: `prs-${Date.now()}-${idx}`,
            numero_envoi: `PRS-2026-${String(get().dispatches.length + idx + 1).padStart(4, "0")}`,
            variante_id: vId,
            article_id: found?.article_id || "art-mock",
            article_name: artName,
            reference: ref,
            size,
            prestataire_id: input.prestataire_id || null,
            prestataire_nom: input.prestataire_id ? "Prestataire Mock" : null,
            location_id: input.location_id || null,
            numero_location: null,
            type_traitement: input.type_traitement || "nettoyage_sec",
            motif: input.motif || "usage_normal",
            cout_centimes: input.cout_centimes || 0,
            statut_paiement_prestataire: "a_payer",
            date_paiement_prestataire: null,
            date_envoi: new Date().toISOString().split("T")[0],
            date_retour_prevue: input.date_retour_prevue,
            date_retour_effective: null,
            statut: "envoye",
            notes: input.notes || null,
            utilisateur_id: currentUser?.id || "usr-001",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            has_photo: false,
          };
        });
        set((state) => ({ dispatches: [...createdMock, ...state.dispatches] }));
        if (skipped.length === 0) {
          toast.success(
            createdMock.length > 1
              ? `${createdMock.length} pièces envoyées au pressing.`
              : `Pièce envoyée au pressing (${createdMock[0]?.numero_envoi}).`
          );
        }
        return {
          dispatches: createdMock,
          skipped,
        };
      }
    } catch (err: any) {
      logger.error("pressingStore: Erreur création envoi pressing", err);
      toast.error(err.message || "Erreur lors de l'envoi au pressing.");
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  receiveDispatch: async (envoiId, dateRetourEffective, notes) => {
    try {
      if (isTauri()) {
        const updated = await invokeCommand<PressingDispatch>("receive_pressing_dispatch", {
          envoiId,
          dateRetourEffective: dateRetourEffective || null,
          notes: notes || null,
        });
        set((state) => ({
          dispatches: state.dispatches.map((d) => (d.id === envoiId ? updated : d)),
        }));
      } else {
        set((state) => ({
          dispatches: state.dispatches.map((d) =>
            d.id === envoiId
              ? {
                  ...d,
                  statut: "recu",
                  date_retour_effective: dateRetourEffective || new Date().toISOString().split("T")[0],
                  notes: notes ? `${d.notes || ""} | Réception: ${notes}` : d.notes,
                }
              : d
          ),
        }));
      }
      toast.success("Pièce réceptionnée du pressing avec succès. Statut stock actualisé.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réception de l'envoi.");
      throw err;
    }
  },

  markProblem: async (envoiId, notes) => {
    try {
      if (isTauri()) {
        const updated = await invokeCommand<PressingDispatch>("mark_pressing_problem", {
          envoiId,
          notes: notes || null,
        });
        set((state) => ({
          dispatches: state.dispatches.map((d) => (d.id === envoiId ? updated : d)),
        }));
      } else {
        set((state) => ({
          dispatches: state.dispatches.map((d) =>
            d.id === envoiId
              ? {
                  ...d,
                  statut: "probleme",
                  notes: notes ? `${d.notes || ""} | PROBLÈME: ${notes}` : d.notes,
                }
              : d
          ),
        }));
      }
      toast.warning("Problème signalé. La pièce est marquée indisponible en stock.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du signalement du problème.");
      throw err;
    }
  },

  cancelDispatch: async (envoiId) => {
    try {
      if (isTauri()) {
        const updated = await invokeCommand<PressingDispatch>("cancel_pressing_dispatch", {
          envoiId,
        });
        set((state) => ({
          dispatches: state.dispatches.map((d) => (d.id === envoiId ? updated : d)),
        }));
      } else {
        set((state) => ({
          dispatches: state.dispatches.map((d) =>
            d.id === envoiId ? { ...d, statut: "annule" } : d
          ),
        }));
      }
      toast.success("Envoi pressing annulé. Pièce libérée.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation de l'envoi.");
      throw err;
    }
  },

  payProvider: async (envoiId, datePaiement) => {
    try {
      if (isTauri()) {
        const updated = await invokeCommand<PressingDispatch>("pay_pressing_provider", {
          envoiId,
          datePaiement: datePaiement || null,
        });
        set((state) => ({
          dispatches: state.dispatches.map((d) => (d.id === envoiId ? updated : d)),
        }));
      } else {
        set((state) => ({
          dispatches: state.dispatches.map((d) =>
            d.id === envoiId
              ? {
                  ...d,
                  statut_paiement_prestataire: "paye",
                  date_paiement_prestataire: datePaiement || new Date().toISOString().split("T")[0],
                }
              : d
          ),
        }));
      }
      toast.success("Règlement prestataire enregistré.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'enregistrement du paiement.");
      throw err;
    }
  },

  getVariantHistory: async (varianteId) => {
    if (isTauri()) {
      try {
        return await invokeCommand<PressingDispatch[]>("get_pressing_history_for_variant", {
          varianteId,
        });
      } catch (err) {
        logger.error("pressingStore: Erreur historique pressing variante", err);
      }
    }
    return get().dispatches.filter((d) => d.variante_id === varianteId);
  },

  setDispatchPhoto: async (envoiId, dataBase64, thumbBase64, mime = "image/webp") => {
    if (isTauri()) {
      await invokeCommand("set_pressing_photo", {
        dto: {
          envoiId,
          mime,
          dataBase64,
          thumbBase64,
        },
      });
      set((state) => ({
        dispatches: state.dispatches.map((d) =>
          d.id === envoiId ? { ...d, has_photo: true } : d
        ),
      }));
    }
  },

  getDispatchPhotoThumb: async (envoiId) => {
    if (isTauri()) {
      return await invokeCommand<string | null>("get_pressing_photo_thumb", { envoiId });
    }
    return null;
  },

  getDispatchPhotoFull: async (envoiId) => {
    if (isTauri()) {
      return await invokeCommand<string | null>("get_pressing_photo_full", { envoiId });
    }
    return null;
  },
}));
