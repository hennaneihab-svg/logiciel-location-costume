import { create } from "zustand";
import JSZip from "jszip";
import type {
  BoutiqueSettings,
  NumberingSettings,
  TaxSettings,
  BackupEntry,
  AuditLogEntry,
  AuditActionType,
} from "@/types/settings";
import { useAuthStore } from "@/store/authStore";
import { useStockStore } from "@/store/stockStore";
import { useClientStore } from "@/store/clientStore";
import { useRentalStore } from "@/store/rentalStore";
import { useCaisseStore } from "@/store/caisseStore";
import { dbStorage } from "@/services/dbStorage";
import { invokeCommand, isTauri } from "@/services/tauri";
import { toast } from "sonner";

interface SettingsStoreState {
  boutique: BoutiqueSettings;
  numbering: NumberingSettings;
  tax: TaxSettings;
  backups: BackupEntry[];
  auditLogs: AuditLogEntry[];
  isBackingUp: boolean;

  // Actions Paramètres
  updateBoutiqueSettings: (updated: Partial<BoutiqueSettings>) => void;
  updateNumberingSettings: (updated: Partial<NumberingSettings>) => void;
  updateTaxSettings: (updated: Partial<TaxSettings>) => void;

  // Actions Sauvegardes
  createBackupNow: (triggerType?: "manual" | "auto_daily") => Promise<BackupEntry>;
  restoreBackup: (backupId: string) => Promise<void>;
  deleteBackup: (id: string) => void;

  // Actions Journal d'Audit
  logAuditEvent: (
    action: AuditActionType,
    entityTable: string,
    entityId: string,
    details: string
  ) => void;
  clearAuditLogs: () => void;
}

const INITIAL_BOUTIQUE: BoutiqueSettings = {
  name: "Atelier Prestige — Cérémonie & Événements",
  slogan: "Costumes d'Exception, Smokings Cérémonie & Chaussures de Luxe",
  address: "12 Boulevard Mohamed V",
  postal_code: "16000",
  city: "Alger",
  phone: "021 63 45 78",
  email: "contact@atelierprestige.dz",
  siret: "001916010023456",
  rcs: "16/00-0987654B19",
  website: "www.atelierprestige.dz",
  logo_url: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=200&auto=format&fit=crop&q=80",
  legal_notice: "TVA algérienne à 19% applicable selon la législation fiscale en vigueur.",
};

const INITIAL_NUMBERING: NumberingSettings = {
  rental_prefix: "LOC",
  sale_prefix: "VTE",
  quote_prefix: "DEV",
  year_format: "YYYY",
  padding_digits: 4,
};

const INITIAL_TAX: TaxSettings = {
  default_vat_rate: 0.19, // 19% TVA algérienne
  currency: "DZD",
  currency_symbol: "DA",
};

// 5 sauvegardes récentes pré-générées pour simuler l'historique
const INITIAL_BACKUPS: BackupEntry[] = [
  {
    id: "bak-20260914-1900",
    filename: "backup_prestige_2026-09-14_190000.zip",
    created_at: "2026-09-14T19:00:00.000Z",
    size_bytes: 1420580,
    trigger_type: "auto_daily",
    records_count: {
      articles: 20,
      clients: 10,
      locations: 15,
      paiements: 15,
      ventes: 2,
      pdf_count: 15,
    },
  },
  {
    id: "bak-20260913-1900",
    filename: "backup_prestige_2026-09-13_190000.zip",
    created_at: "2026-09-13T19:00:00.000Z",
    size_bytes: 1398200,
    trigger_type: "auto_daily",
    records_count: {
      articles: 20,
      clients: 10,
      locations: 14,
      paiements: 14,
      ventes: 1,
      pdf_count: 14,
    },
  },
  {
    id: "bak-20260912-1900",
    filename: "backup_prestige_2026-09-12_190000.zip",
    created_at: "2026-09-12T19:00:00.000Z",
    size_bytes: 1380120,
    trigger_type: "auto_daily",
    records_count: {
      articles: 20,
      clients: 9,
      locations: 13,
      paiements: 13,
      ventes: 1,
      pdf_count: 13,
    },
  },
  {
    id: "bak-20260911-1900",
    filename: "backup_prestige_2026-09-11_190000.zip",
    created_at: "2026-09-11T19:00:00.000Z",
    size_bytes: 1350400,
    trigger_type: "auto_daily",
    records_count: {
      articles: 20,
      clients: 9,
      locations: 12,
      paiements: 12,
      ventes: 0,
      pdf_count: 12,
    },
  },
  {
    id: "bak-20260910-1420",
    filename: "backup_prestige_2026-09-10_142000.zip",
    created_at: "2026-09-10T14:20:00.000Z",
    size_bytes: 1342000,
    trigger_type: "manual",
    records_count: {
      articles: 20,
      clients: 8,
      locations: 11,
      paiements: 11,
      ventes: 0,
      pdf_count: 11,
    },
  },
];

