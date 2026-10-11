import { create } from "zustand";
import type {
  CustomerDetailed,
  ClientSortOption,
  ClientFilterOption,
} from "@/types/customer";
import { dbStorage } from "@/services/dbStorage";
import { isTauri } from "@/services/tauri";

interface ClientStoreState {
  clients: CustomerDetailed[];
  search: string;
  sortBy: ClientSortOption;
  filter: ClientFilterOption;
  selectedClient: CustomerDetailed | null;
  targetBlacklistClient: CustomerDetailed | null;
  alertClientForRental: CustomerDetailed | null;

  // Modals state
  isCreateModalOpen: boolean;
  isDetailModalOpen: boolean;
  isBlacklistDialogOpen: boolean;
  isBlacklistAlertOpen: boolean;

  // Actions
  setSearch: (search: string) => void;
  setSortBy: (sortBy: ClientSortOption) => void;
  setFilter: (filter: ClientFilterOption) => void;
  setSelectedClient: (client: CustomerDetailed | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  setDetailModalOpen: (open: boolean) => void;
  openBlacklistDialog: (client: CustomerDetailed) => void;
  closeBlacklistDialog: () => void;
  openBlacklistAlertForRental: (client: CustomerDetailed) => void;
  closeBlacklistAlert: () => void;

  addClient: (
    newClientData: Omit<CustomerDetailed, "id" | "created_at" | "rentals"> & {
      id?: string;
    }
  ) => CustomerDetailed;
  updateClient: (id: string, updates: Partial<CustomerDetailed>) => void;
  toggleBlacklist: (
    id: string,
    isBlacklisted: boolean,
    reason?: string
  ) => { success: boolean; error?: string };
  uploadIdentityCard: (id: string, photoDataUrl: string) => void;
}

// 10 clients riches et réalistes
const INITIAL_CLIENTS: CustomerDetailed[] = [
  {
    id: "cli-001",
    first_name: "Jean",
    last_name: "Dupont",
    email: "jean.dupont@gmail.com",
    phone: "06 12 34 56 78",
    alternative_phone: "01 45 67 89 10",
    address: "14 Rue de la Paix",
    city: "Paris",
    postal_code: "75002",
    identity_card_number: "CNI-FR-220975102934",
    identity_card_photo:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80",
    notes:
      "Veste taille 50 Drop 7 / Pantalon 42 / Chemise col 41 / Pointure 43. Préfère les smokings col châle soie Lanvin.",
    is_blacklisted: false,
    created_at: "2026-06-10T14:00:00.000Z",
    rentals: [
      {
        id: "loc-013",
        contract_number: "LOC-2026-0013",
        event_date: "13/09/2026",
        pickup_date: "11/09/2026",
        return_date: "15/09/2026",
        status: "en_cours",
        articles_summary: "Costume 3P Bleu Royal Cérémonie (T.50)",
        total_amount_cents: 15000,
        deposit_amount_cents: 40000,
        deposit_status: "cheque_retenu",
        payment_status: "solde",
        notes: "En cours, retour prévu le 15/09",
        created_at: "2026-09-06T10:00:00.000Z",
      },
      {
        id: "loc-001",
        contract_number: "LOC-2026-0001",
        event_date: "20/06/2026",
        pickup_date: "18/06/2026",
        return_date: "22/06/2026",
        status: "retourne",
        articles_summary: "Smoking Col Châle Soie Noir (T.48)",
        total_amount_cents: 18000,
        deposit_amount_cents: 45000,
        deposit_status: "restituee",
        payment_status: "solde",
        notes: "Rendu en parfait état avec chèque restitué",
        created_at: "2026-06-10T14:30:00.000Z",
      },
      {
        id: "loc-old-01",
        contract_number: "LOC-2026-P01",
        event_date: "15/05/2026",
        pickup_date: "14/05/2026",
        return_date: "18/05/2026",
        status: "retourne",
        articles_summary: "Smoking Midnight Blue Lanvin (T.50) + Richelieus Santoni (43)",
        total_amount_cents: 25000,
        deposit_amount_cents: 65000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-05-02T10:00:00.000Z",
      },
      {
        id: "loc-old-02",
        contract_number: "LOC-2026-P02",
        event_date: "04/04/2026",
        pickup_date: "02/04/2026",
        return_date: "06/04/2026",
        status: "retourne",
        articles_summary: "Costume 3P Prince de Galles Scabal (T.50)",
        total_amount_cents: 16500,
        deposit_amount_cents: 42000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-03-25T11:00:00.000Z",
      },
      {
        id: "loc-old-03",
        contract_number: "LOC-2026-P03",
        event_date: "12/02/2026",
        pickup_date: "11/02/2026",
        return_date: "14/02/2026",
        status: "retourne",
        articles_summary: "Smoking Velours Vert Émeraude Hugo Boss (T.50)",
        total_amount_cents: 19500,
        deposit_amount_cents: 50000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-02-01T09:00:00.000Z",
      },
      {
        id: "loc-old-04",
        contract_number: "LOC-2025-P99",
        event_date: "31/12/2025",
        pickup_date: "30/12/2025",
        return_date: "03/01/2026",
        status: "retourne",
        articles_summary: "Smoking Col Châle Soie Noir Lanvin (T.50)",
        total_amount_cents: 18000,
        deposit_amount_cents: 45000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2025-12-15T16:00:00.000Z",
      },
    ],
  },
  {
    id: "cli-002",
    first_name: "Alexandre",
    last_name: "Mercier",
    email: "alex.mercier@orange.fr",
    phone: "07 98 76 54 32",
    address: "8 Avenue des États-Unis",
    city: "Versailles",
    postal_code: "78000",
    identity_card_number: "PASS-FR-19AB89201",
    identity_card_photo:
      "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80",
    notes:
      "Marié le 19/09/2026. Veste taille 52 Standard / Pantalon 44. Attention aux retouches d'ourlet.",
    is_blacklisted: false,
    created_at: "2026-06-15T11:00:00.000Z",
    rentals: [
      {
        id: "loc-014",
        contract_number: "LOC-2026-0014",
        event_date: "19/09/2026",
        pickup_date: "17/09/2026",
        return_date: "21/09/2026",
        status: "reserve",
        articles_summary: "Smoking Midnight Blue Col Pointe (T.52)",
        total_amount_cents: 23500,
        deposit_amount_cents: 60000,
        deposit_status: "empreinte_cb",
        payment_status: "acompte",
        notes: "Acompte versé, solde au départ",
        created_at: "2026-09-08T15:00:00.000Z",
      },
      {
        id: "loc-009",
        contract_number: "LOC-2026-0009",
        event_date: "29/08/2026",
        pickup_date: "27/08/2026",
        return_date: "31/08/2026",
        status: "retourne",
        articles_summary: "Costume 2 Pièces Anthracite Slim (T.48)",
        total_amount_cents: 12000,
        deposit_amount_cents: 30000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-08-20T09:00:00.000Z",
      },
    ],
  },
  {
    id: "cli-003",
    first_name: "Maxime",
    last_name: "Laroche",
    email: "max.laroche@outlook.com",
    phone: "06 55 44 33 22",
    alternative_phone: "06 77 88 99 00",
    address: "25 Boulevard Victor Hugo",
    city: "Neuilly-sur-Seine",
    postal_code: "92200",
    identity_card_number: "PERM-FR-8409124401",
    notes: "Témoin de mariage, taille 48 slim, chemise 40.",
    is_blacklisted: false,
    created_at: "2026-06-20T16:00:00.000Z",
    rentals: [
      {
        id: "loc-015",
        contract_number: "LOC-2026-0015",
        event_date: "21/09/2026",
        pickup_date: "19/09/2026",
        return_date: "23/09/2026",
        status: "reserve",
        articles_summary: "Smoking Velours Vert Émeraude (T.50)",
        total_amount_cents: 19500,
        deposit_amount_cents: 50000,
        deposit_status: "non_recue",
        payment_status: "acompte",
        created_at: "2026-09-10T16:00:00.000Z",
      },
      {
        id: "loc-002",
        contract_number: "LOC-2026-0002",
        event_date: "27/06/2026",
        pickup_date: "25/06/2026",
        return_date: "29/06/2026",
        status: "retourne",
        articles_summary: "Costume 3P Bleu Royal Cérémonie (T.50)",
        total_amount_cents: 15000,
        deposit_amount_cents: 40000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-06-20T16:30:00.000Z",
      },
    ],
  },
  {
    id: "cli-004",
    first_name: "Thomas",
    last_name: "Martin",
    email: "thomas.martin@sfr.fr",
    phone: "06 99 88 77 66",
    address: "3 Rue de la République",
    city: "Lyon",
    postal_code: "69002",
    identity_card_number: "CNI-FR-210469281923",
    notes: "Événement d'entreprise annuel, habitué des smokings Gatsby.",
    is_blacklisted: false,
    created_at: "2026-07-01T10:00:00.000Z",
    rentals: [
      {
        id: "loc-010",
        contract_number: "LOC-2026-0010",
        event_date: "05/09/2026",
        pickup_date: "03/09/2026",
        return_date: "07/09/2026",
        status: "retourne",
        articles_summary: "Smoking Midnight Blue Lanvin (T.50)",
        total_amount_cents: 19000,
        deposit_amount_cents: 50000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-08-28T14:00:00.000Z",
      },
      {
        id: "loc-003",
        contract_number: "LOC-2026-0003",
        event_date: "04/07/2026",
        pickup_date: "02/07/2026",
        return_date: "06/07/2026",
        status: "retourne",
        articles_summary: "Veste Smoking Blanc Cassé Gatsby (T.48)",
        total_amount_cents: 21000,
        deposit_amount_cents: 60000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-07-01T10:15:00.000Z",
      },
    ],
  },
  {
    id: "cli-005",
    first_name: "Lucas",
    last_name: "Bernard",
    email: "lucas.bernard@free.fr",
    phone: "07 11 33 55 77",
    address: "12 Allée des Tilleuls",
    city: "Boulogne-Billancourt",
    postal_code: "92100",
    identity_card_number: "CNI-FR-230192847102",
    notes: "Pointure 43 fort cou-de-pied, Richelieus ou Derbies confort.",
    is_blacklisted: false,
    created_at: "2026-07-05T09:30:00.000Z",
    rentals: [
      {
        id: "loc-012",
        contract_number: "LOC-2026-0012",
        event_date: "12/09/2026",
        pickup_date: "11/09/2026",
        return_date: "14/09/2026",
        status: "en_cours",
        articles_summary: "Richelieu Bout Droit Cuir Glacé Noir (P.43)",
        total_amount_cents: 6000,
        deposit_amount_cents: 18000,
        deposit_status: "empreinte_cb",
        payment_status: "solde",
        notes: "Retour attendu aujourd'hui 14/09",
        created_at: "2026-09-05T11:00:00.000Z",
      },
      {
        id: "loc-004",
        contract_number: "LOC-2026-0004",
        event_date: "11/07/2026",
        pickup_date: "09/07/2026",
        return_date: "13/07/2026",
        status: "retourne",
        articles_summary: "Costume 2 Pièces Lin & Soie Sable (T.50)",
        total_amount_cents: 14000,
        deposit_amount_cents: 35000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-07-05T10:00:00.000Z",
      },
    ],
  },
  {
    id: "cli-006",
    first_name: "Marc",
    last_name: "Lefebvre",
    email: "marc.lefebvre@wanadoo.fr",
    phone: "06 44 22 11 00",
    address: "45 Rue Nationale",
    city: "Lille",
    postal_code: "59000",
    identity_card_number: "CNI-FR-180959281723",
    notes: "Litiges fréquents sur les retours. Retard avéré sur contrat LOC-2026-0011.",
    is_blacklisted: true,
    blacklist_reason:
      "Retard de restitution non justifié de plus de 4 jours sur contrat LOC-2026-0011 et contestation agressive des pénalités dues.",
    blacklist_date: "2026-09-13T10:00:00.000Z",
    created_at: "2026-07-12T15:20:00.000Z",
    rentals: [
      {
        id: "loc-011",
        contract_number: "LOC-2026-0011",
        event_date: "10/09/2026",
        pickup_date: "08/09/2026",
        return_date: "12/09/2026",
        status: "en_retard",
        articles_summary: "Smoking Col Châle Soie Noir (T.50)",
        total_amount_cents: 18000,
        deposit_amount_cents: 45000,
        deposit_status: "cheque_retenu",
        payment_status: "solde",
        notes: "Non restitué le 12/09 ! +4 000 DA pénalité de retard appliquée",
        created_at: "2026-09-01T15:00:00.000Z",
      },
    ],
  },
  {
    id: "cli-007",
    first_name: "Guillaume",
    last_name: "Dubois",
    email: "g.dubois@entreprise.com",
    phone: "06 33 11 22 44",
    alternative_phone: "01 40 20 30 40",
    address: "18 Rue du Commerce",
    city: "Nantes",
    postal_code: "44000",
    identity_card_number: "PASS-FR-22XY99182",
    notes: "Taille 48 Standard. Recommande notre boutique auprès de ses collègues.",
    is_blacklisted: false,
    created_at: "2026-07-18T14:45:00.000Z",
    rentals: [
      {
        id: "loc-005",
        contract_number: "LOC-2026-0005",
        event_date: "25/07/2026",
        pickup_date: "23/07/2026",
        return_date: "27/07/2026",
        status: "retourne",
        articles_summary: "Costume 3P Prince de Galles Scabal (T.48)",
        total_amount_cents: 16500,
        deposit_amount_cents: 42000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-07-18T15:00:00.000Z",
      },
    ],
  },
  {
    id: "cli-008",
    first_name: "Antoine",
    last_name: "Moreau",
    email: "antoine.moreau@icloud.com",
    phone: "07 88 66 44 22",
    address: "5 Boulevard Gambetta",
    city: "Bordeaux",
    postal_code: "33000",
    identity_card_number: "CNI-FR-200333918273",
    notes: "Location smoking d'apparat et souliers patine cognac.",
    is_blacklisted: false,
    created_at: "2026-08-01T16:10:00.000Z",
    rentals: [
      {
        id: "loc-006",
        contract_number: "LOC-2026-0006",
        event_date: "08/08/2026",
        pickup_date: "06/08/2026",
        return_date: "10/08/2026",
        status: "retourne",
        articles_summary: "Smoking Col Châle (T.48) + Richelieu One-Cut (43)",
        total_amount_cents: 23500,
        deposit_amount_cents: 60000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-08-01T16:30:00.000Z",
      },
    ],
  },
  {
    id: "cli-009",
    first_name: "Julien",
    last_name: "Roux",
    email: "julien.roux@gmail.com",
    phone: "06 77 55 33 11",
    address: "9 Place Bellecour",
    city: "Lyon",
    postal_code: "69002",
    identity_card_number: "PERM-FR-7708691029",
    notes: "Costume Bordeaux 3P pour fiançailles. Très satisfait.",
    is_blacklisted: false,
    created_at: "2026-08-10T11:30:00.000Z",
    rentals: [
      {
        id: "loc-007",
        contract_number: "LOC-2026-0007",
        event_date: "15/08/2026",
        pickup_date: "13/08/2026",
        return_date: "17/08/2026",
        status: "retourne",
        articles_summary: "Costume 3 Pièces Bordeaux Impérial (T.52)",
        total_amount_cents: 17000,
        deposit_amount_cents: 45000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-08-10T11:45:00.000Z",
      },
    ],
  },
  {
    id: "cli-010",
    first_name: "Nicolas",
    last_name: "Fournier",
    email: "nicolas.fournier@protonmail.com",
    phone: "06 00 22 44 66",
    address: "77 Rue de Rennes",
    city: "Paris",
    postal_code: "75006",
    identity_card_number: "CNI-FR-240575192837",
    notes:
      "Client d'honneur festivals et galas. Taille 50 Drop 7 / Pantalon 42. Exige toujours un repassage parfait.",
    is_blacklisted: false,
    created_at: "2026-05-15T18:00:00.000Z",
    rentals: [
      {
        id: "loc-008",
        contract_number: "LOC-2026-0008",
        event_date: "22/08/2026",
        pickup_date: "20/08/2026",
        return_date: "24/08/2026",
        status: "retourne",
        articles_summary: "Smoking Midnight Blue (T.50) + Richelieus Vernis (42)",
        total_amount_cents: 25000,
        deposit_amount_cents: 65000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-08-15T18:30:00.000Z",
      },
      {
        id: "loc-fourn-02",
        contract_number: "LOC-2026-F02",
        event_date: "18/07/2026",
        pickup_date: "16/07/2026",
        return_date: "20/07/2026",
        status: "retourne",
        articles_summary: "Smoking Velours Vert Émeraude (T.50)",
        total_amount_cents: 19500,
        deposit_amount_cents: 50000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-07-02T10:00:00.000Z",
      },
      {
        id: "loc-fourn-03",
        contract_number: "LOC-2026-F03",
        event_date: "20/06/2026",
        pickup_date: "19/06/2026",
        return_date: "22/06/2026",
        status: "retourne",
        articles_summary: "Smoking Col Châle Soie Noir (T.50)",
        total_amount_cents: 18000,
        deposit_amount_cents: 45000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-06-10T14:00:00.000Z",
      },
      {
        id: "loc-fourn-04",
        contract_number: "LOC-2026-F04",
        event_date: "24/05/2026",
        pickup_date: "22/05/2026",
        return_date: "26/05/2026",
        status: "retourne",
        articles_summary: "Smoking Midnight Blue Col Pointe (T.50)",
        total_amount_cents: 19000,
        deposit_amount_cents: 50000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-05-10T11:00:00.000Z",
      },
      {
        id: "loc-fourn-05",
        contract_number: "LOC-2026-F05",
        event_date: "14/04/2026",
        pickup_date: "12/04/2026",
        return_date: "16/04/2026",
        status: "retourne",
        articles_summary: "Costume 3 Pièces Bordeaux Impérial (T.50)",
        total_amount_cents: 17000,
        deposit_amount_cents: 45000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-04-01T15:00:00.000Z",
      },
      {
        id: "loc-fourn-06",
        contract_number: "LOC-2026-F06",
        event_date: "28/02/2026",
        pickup_date: "26/02/2026",
        return_date: "02/03/2026",
        status: "retourne",
        articles_summary: "Smoking Col Châle Soie Noir (T.50)",
        total_amount_cents: 18000,
        deposit_amount_cents: 45000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2026-02-15T12:00:00.000Z",
      },
      {
        id: "loc-fourn-07",
        contract_number: "LOC-2025-F99",
        event_date: "31/12/2025",
        pickup_date: "30/12/2025",
        return_date: "03/01/2026",
        status: "retourne",
        articles_summary: "Smoking Gatsby Blanc Cassé (T.50)",
        total_amount_cents: 21000,
        deposit_amount_cents: 60000,
        deposit_status: "restituee",
        payment_status: "solde",
        created_at: "2025-12-10T16:00:00.000Z",
      },
    ],
  },
];

export const useClientStore = create<ClientStoreState>((set, get) => ({
  clients: isTauri()
    ? []
    : dbStorage.load<CustomerDetailed[]>(dbStorage.KEYS.CLIENTS, INITIAL_CLIENTS),
  search: "",
  sortBy: "spent_desc",
  filter: "all",
  selectedClient: null,
  targetBlacklistClient: null,
  alertClientForRental: null,

  isCreateModalOpen: false,
  isDetailModalOpen: false,
  isBlacklistDialogOpen: false,
  isBlacklistAlertOpen: false,

  setSearch: (search) => set({ search }),
  setSortBy: (sortBy) => set({ sortBy }),
  setFilter: (filter) => set({ filter }),
  setSelectedClient: (client) => set({ selectedClient: client }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setDetailModalOpen: (open) => set({ isDetailModalOpen: open }),

  openBlacklistDialog: (client) =>
    set({
      targetBlacklistClient: client,
      isBlacklistDialogOpen: true,
    }),

  closeBlacklistDialog: () =>
    set({
      targetBlacklistClient: null,
      isBlacklistDialogOpen: false,
    }),

  openBlacklistAlertForRental: (client) =>
    set({
      alertClientForRental: client,
      isBlacklistAlertOpen: true,
    }),

  closeBlacklistAlert: () =>
    set({
      alertClientForRental: null,
      isBlacklistAlertOpen: false,
    }),

  addClient: (newClientData) => {
    const newClient: CustomerDetailed = {
      id: newClientData.id || `cli-${Date.now()}`,
      first_name: newClientData.first_name.trim(),
      last_name: newClientData.last_name.trim().toUpperCase(),
      email: newClientData.email?.trim() || "",
      phone: newClientData.phone.trim(),
      alternative_phone: newClientData.alternative_phone?.trim() || "",
      address: newClientData.address?.trim() || "",
      city: newClientData.city?.trim() || "Paris",
      postal_code: newClientData.postal_code?.trim() || "75000",
      identity_card_number: newClientData.identity_card_number?.trim() || "",
      identity_card_photo: newClientData.identity_card_photo,
      notes: newClientData.notes?.trim() || "",
      is_blacklisted: false,
      rentals: [],
      created_at: new Date().toISOString(),
    };

    set((state) => {
      const updated = [newClient, ...state.clients];
      dbStorage.save(dbStorage.KEYS.CLIENTS, updated);
      return {
        clients: updated,
        selectedClient: newClient,
      };
    });

    dbStorage.persistWithIpc("create_client", {
      dto: {
        prenom: newClient.first_name,
        nom: newClient.last_name,
        email: newClient.email,
        telephone: newClient.phone,
        telephone_secondaire: newClient.alternative_phone,
        adresse: newClient.address,
        ville: newClient.city,
        code_postal: newClient.postal_code,
        numero_cni: newClient.identity_card_number,
        notes: newClient.notes,
      }
    }, dbStorage.KEYS.CLIENTS, get().clients).catch(() => {});

    return newClient;
  },

  updateClient: (id, updates) => {
    set((state) => {
      const updatedClients = state.clients.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      );
      const updatedSelected =
        state.selectedClient?.id === id
          ? { ...state.selectedClient, ...updates }
          : state.selectedClient;

      dbStorage.save(dbStorage.KEYS.CLIENTS, updatedClients);
      return {
        clients: updatedClients,
        selectedClient: updatedSelected,
      };
    });
  },

  toggleBlacklist: (id, isBlacklisted, reason) => {
    if (isBlacklisted && (!reason || reason.trim().length < 5)) {
      return {
        success: false,
        error: "Un commentaire obligatoire d'au moins 5 caractères est requis pour justifier la mise sur liste noire.",
      };
    }

    set((state) => {
      const now = new Date().toISOString();
      const updatedClients = state.clients.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          is_blacklisted: isBlacklisted,
          blacklist_reason: isBlacklisted ? reason?.trim() : undefined,
          blacklist_date: isBlacklisted ? now : undefined,
        };
      });

      dbStorage.save(dbStorage.KEYS.CLIENTS, updatedClients);

      const updatedSelected =
        state.selectedClient?.id === id
          ? {
              ...state.selectedClient,
              is_blacklisted: isBlacklisted,
              blacklist_reason: isBlacklisted ? reason?.trim() : undefined,
              blacklist_date: isBlacklisted ? now : undefined,
            }
          : state.selectedClient;

      return {
        clients: updatedClients,
        selectedClient: updatedSelected,
        isBlacklistDialogOpen: false,
        targetBlacklistClient: null,
      };
    });

    return { success: true };
  },

  uploadIdentityCard: (id, photoDataUrl) => {
    get().updateClient(id, { identity_card_photo: photoDataUrl });
  },
}));

// Helpers de calcul utilitaires réutilisables
export const getClientTotalSpentCents = (client: CustomerDetailed): number => {
  return client.rentals.reduce((sum, r) => sum + r.total_amount_cents, 0);
};

export const getClientRentalsCount = (client: CustomerDetailed): number => {
  return client.rentals.length;
};

export const isClientLoyal = (client: CustomerDetailed): boolean => {
  return client.rentals.length > 5;
};
