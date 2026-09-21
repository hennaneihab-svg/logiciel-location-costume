import { invokeCommand, isTauri } from "./tauri";
import type {
  Article,
  ItemVariant,
  Customer,
  Contract,
  Payment,
  ReturnAlert,
} from "@/types";
import type { RentalContract } from "@/types/rental";

// ============================================================================
// INTERFACES DTOs TYPESCRIPT
// ============================================================================

export interface CreateArticleDto {
  categorie_id: string;
  fournisseur_id?: string;
  reference: string;
  nom: string;
  marque?: string;
  couleur?: string;
  description?: string;
  prix_location_centimes: number;
  prix_vente_centimes?: number;
  caution_suggeree_centimes: number;
  frais_nettoyage_centimes?: number;
  image_url?: string;
}

export interface CreateClientDto {
  prenom: string;
  nom: string;
  email?: string;
  telephone: string;
  telephone_secondaire?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  numero_cni?: string;
  notes?: string;
}

export interface CreatePaiementDto {
  location_id?: string;
  vente_id?: string;
  utilisateur_id: string;
  montant_centimes: number;
  type_paiement: string;
  moyen_paiement: string;
  reference_transaction?: string;
  notes?: string;
}

export interface DashboardKpis {
  ca_mois_centimes: number;
  locations_actives: number;
  taux_disponibilite_pourcentage: number;
  alertes_en_attente: number;
}

// ============================================================================
// DONNÉES DE SEEDING LOCAL POUR LE FALLBACK NAVIGATEUR / PREVIEWS
// ============================================================================