// Historique d'actions sensibles initiales
const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "log-001",
    user_id: "usr-001",
    user_name: "Jean-Philippe Directeur",
    user_role: "admin",
    action: "UPDATE_STATUS",
    entity_table: "locations",
    entity_id: "LOC-2026-0011",
    details: "Passage du contrat en retard (+ pénalité journalière de 2 000 DA)",
    created_at: "2026-09-14T09:30:00.000Z",
  },
  {
    id: "log-002",
    user_id: "usr-001",
    user_name: "Jean-Philippe Directeur",
    user_role: "admin",
    action: "UPDATE_PRICE",
    entity_table: "articles",
    entity_id: "art-001",
    details: "Modification prix vente SMK-NOIR-01 : passage de 85 000 DA à 89 000 DA",
    created_at: "2026-09-14T10:15:00.000Z",
  },
  {
    id: "log-003",
    user_id: "usr-002",
    user_name: "Sophie Vendeuse",
    user_role: "vendeur",
    action: "PROCESS_SALE",
    entity_table: "ventes",
    entity_id: "VTE-2026-0039",
    details: "Vente directe comptoir : Boutons de Manchette Nacre (15 000 DA en espèces)",
    created_at: "2026-09-14T11:45:00.000Z",
  },
  {
    id: "log-004",
    user_id: "usr-001",
    user_name: "Jean-Philippe Directeur",
    user_role: "admin",
    action: "DELETE_CLIENT",
    entity_table: "clients",
    entity_id: "cli-draft-09",
    details: "Suppression définitive de la fiche client en doublon sans contrat rattaché",
    created_at: "2026-09-13T16:20:00.000Z",
  },
  {
    id: "log-005",
    user_id: "usr-001",
    user_name: "Jean-Philippe Directeur",
    user_role: "admin",
    action: "CLOTURE_CAISSE",
    entity_table: "caisse",
    entity_id: "Z-20260913-01",
    details: "Clôture journalière validée avec 0 DA d'écart de caisse",
    created_at: "2026-09-13T19:05:00.000Z",
  },
  {
    id: "log-006",
    user_id: "usr-001",
    user_name: "Jean-Philippe Directeur",
    user_role: "admin",
    action: "CREATE_BACKUP",
    entity_table: "backups",
    entity_id: "bak-20260910-1420",
    details: "Sauvegarde manuelle complète de la base SQLite et des bons PDF",
    created_at: "2026-09-10T14:20:00.000Z",
  },
];

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  boutique: dbStorage.load<BoutiqueSettings>(dbStorage.KEYS.SETTINGS, INITIAL_BOUTIQUE),
  numbering: INITIAL_NUMBERING,
  tax: INITIAL_TAX,
  backups: dbStorage.load<BackupEntry[]>(dbStorage.KEYS.BACKUPS, INITIAL_BACKUPS),
  auditLogs: dbStorage.load<AuditLogEntry[]>(dbStorage.KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS),
  isBackingUp: false,

  updateBoutiqueSettings: (updated) => {
    set((state) => {
      const newBoutique = { ...state.boutique, ...updated };
      dbStorage.save(dbStorage.KEYS.SETTINGS, newBoutique);
      get().logAuditEvent(
        "UPDATE_SETTINGS",
        "parametres",
        "etablissement",
        "Mise à jour des coordonnées de l'établissement"
      );
      return { boutique: newBoutique };
    });
  },

  updateNumberingSettings: (updated) => {
    set((state) => {
      const newNum = { ...state.numbering, ...updated };
      get().logAuditEvent(
        "UPDATE_SETTINGS",
        "parametres",
        "numerotation",
        "Mise à jour du format de numérotation des bons"
      );
      return { numbering: newNum };
    });
  },

  updateTaxSettings: (updated) => {
    set((state) => {
      const newTax = { ...state.tax, ...updated };
      get().logAuditEvent(
        "UPDATE_SETTINGS",
        "parametres",
        "fiscalite",
        `Modification du taux de TVA : ${(newTax.default_vat_rate * 100).toFixed(1)}%`
      );
      return { tax: newTax };
    });
  },

  createBackupNow: async (triggerType = "manual") => {
    set({ isBackingUp: true });

    try {
      const zip = new JSZip();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `backup_prestige_${dateStr}_${timeStr}.zip`;

      // 1. Extraction des données complètes des stores
      const stockArticles = useStockStore.getState().articles;
      const clientsList = useClientStore.getState().clients;
      const rentalContracts = useRentalStore.getState().contracts;
      const directSales = useCaisseStore.getState().salesHistory;

      const databaseDump = {
        meta: {
          app: "Atelier Prestige — Location & Cérémonie",
          version: "0.1.0",
          schema_version: "0002",
          exported_at: now.toISOString(),
          trigger_type: triggerType,
        },
        boutique: get().boutique,
        articles: stockArticles,
        clients: clientsList,
        locations: rentalContracts,
        ventes: directSales,
        audit_logs: get().auditLogs,
      };

      // Fichier principal SQLite snapshot (sérialisé en JSON pour interopérabilité)
      zip.file("database_prestige.sqlite.json", JSON.stringify(databaseDump, null, 2));

      // 2. Dossier /bons avec archives des bons de location
      const bonsFolder = zip.folder("bons");
      if (bonsFolder) {
        rentalContracts.forEach((c) => {
          bonsFolder.file(
            `BON-${c.contract_number}.txt`,
            `CONTRAT DE LOCATION N° ${c.contract_number}\nClient : ${c.customer_name}\nDate Retrait : ${c.pickup_date}\nDate Retour Prévue : ${c.return_date_scheduled}\nTotal TTC : ${c.total_amount_cents.toLocaleString("fr-FR")} DA\nCaution : ${c.deposit_amount_cents.toLocaleString("fr-FR")} DA`
          );
        });
      }

      // 3. Manifeste
      zip.file(
        "manifest.json",
        JSON.stringify(
          {
            backup_id: `bak-${dateStr}-${timeStr}`,
            filename,
            created_at: now.toISOString(),
            records_count: {
              articles: stockArticles.length,
              clients: clientsList.length,
              locations: rentalContracts.length,
              paiements: rentalContracts.length,
              ventes: directSales.length,
              pdf_count: rentalContracts.length,
            },
          },
          null,
          2
        )
      );

      // Génération du binaire ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const blobUrl = URL.createObjectURL(zipBlob);

      const newEntry: BackupEntry = {
        id: `bak-${dateStr}-${timeStr}`,
        filename,
        created_at: now.toISOString(),
        size_bytes: zipBlob.size,
        trigger_type: triggerType,
        records_count: {
          articles: stockArticles.length,
          clients: clientsList.length,
          locations: rentalContracts.length,
          paiements: rentalContracts.length,
          ventes: directSales.length,
          pdf_count: rentalContracts.length,
        },
        blob_url: blobUrl,
      };

      // Règle imposée : GARDER LES 30 DERNIÈRES SAUVEGARDES (Rotation automatique)
      set((state) => {
        const updated = [newEntry, ...state.backups].slice(0, 30);
        dbStorage.save(dbStorage.KEYS.BACKUPS, updated);
        return { backups: updated, isBackingUp: false };
      });

      // Téléchargement immédiat si déclenchement manuel
      if (triggerType === "manual") {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      get().logAuditEvent(
        "CREATE_BACKUP",
        "backups",
        newEntry.id,
        `Création archive ZIP ${filename} (${(zipBlob.size / 1024).toFixed(1)} Ko)`
      );

      return newEntry;
    } catch (err) {
      set({ isBackingUp: false });
      throw err;
    }
  },

  restoreBackup: async (backupId: string) => {
    const backup = get().backups.find((b) => b.id === backupId);
    if (!backup) {
      throw new Error("Sauvegarde introuvable.");
    }

    // Étape 2.a : Valider le fichier de sauvegarde (format, intégrité) avant toute action destructive
    if (!backup.raw_data && !backup.sqlite_path) {
      throw new Error("Archive de sauvegarde invalide ou corrompue : aucune donnée exploitable trouvée.");
    }

    // Étape 2.b & 3 : Appel IPC bloquant si environnement Tauri
    if (isTauri()) {
      if (!backup.sqlite_path) {
        throw new Error(
          "Chemin de sauvegarde SQLite manquant dans cette archive. Impossible d'effectuer la restauration native."
        );
      }
      try {
        await invokeCommand("restore_database", { backupPath: backup.sqlite_path });
      } catch (err: any) {
        console.error("[settingsStore] Échec critique de restauration SQLite native :", err);
        // Étape 2.c : Arrêter immédiatement sans modifier l'UI ni le localStorage
        throw new Error(
          "Échec de la restauration de la base de données — aucune donnée n'a été modifiée. Cause : " +
            (err?.message || String(err))
        );
      }
    } else if (backup.sqlite_path && !isTauri()) {
      // Étape 3 : Hors runtime Tauri avec archive SQLite
      throw new Error(
        "Restauration SQLite indisponible hors application compilée — testez en build de production."
      );
    }

    // Étape 2.d : Réhydrater les stores Zustand/localStorage UNIQUEMENT après confirmation
    if (backup.raw_data) {
      const dump = backup.raw_data as any;
      if (dump.articles) {
        useStockStore.setState({ articles: dump.articles });
        dbStorage.save(dbStorage.KEYS.ARTICLES, dump.articles);
      }
      if (dump.clients) {
        useClientStore.setState({ clients: dump.clients });
        dbStorage.save(dbStorage.KEYS.CLIENTS, dump.clients);
      }
      if (dump.locations) {
        useRentalStore.setState({ contracts: dump.locations });
        dbStorage.save(dbStorage.KEYS.CONTRACTS, dump.locations);
      }
      if (dump.ventes) {
        useCaisseStore.setState({ salesHistory: dump.ventes });
        dbStorage.save(dbStorage.KEYS.SALES, dump.ventes);
      }
      if (dump.boutique) {
        set({ boutique: dump.boutique });
        dbStorage.save(dbStorage.KEYS.SETTINGS, dump.boutique);
      }
    }

    get().logAuditEvent(
      "UPDATE_SETTINGS",
      "backups",
      backupId,
      `Restauration complète des données depuis l'archive ${backup.filename}`
    );
    toast.success(`Restauration réussie depuis l'archive ${backup.filename}`);
  },

  deleteBackup: (id) => {
    set((state) => {
      const updated = state.backups.filter((b) => b.id !== id);
      dbStorage.save(dbStorage.KEYS.BACKUPS, updated);
      return { backups: updated };
    });
  },

  logAuditEvent: (action, entityTable, entityId, details) => {
    const authState = useAuthStore.getState();
    const currentUser = authState.currentUser;

    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: currentUser?.id || "sys-001",
      user_name: currentUser?.full_name || "Système",
      user_role: currentUser?.role || "admin",
      action,
      entity_table: entityTable,
      entity_id: entityId,
      details,
      created_at: new Date().toISOString(),
    };

    set((state) => {
      const updatedLogs = [newLog, ...state.auditLogs];
      dbStorage.save(dbStorage.KEYS.AUDIT_LOGS, updatedLogs);
      return { auditLogs: updatedLogs };
    });
  },

  clearAuditLogs: () => {
    dbStorage.save(dbStorage.KEYS.AUDIT_LOGS, []);
    set({ auditLogs: [] });
  },
}));
