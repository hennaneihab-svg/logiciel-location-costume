import { create } from "zustand";
import type { StockArticle, StockVariant, StatusLog } from "@/types/stock";
import { dbStorage } from "@/services/dbStorage";

interface StockFilterState {
  search: string;
  category: string;
  size: string;
  status: string;
  alertFilter: "all" | "low_stock" | "inactive_90d";
}

interface StockStore {
  articles: StockArticle[];
  filters: StockFilterState;
  selectedArticle: StockArticle | null;
  statusLogs: StatusLog[];
  isCreateModalOpen: boolean;
  isDetailModalOpen: boolean;
  isQrLabelModalOpen: boolean;
  articleForQrLabel: StockArticle | null;

  // Actions
  setSearch: (search: string) => void;
  setCategory: (category: string) => void;
  setSize: (size: string) => void;
  setStatus: (status: string) => void;
  setAlertFilter: (alertFilter: "all" | "low_stock" | "inactive_90d") => void;
  resetFilters: () => void;

  setSelectedArticle: (article: StockArticle | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  setDetailModalOpen: (open: boolean) => void;
  openQrLabelModal: (article: StockArticle) => void;
  closeQrLabelModal: () => void;

  addArticle: (article: StockArticle) => void;
  updateArticle: (id: string, updated: Partial<StockArticle>) => void;
  deleteArticle: (id: string) => void;

  // Gestion des statuts et simulation mouvement de stock
  changeVariantStatus: (
    articleId: string,
    variantId: string,
    newStatus: StockVariant["status"],
    comment: string
  ) => void;
  rentVariant: (
    articleId: string,
    variantId: string,
    contractNumber: string,
    customerName: string,
    amountCents: number
  ) => void;
  returnVariant: (
    articleId: string,
    variantId: string,
    condition: StockVariant["condition_state"]
  ) => void;
}

// Jeu de données initial complet et réaliste pour le module Stock
const INITIAL_ARTICLES: StockArticle[] = [
  {
    id: "art-001",
    category_id: "cat-01",
    category_name: "Smokings Cérémonie",
    reference: "SMK-NOIR-01",
    name: "Smoking Col Châle Soie Noir",
    brand: "Lanvin",
    color: "Noir Intense",
    description: "Smoking d'apparat en laine vierge Super 130s avec revers châle satiné.",
    rental_price_cents: 18000,
    sale_price_cents: 89000,
    deposit_price_cents: 45000,
    cleaning_fee_cents: 1500,
    photos: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-001",
        article_id: "art-001",
        barcode: "BAR-SMK-001-48",
        size: "48",
        sub_size: "Drop 7",
        condition_state: "excellent",
        status: "disponible",
        times_rented: 4,
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "var-002",
        article_id: "art-001",
        barcode: "BAR-SMK-001-50",
        size: "50",
        sub_size: "Drop 7",
        condition_state: "excellent",
        status: "en_location",
        times_rented: 6,
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "var-003",
        article_id: "art-001",
        barcode: "BAR-SMK-001-52",
        size: "52",
        sub_size: "Drop 8",
        condition_state: "neuf",
        status: "disponible",
        times_rented: 1,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [
      {
        id: "hist-01",
        contract_number: "LOC-2026-0001",
        customer_name: "Jean Dupont",
        pickup_date: "18/06/2026",
        return_date: "22/06/2026",
        amount_cents: 18000,
        variant_size: "T.50",
        return_condition: "excellent",
        notes: "Parfait état au retour",
      },
      {
        id: "hist-02",
        contract_number: "LOC-2026-0006",
        customer_name: "Antoine Moreau",
        pickup_date: "06/08/2026",
        return_date: "10/08/2026",
        amount_cents: 18000,
        variant_size: "T.48",
        return_condition: "excellent",
        notes: "Nettoyage standard pressing effectué",
      },
    ],
    total_revenue_cents: 198000,
    times_rented_total: 11,
    last_rented_date: "2026-09-08T11:00:00.000Z",
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
    description: "Smoking de cocktail coupe ajustée avec revers pointe contrastés noir satin.",
    rental_price_cents: 19000,
    sale_price_cents: 95000,
    deposit_price_cents: 50000,
    cleaning_fee_cents: 1500,
    photos: [
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-004",
        article_id: "art-002",
        barcode: "BAR-SMK-002-50",
        size: "50",
        sub_size: "Standard",
        condition_state: "bon",
        status: "disponible",
        times_rented: 8,
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "var-005",
        article_id: "art-002",
        barcode: "BAR-SMK-002-52",
        size: "52",
        sub_size: "Standard",
        condition_state: "excellent",
        status: "reserve",
        times_rented: 3,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [
      {
        id: "hist-03",
        contract_number: "LOC-2026-0008",
        customer_name: "Nicolas Fournier",
        pickup_date: "20/08/2026",
        return_date: "24/08/2026",
        amount_cents: 19000,
        variant_size: "T.50",
        return_condition: "excellent",
      },
      {
        id: "hist-04",
        contract_number: "LOC-2026-0010",
        customer_name: "Thomas Martin",
        pickup_date: "03/09/2026",
        return_date: "07/09/2026",
        amount_cents: 19000,
        variant_size: "T.50",
        return_condition: "excellent",
      },
    ],
    total_revenue_cents: 209000,
    times_rented_total: 11,
    last_rented_date: "2026-09-03T14:00:00.000Z",
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-004",
    category_id: "cat-01",
    category_name: "Smokings Cérémonie",
    reference: "SMK-VERT-04",
    name: "Smoking Velours Vert Émeraude",
    brand: "Hugo Boss",
    color: "Vert Émeraude",
    description: "Smoking tendance d'hiver en velours de coton rasé avec col châle noir.",
    rental_price_cents: 19500,
    sale_price_cents: 98000,
    deposit_price_cents: 50000,
    cleaning_fee_cents: 2000,
    photos: [
      "https://images.unsplash.com/photo-1548883354-7622d03aca27?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-007",
        article_id: "art-004",
        barcode: "BAR-SMK-004-50",
        size: "50",
        sub_size: "Standard",
        condition_state: "excellent",
        status: "au_pressing",
        times_rented: 5,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [],
    total_revenue_cents: 97500,
    times_rented_total: 5,
    last_rented_date: "2026-08-15T10:00:00.000Z",
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
    description: "Costume complet avec gilet croisé 6 boutons et doublure nacrée.",
    rental_price_cents: 15000,
    sale_price_cents: 75000,
    deposit_price_cents: 40000,
    cleaning_fee_cents: 1200,
    photos: [
      "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-008",
        article_id: "art-005",
        barcode: "BAR-CST-005-50",
        size: "50",
        sub_size: "Drop 7",
        condition_state: "excellent",
        status: "en_location",
        times_rented: 7,
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "var-009",
        article_id: "art-005",
        barcode: "BAR-CST-005-52",
        size: "52",
        sub_size: "Drop 7",
        condition_state: "excellent",
        status: "disponible",
        times_rented: 4,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [
      {
        id: "hist-05",
        contract_number: "LOC-2026-0002",
        customer_name: "Maxime Laroche",
        pickup_date: "25/06/2026",
        return_date: "29/06/2026",
        amount_cents: 15000,
        variant_size: "T.50",
        return_condition: "excellent",
      },
    ],
    total_revenue_cents: 165000,
    times_rented_total: 11,
    last_rented_date: "2026-09-11T14:00:00.000Z",
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-009",
    category_id: "cat-03",
    category_name: "Costumes 2 Pièces",
    reference: "CST-2P-ANTHR",
    name: "Costume 2 Pièces Anthracite Slim",
    brand: "Hugo Boss",
    color: "Gris Anthracite",
    description: "Costume moderne passe-partout pour invités et témoins.",
    rental_price_cents: 12000,
    sale_price_cents: 59000,
    deposit_price_cents: 30000,
    cleaning_fee_cents: 1000,
    photos: [
      "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-013",
        article_id: "art-009",
        barcode: "BAR-CST-009-48",
        size: "48",
        sub_size: "Slim",
        condition_state: "usage",
        status: "en_retouche",
        times_rented: 9,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [],
    total_revenue_cents: 108000,
    times_rented_total: 9,
    last_rented_date: "2026-08-27T10:00:00.000Z",
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-012",
    category_id: "cat-03",
    category_name: "Costumes 2 Pièces",
    reference: "CST-2P-CARRO",
    name: "Costume 2 Pièces Carrelé Vintage",
    brand: "Hugo Boss",
    color: "Brun Noisette",
    description: "Motif carreaux fins style gentleman champêtre. Jamais loué depuis plus de 90 jours.",
    rental_price_cents: 13500,
    sale_price_cents: 67000,
    deposit_price_cents: 34000,
    cleaning_fee_cents: 1000,
    photos: [
      "https://images.unsplash.com/photo-1548883354-7622d03aca27?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-016",
        article_id: "art-012",
        barcode: "BAR-CST-012-50",
        size: "50",
        sub_size: "Standard",
        condition_state: "bon",
        status: "disponible",
        times_rented: 0,
        created_at: "2026-05-10T10:00:00.000Z",
      },
    ],
    rental_history: [],
    total_revenue_cents: 0,
    times_rented_total: 0,
    last_rented_date: undefined, // Jamais loué (> 90 jours)
    is_active: true,
    created_at: "2026-05-10T10:00:00.000Z",
  },
  {
    id: "art-013",
    category_id: "cat-04",
    category_name: "Chaussures Richelieu",
    reference: "CHS-RCH-GLAC",
    name: "Richelieu Bout Droit Cuir Glacé Noir",
    brand: "Santoni",
    color: "Noir Miroir",
    description: "Cousu Goodyear, semelle cuir avec patin injecté, brillance exceptionnelle.",
    rental_price_cents: 6000,
    sale_price_cents: 48000,
    deposit_price_cents: 18000,
    cleaning_fee_cents: 500,
    photos: [
      "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-017",
        article_id: "art-013",
        barcode: "BAR-CHS-013-42",
        size: "42",
        sub_size: "Bout droit",
        condition_state: "excellent",
        status: "disponible",
        times_rented: 5,
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: "var-018",
        article_id: "art-013",
        barcode: "BAR-CHS-013-43",
        size: "43",
        sub_size: "Bout droit",
        condition_state: "bon",
        status: "en_location",
        times_rented: 8,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [
      {
        id: "hist-06",
        contract_number: "LOC-2026-0003",
        customer_name: "Thomas Martin",
        pickup_date: "02/07/2026",
        return_date: "06/07/2026",
        amount_cents: 6000,
        variant_size: "P.43",
        return_condition: "excellent",
      },
    ],
    total_revenue_cents: 78000,
    times_rented_total: 13,
    last_rented_date: "2026-09-11T16:00:00.000Z",
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-014",
    category_id: "cat-04",
    category_name: "Chaussures Richelieu",
    reference: "CHS-RCH-ONEC",
    name: "Richelieu One-Cut Cuir Cognac Patiné",
    brand: "Santoni",
    color: "Cognac Marron",
    description: "Réalisé dans une seule pièce de cuir sans couture latérale, patine main.",
    rental_price_cents: 6500,
    sale_price_cents: 52000,
    deposit_price_cents: 20000,
    cleaning_fee_cents: 500,
    photos: [
      "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-019",
        article_id: "art-014",
        barcode: "BAR-CHS-014-43",
        size: "43",
        sub_size: "One cut",
        condition_state: "excellent",
        status: "disponible",
        times_rented: 4,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [],
    total_revenue_cents: 26000,
    times_rented_total: 4,
    last_rented_date: "2026-08-06T14:00:00.000Z",
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "art-018",
    category_id: "cat-06",
    category_name: "Accessoires Prestige",
    reference: "ACC-NDP-SOIE",
    name: "Nœud Papillon Satin Soie Noir à Nouer",
    brand: "Lanvin",
    color: "Noir Satin",
    description: "Nœud traditionnel ajustable en pure soie d'Italie.",
    rental_price_cents: 2500,
    sale_price_cents: 9500,
    deposit_price_cents: 5000,
    cleaning_fee_cents: 0,
    photos: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&auto=format&fit=crop&q=80",
    ],
    variants: [
      {
        id: "var-023",
        article_id: "art-018",
        barcode: "BAR-ACC-018-U",
        size: "TU",
        sub_size: "Ajustable",
        condition_state: "excellent",
        status: "disponible",
        times_rented: 12,
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ],
    rental_history: [],
    total_revenue_cents: 30000,
    times_rented_total: 12,
    last_rented_date: "2026-09-08T10:00:00.000Z",
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
  },
];

export const useStockStore = create<StockStore>((set, get) => ({
  articles: dbStorage.load<StockArticle[]>(dbStorage.KEYS.ARTICLES, INITIAL_ARTICLES),
  filters: {
    search: "",
    category: "all",
    size: "all",
    status: "all",
    alertFilter: "all",
  },
  selectedArticle: null,
  statusLogs: [],
  isCreateModalOpen: false,
  isDetailModalOpen: false,
  isQrLabelModalOpen: false,
  articleForQrLabel: null,

  setSearch: (search) =>
    set((state) => ({ filters: { ...state.filters, search } })),
  setCategory: (category) =>
    set((state) => ({ filters: { ...state.filters, category } })),
  setSize: (size) =>
    set((state) => ({ filters: { ...state.filters, size } })),
  setStatus: (status) =>
    set((state) => ({ filters: { ...state.filters, status } })),
  setAlertFilter: (alertFilter) =>
    set((state) => ({ filters: { ...state.filters, alertFilter } })),
  resetFilters: () =>
    set({
      filters: {
        search: "",
        category: "all",
        size: "all",
        status: "all",
        alertFilter: "all",
      },
    }),

  setSelectedArticle: (article) => set({ selectedArticle: article }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),
  setDetailModalOpen: (open) => set({ isDetailModalOpen: open }),
  openQrLabelModal: (article) =>
    set({ isQrLabelModalOpen: true, articleForQrLabel: article }),
  closeQrLabelModal: () =>
    set({ isQrLabelModalOpen: false, articleForQrLabel: null }),

  addArticle: (newArt) => {
    set((state) => {
      const updated = [newArt, ...state.articles];
      dbStorage.save(dbStorage.KEYS.ARTICLES, updated);
      return { articles: updated };
    });
    // Tentative de persistance SQLite si Tauri actif
    dbStorage.persistWithIpc("create_article", {
      dto: {
        categorie_id: newArt.category_id,
        reference: newArt.reference,
        nom: newArt.name,
        marque: newArt.brand,
        couleur: newArt.color,
        description: newArt.description,
        prix_location_centimes: newArt.rental_price_cents,
        prix_vente_centimes: newArt.sale_price_cents,
        caution_suggeree_centimes: newArt.deposit_price_cents,
        frais_nettoyage_centimes: newArt.cleaning_fee_cents,
      }
    }, dbStorage.KEYS.ARTICLES, get().articles).catch(() => {});
  },

  updateArticle: (id, updated) => {
    set((state) => {
      const newArticles = state.articles.map((art) =>
        art.id === id ? { ...art, ...updated } : art
      );
      dbStorage.save(dbStorage.KEYS.ARTICLES, newArticles);
      return {
        articles: newArticles,
        selectedArticle:
          state.selectedArticle?.id === id
            ? { ...state.selectedArticle, ...updated }
            : state.selectedArticle,
      };
    });
  },

  deleteArticle: (id) => {
    set((state) => {
      const newArticles = state.articles.filter((art) => art.id !== id);
      dbStorage.save(dbStorage.KEYS.ARTICLES, newArticles);
      return {
        articles: newArticles,
        selectedArticle: state.selectedArticle?.id === id ? null : state.selectedArticle,
      };
    });
    dbStorage.persistWithIpc("delete_article", { id }, dbStorage.KEYS.ARTICLES, get().articles).catch(() => {});
  },

  changeVariantStatus: (articleId, variantId, newStatus, comment) => {
    const state = get();
    const article = state.articles.find((a) => a.id === articleId);
    if (!article) return;

    const variant = article.variants.find((v) => v.id === variantId);
    if (!variant) return;

    const oldStatus = variant.status;
    const updatedVariants = article.variants.map((v) =>
      v.id === variantId ? { ...v, status: newStatus } : v
    );

    const log: StatusLog = {
      id: `log-${Date.now()}`,
      variant_id: variantId,
      article_name: article.name,
      size: variant.size,
      old_status: oldStatus,
      new_status: newStatus,
      comment,
      user_name: "Administrateur",
      timestamp: new Date().toISOString(),
    };

    const updatedArticle = { ...article, variants: updatedVariants };

    set((s) => {
      const newArticles = s.articles.map((a) => (a.id === articleId ? updatedArticle : a));
      dbStorage.save(dbStorage.KEYS.ARTICLES, newArticles);
      return {
        articles: newArticles,
        selectedArticle:
          s.selectedArticle?.id === articleId ? updatedArticle : s.selectedArticle,
        statusLogs: [log, ...s.statusLogs],
      };
    });
    dbStorage.persistWithIpc("update_variante_statut", { id: variantId, statut: newStatus }, dbStorage.KEYS.ARTICLES, get().articles).catch(() => {});
  },

  rentVariant: (articleId, variantId, contractNumber, customerName, amountCents) => {
    const state = get();
    const article = state.articles.find((a) => a.id === articleId);
    if (!article) return;

    const variant = article.variants.find((v) => v.id === variantId);
    if (!variant) return;

    // Décrémentation du stock disponible -> passage en 'en_location'
    const updatedVariants = article.variants.map((v) =>
      v.id === variantId
        ? { ...v, status: "en_location" as const, times_rented: v.times_rented + 1 }
        : v
    );

    const newHistory: StockArticle["rental_history"][0] = {
      id: `hist-${Date.now()}`,
      contract_number: contractNumber,
      customer_name: customerName,
      pickup_date: new Date().toLocaleDateString("fr-FR"),
      return_date: "En cours",
      amount_cents: amountCents,
      variant_size: `T.${variant.size}`,
    };

    const updatedArticle: StockArticle = {
      ...article,
      variants: updatedVariants,
      rental_history: [newHistory, ...article.rental_history],
      times_rented_total: article.times_rented_total + 1,
      total_revenue_cents: article.total_revenue_cents + amountCents,
      last_rented_date: new Date().toISOString(),
    };

    set((s) => {
      const updatedArticles = s.articles.map((a) => (a.id === articleId ? updatedArticle : a));
      dbStorage.save(dbStorage.KEYS.ARTICLES, updatedArticles);
      return {
        articles: updatedArticles,
        selectedArticle:
          s.selectedArticle?.id === articleId ? updatedArticle : s.selectedArticle,
      };
    });
  },

  returnVariant: (articleId, variantId, condition) => {
    const state = get();
    const article = state.articles.find((a) => a.id === articleId);
    if (!article) return;

    // Recrémentation du stock disponible -> passage en 'disponible'
    const updatedVariants = article.variants.map((v) =>
      v.id === variantId
        ? { ...v, status: "disponible" as const, condition_state: condition }
        : v
    );

    const updatedArticle: StockArticle = {
      ...article,
      variants: updatedVariants,
    };

    set((s) => {
      const updatedArticles = s.articles.map((a) => (a.id === articleId ? updatedArticle : a));
      dbStorage.save(dbStorage.KEYS.ARTICLES, updatedArticles);
      return {
        articles: updatedArticles,
        selectedArticle:
          s.selectedArticle?.id === articleId ? updatedArticle : s.selectedArticle,
      };
    });
  },
}));