const SEED_ARTICLES: Article[] = [
  {
    id: "art-001",
    category_id: "cat-01",
    category_name: "Smokings Cérémonie",
    reference: "SMK-NOIR-01",
    name: "Smoking Col Châle Soie Noir",
    brand: "Lanvin",
    color: "Noir Intense",
    description: "Smoking d'apparat en laine vierge Super 130s avec revers châle satin",
    rental_price_cents: 18000,
    sale_price_cents: 89000,
    deposit_price_cents: 45000,
    cleaning_fee_cents: 1500,
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-002",
    category_id: "cat-01",
    category_name: "Smokings Cérémonie",
    reference: "SMK-BLEU-02",
    name: "Smoking Midnight Blue Col Pointe",
    brand: "Lanvin",
    color: "Bleu Nuit",
    description: "Smoking de cocktail coupe ajustée avec revers pointe contrastés",
    rental_price_cents: 19000,
    sale_price_cents: 95000,
    deposit_price_cents: 50000,
    cleaning_fee_cents: 1500,
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-005",
    category_id: "cat-02",
    category_name: "Costumes 3 Pièces",
    reference: "CST-3P-ROYAL",
    name: "Costume 3 Pièces Bleu Royal Cérémonie",
    brand: "Hugo Boss",
    color: "Bleu Royal",
    description: "Costume complet avec gilet croisé 6 boutons et doublure nacrée",
    rental_price_cents: 15000,
    sale_price_cents: 75000,
    deposit_price_cents: 40000,
    cleaning_fee_cents: 1200,
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-013",
    category_id: "cat-04",
    category_name: "Chaussures Richelieu",
    reference: "CHS-RCH-GLAC",
    name: "Richelieu Bout Droit Cuir Glacé Noir",
    brand: "Santoni",
    color: "Noir Miroir",
    description: "Cousu Goodyear, semelle cuir avec patin injecté, brillance exceptionnelle",
    rental_price_cents: 6000,
    sale_price_cents: 48000,
    deposit_price_cents: 18000,
    cleaning_fee_cents: 500,
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
];

const SEED_CLIENTS: Customer[] = [
  {
    id: "cli-001",
    first_name: "Jean",
    last_name: "Dupont",
    email: "jean.dupont@gmail.com",
    phone: "06 12 34 56 78",
    city: "Paris",
    identity_card_number: "CNI-FR-220975102934",
    is_blacklisted: false,
    created_at: "2026-06-10T14:00:00.000Z",
  },
  {
    id: "cli-002",
    first_name: "Alexandre",
    last_name: "Mercier",
    email: "alex.mercier@orange.fr",
    phone: "07 98 76 54 32",
    city: "Versailles",
    identity_card_number: "PASS-FR-19AB89201",
    is_blacklisted: false,
    created_at: "2026-06-15T11:00:00.000Z",
  },
  {
    id: "cli-003",
    first_name: "Maxime",
    last_name: "Laroche",
    email: "max.laroche@outlook.com",
    phone: "06 55 44 33 22",
    city: "Neuilly-sur-Seine",
    identity_card_number: "PERM-FR-8409124401",
    is_blacklisted: false,
    created_at: "2026-06-20T16:00:00.000Z",
  },
];

// ============================================================================
// SERVICE D'ACCÈS AUX ARTICLES
// ============================================================================
export const articleService = {
  async list(): Promise<Article[]> {
    if (isTauri()) {
      return await invokeCommand<Article[]>("list_articles");
    }
    return SEED_ARTICLES;
  },

  async get(id: string): Promise<Article> {
    if (isTauri()) {
      return await invokeCommand<Article>("get_article", { id });
    }
    const found = SEED_ARTICLES.find((a) => a.id === id);
    if (!found) throw new Error(`Article introuvable : ${id}`);
    return found;
  },

  async create(dto: CreateArticleDto): Promise<Article> {
    if (isTauri()) {
      return await invokeCommand<Article>("create_article", { dto });
    }
    const newArt: Article = {
      id: `art-${Date.now()}`,
      category_id: dto.categorie_id,
      reference: dto.reference,
      name: dto.nom,
      brand: dto.marque,
      color: dto.couleur,
      description: dto.description,
      rental_price_cents: dto.prix_location_centimes,
      sale_price_cents: dto.prix_vente_centimes,
      deposit_price_cents: dto.caution_suggeree_centimes,
      cleaning_fee_cents: dto.frais_nettoyage_centimes || 0,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    SEED_ARTICLES.unshift(newArt);
    return newArt;
  },

  async delete(id: string): Promise<void> {
    if (isTauri()) {
      return await invokeCommand<void>("delete_article", { id });
    }
    const idx = SEED_ARTICLES.findIndex((a) => a.id === id);
    if (idx !== -1) SEED_ARTICLES.splice(idx, 1);
  },
};

// ============================================================================
// SERVICE D'ACCÈS AUX DÉCLINAISONS / VARIANTES
// ============================================================================
export const varianteService = {
  async list(articleId?: string): Promise<ItemVariant[]> {
    if (isTauri()) {
      return await invokeCommand<ItemVariant[]>("list_variantes", {
        articleId: articleId || null,
      });
    }
    return [];
  },

  async updateStatut(id: string, statut: string): Promise<void> {
    if (isTauri()) {
      return await invokeCommand<void>("update_variante_statut", { id, statut });
    }
  },
};

// ============================================================================
// SERVICE D'ACCÈS AUX CLIENTS
// ============================================================================
export const clientService = {
  async list(): Promise<Customer[]> {
    if (isTauri()) {
      return await invokeCommand<Customer[]>("list_clients");
    }
    return SEED_CLIENTS;
  },

  async get(id: string): Promise<Customer> {
    if (isTauri()) {
      return await invokeCommand<Customer>("get_client", { id });
    }
    const found = SEED_CLIENTS.find((c) => c.id === id);
    if (!found) throw new Error(`Client introuvable : ${id}`);
    return found;
  },

  async create(dto: CreateClientDto): Promise<Customer> {
    if (isTauri()) {
      return await invokeCommand<Customer>("create_client", { dto });
    }
    const newCli: Customer = {
      id: `cli-${Date.now()}`,
      first_name: dto.prenom,
      last_name: dto.nom,
      email: dto.email,
      phone: dto.telephone,
      city: dto.ville,
      identity_card_number: dto.numero_cni,
      is_blacklisted: false,
      created_at: new Date().toISOString(),
    };
    SEED_CLIENTS.unshift(newCli);
    return newCli;
  },

  async delete(id: string): Promise<void> {
    if (isTauri()) {
      return await invokeCommand<void>("delete_client", { id });
    }
    const idx = SEED_CLIENTS.findIndex((c) => c.id === id);
    if (idx !== -1) SEED_CLIENTS.splice(idx, 1);
  },
};

// ============================================================================
// SERVICE D'ACCÈS AUX LOCATIONS
// ============================================================================
export const locationService = {
  async list(): Promise<Contract[]> {
    if (isTauri()) {
      return await invokeCommand<Contract[]>("list_locations");
    }
    return [];
  },

  async get(id: string): Promise<Contract> {
    if (isTauri()) {
      return await invokeCommand<Contract>("get_location", { id });
    }
    throw new Error(`Location introuvable : ${id}`);
  },

  async updateStatut(id: string, statut: string): Promise<void> {
    if (isTauri()) {
      return await invokeCommand<void>("update_location_statut", { id, statut });
    }
  },

  async listRentals(): Promise<RentalContract[]> {
    if (isTauri()) {
      return await invokeCommand<RentalContract[]>("list_rentals");
    }
    return [];
  },

  async getRental(id: string): Promise<RentalContract> {
    if (isTauri()) {
      return await invokeCommand<RentalContract>("get_rental", { id });
    }
    throw new Error(`Location introuvable : ${id}`);
  },

  async createRental(dto: unknown): Promise<RentalContract> {
    if (isTauri()) {
      return await invokeCommand<RentalContract>("create_rental", { dto });
    }
    throw new Error("Mode Tauri requis pour createRental");
  },

  async registerReturn(dto: unknown): Promise<RentalContract> {
    if (isTauri()) {
      return await invokeCommand<RentalContract>("register_return", { dto });
    }
    throw new Error("Mode Tauri requis pour registerReturn");
  },

  async cancelRental(id: string): Promise<RentalContract> {
    if (isTauri()) {
      return await invokeCommand<RentalContract>("cancel_rental", { id });
    }
    throw new Error("Mode Tauri requis pour cancelRental");
  },
};

// ============================================================================
// SERVICE D'ACCÈS AUX PAIEMENTS
// ============================================================================
export const paiementService = {
  async list(locationId?: string): Promise<Payment[]> {
    if (isTauri()) {
      return await invokeCommand<Payment[]>("list_paiements", {
        locationId: locationId || null,
      });
    }
    return [];
  },

  async create(dto: CreatePaiementDto): Promise<Payment> {
    if (isTauri()) {
      return await invokeCommand<Payment>("create_paiement", { dto });
    }
    return {
      id: `pay-${Date.now()}`,
      contract_id: dto.location_id || "",
      user_id: dto.utilisateur_id,
      amount_cents: dto.montant_centimes,
      payment_type: dto.type_paiement as any,
      payment_method: dto.moyen_paiement as any,
      transaction_reference: dto.reference_transaction,
      notes: dto.notes,
      created_at: new Date().toISOString(),
    };
  },
};

// ============================================================================
// SERVICE D'ACCÈS AUX ALERTES
// ============================================================================
export const alerteService = {
  async list(): Promise<ReturnAlert[]> {
    if (isTauri()) {
      return await invokeCommand<ReturnAlert[]>("list_alertes");
    }
    return [
      {
        id: "alt-001",
        contract_id: "loc-011",
        contract_number: "LOC-2026-0011",
        customer_name: "Marc Lefebvre",
        customer_phone: "06 44 22 11 00",
        alert_type: "retard",
        due_date: "2026-09-12T18:00:00.000Z",
        is_triggered: true,
        dismissed: false,
      },
    ];
  },

  async traiter(id: string): Promise<void> {
    if (isTauri()) {
      return await invokeCommand<void>("traiter_alerte", { id });
    }
  },
};

// ============================================================================
// SERVICE DASHBOARD & KPIS
// ============================================================================
export const dashboardService = {
  async getStats(): Promise<DashboardKpis> {
    if (isTauri()) {
      return await invokeCommand<DashboardKpis>("get_dashboard_stats");
    }
    return {
      ca_mois_centimes: 1485000,
      locations_actives: 24,
      taux_disponibilite_pourcentage: 78.5,
      alertes_en_attente: 3,
    };
  },
};
