import { create } from "zustand";
import type {
  CartItem,
  DirectSale,
  DirectSalePaymentDetails,
  ClotureCaisse,
  CaisseTransactionItem,
  CaissePaymentMethod,
} from "@/types/caisse";
import type { StockArticle, StockVariant } from "@/types/stock";
import { useStockStore } from "@/store/stockStore";
import { useRentalStore } from "@/store/rentalStore";
import { useAuthStore } from "@/store/authStore";
import { invokeCommand, isTauri } from "@/services/tauri";

interface CashierUser {
  id: string;
  name: string;
  role: string;
}

export const AVAILABLE_CASHIERS: CashierUser[] = [
  { id: "usr-001", name: "Jean-Philippe Directeur", role: "Directeur Général (Admin)" },
  { id: "usr-002", name: "Sophie Vendeuse", role: "Responsable Caisse (Vendeuse)" },
];

interface CaisseStoreState {
  cart: CartItem[];
  selectedCustomer: { id: string; name: string; phone?: string } | null;
  salesHistory: DirectSale[];
  currentCashier: CashierUser;
  initialCashFloatCents: number; // 15 000 DA par défaut
  todayCloture: ClotureCaisse | null;
  cloturesHistory: ClotureCaisse[];
  lastCompletedSale: DirectSale | null;
  isLoading: boolean;
  error: string | null;

  // Actions Initialisation & SQLite
  loadSales: () => Promise<void>;
  loadActiveSession: () => Promise<void>;
  openCashSession: (initialCashFloatCents: number, notes?: string) => Promise<any>;

  // Actions Panier
  addToCart: (article: StockArticle, variant?: StockVariant) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  setSelectedCustomer: (customer: { id: string; name: string; phone?: string } | null) => void;

  // Actions Vente
  setCurrentCashier: (cashier: CashierUser) => void;
  setInitialCashFloatCents: (amountCents: number) => void;
  processDirectSale: (payment: DirectSalePaymentDetails, notes?: string) => Promise<DirectSale>;
  setLastCompletedSale: (sale: DirectSale | null) => void;

  // Actions Clôture
  getTodayTransactions: () => CaisseTransactionItem[];
  getClotureDraft: (countedCashCents?: number) => ClotureCaisse;
  validateTodayCloture: (countedCashCents: number, operatorNotes?: string) => Promise<ClotureCaisse>;
  reopenCaisse: () => void;
}

// Données initiales pour tests / mode web
const INITIAL_SALES: DirectSale[] = [
  {
    id: "vte-001",
    sale_number: "VTE-2026-0038",
    customer_name: "Jean Dupont",
    customer_phone: "06 12 34 56 78",
    user_id: "usr-001",
    user_name: "Jean-Philippe Directeur",
    total_amount_cents: 9500,
    tax_rate: 0.2,
    tax_amount_cents: 1583,
    payment: {
      method: "carte_bancaire",
      amount_paid_cents: 9500,
      transaction_ref: "CB-20260914-8841",
    },
    items: [
      {
        id: "item-01",
        article_id: "art-018",
        name: "Nœud Papillon Satin Soie Noir à Nouer",
        reference: "ACC-NDP-SOIE",
        category_name: "Accessoires Prestige",
        unit_price_cents: 9500,
        quantity: 1,
        subtotal_cents: 9500,
      },
    ],
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: "vte-002",
    sale_number: "VTE-2026-0039",
    customer_name: "Client Comptoir",
    user_id: "usr-002",
    user_name: "Sophie Vendeuse",
    total_amount_cents: 15000,
    tax_rate: 0.2,
    tax_amount_cents: 2500,
    payment: {
      method: "especes",
      amount_paid_cents: 15000,
      cash_received_cents: 20000,
      change_returned_cents: 5000,
    },
    items: [
      {
        id: "item-02",
        article_id: "art-019",
        name: "Boutons de Manchette Nacre & Argent",
        reference: "ACC-BTM-NCRR",
        category_name: "Accessoires Prestige",
        unit_price_cents: 15000,
        quantity: 1,
        subtotal_cents: 15000,
      },
    ],
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
];

export const useCaisseStore = create<CaisseStoreState>((set, get) => ({
  cart: [],
  selectedCustomer: null,
  salesHistory: INITIAL_SALES,
  currentCashier: AVAILABLE_CASHIERS[0],
  initialCashFloatCents: 15000, // 15 000 DA
  todayCloture: null,
  cloturesHistory: [],
  lastCompletedSale: null,
  isLoading: false,
  error: null,

  loadSales: async () => {
    if (!isTauri()) return;
    try {
      set({ isLoading: true, error: null });
      const sales = await invokeCommand<DirectSale[]>("list_direct_sales");
      set({ salesHistory: sales, isLoading: false });
    } catch (err: any) {
      console.error("[caisseStore] Erreur chargement ventes SQLite :", err);
      set({ error: err?.message || "Impossible de charger les ventes", isLoading: false });
      throw err;
    }
  },

  loadActiveSession: async () => {
    if (!isTauri()) return;
    try {
      const active = await invokeCommand<any | null>("get_active_cash_session");
      if (active) {
        set({ initialCashFloatCents: active.initial_cash_float_cents });
      }
    } catch (err) {
      console.error("[caisseStore] Erreur chargement session active :", err);
    }
  },

  openCashSession: async (initialCashFloatCents: number, notes?: string) => {
    const currentUser = useAuthStore.getState().currentUser;
    if (!currentUser) {
      throw new Error("Opération impossible : aucun utilisateur n'est actuellement authentifié.");
    }
    if (isTauri()) {
      const session = await invokeCommand<any>("open_cash_session", {
        dto: {
          utilisateur_id: currentUser.id,
          initial_cash_float_cents: initialCashFloatCents,
          notes: notes || null,
        },
      });
      set({ initialCashFloatCents: session.initial_cash_float_cents, todayCloture: null });
      return session;
    }
    set({ initialCashFloatCents, todayCloture: null });
  },

  addToCart: (article: StockArticle, variant?: StockVariant) => {
    set((state) => {
      const priceCents = article.sale_price_cents || article.rental_price_cents;
      const targetCartId = variant ? `${article.id}-${variant.id}` : article.id;

      const existingIndex = state.cart.findIndex((item) => item.id === targetCartId);

      if (existingIndex >= 0) {
        const updated = [...state.cart];
        const current = updated[existingIndex];
        const newQty = current.quantity + 1;
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          subtotal_cents: newQty * current.unit_price_cents,
        };
        return { cart: updated };
      }

      const newItem: CartItem = {
        id: targetCartId,
        article_id: article.id,
        variant_id: variant?.id,
        name: article.name,
        reference: article.reference,
        barcode: variant?.barcode,
        category_name: article.category_name,
        size: variant?.size,
        unit_price_cents: priceCents,
        quantity: 1,
        subtotal_cents: priceCents,
        photo_url: article.photos?.[0],
      };

      return { cart: [newItem, ...state.cart] };
    });
  },

  updateQuantity: (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeFromCart(cartItemId);
      return;
    }
    set((state) => ({
      cart: state.cart.map((item) =>
        item.id === cartItemId
          ? {
              ...item,
              quantity,
              subtotal_cents: quantity * item.unit_price_cents,
            }
          : item
      ),
    }));
  },

  removeFromCart: (cartItemId: string) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.id !== cartItemId),
    }));
  },

  clearCart: () => {
    set({ cart: [], selectedCustomer: null });
  },

  setSelectedCustomer: (customer) => {
    set({ selectedCustomer: customer });
  },

  setCurrentCashier: (cashier) => {
    set({ currentCashier: cashier });
  },

  setInitialCashFloatCents: (amountCents) => {
    set({ initialCashFloatCents: amountCents });
  },

  setLastCompletedSale: (sale) => {
    set({ lastCompletedSale: sale });
  },

  processDirectSale: async (payment: DirectSalePaymentDetails, notes?: string) => {
    const { cart, selectedCustomer } = get();
    const currentUser = useAuthStore.getState().currentUser;

    if (!currentUser) {
      throw new Error("Opération impossible : aucun utilisateur n'est actuellement authentifié.");
    }

    if (cart.length === 0) {
      throw new Error("Le panier est vide");
    }

    if (isTauri()) {
      const itemsPayload = cart.map((item) => ({
        id: item.id,
        article_id: item.article_id,
        variant_id: item.variant_id || null,
        name: item.name,
        reference: item.reference,
        barcode: item.barcode || null,
        category_name: item.category_name,
        size: item.size || null,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        subtotal_cents: item.subtotal_cents,
        photo_url: item.photo_url || null,
      }));

      const dto = {
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || (selectedCustomer ? undefined : "Client Comptoir"),
        customer_phone: selectedCustomer?.phone || null,
        user_id: currentUser.id,
        items: itemsPayload,
        payment: {
          method: payment.method,
          amount_paid_cents: payment.amount_paid_cents,
          transaction_ref: payment.transaction_ref || payment.cheque_number || null,
          cash_received_cents: payment.cash_received_cents || null,
          change_returned_cents: payment.change_returned_cents || null,
        },
        notes: notes || null,
      };

      const createdSale = await invokeCommand<DirectSale>("create_direct_sale", { dto });

      const stockStore = useStockStore.getState();
      cart.forEach((cartItem) => {
        if (cartItem.variant_id) {
          stockStore.changeVariantStatus(
            cartItem.article_id,
            cartItem.variant_id,
            "vendu",
            `Vente directe comptoir ${createdSale.sale_number}`
          );
        }
      });

      set((state) => ({
        salesHistory: [createdSale, ...state.salesHistory],
        cart: [],
        selectedCustomer: null,
        lastCompletedSale: createdSale,
      }));

      return createdSale;
    }

    // Hors Tauri (tests, web) - aucun appel dbStorage.save
    const totalAmountCents = cart.reduce((acc, it) => acc + it.subtotal_cents, 0);
    const taxRate = 0.19;
    const totalHtCents = Math.round(totalAmountCents / (1 + taxRate));
    const taxAmountCents = totalAmountCents - totalHtCents;

    const saleNumber = `VTE-2026-${String(get().salesHistory.length + 40).padStart(4, "0")}`;

    const newSale: DirectSale = {
      id: `vte-${Date.now()}`,
      sale_number: saleNumber,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name || "Client Comptoir",
      customer_phone: selectedCustomer?.phone,
      user_id: currentUser.id,
      user_name: currentUser.full_name,
      total_amount_cents: totalAmountCents,
      tax_rate: taxRate,
      tax_amount_cents: taxAmountCents,
      payment: {
        ...payment,
        amount_paid_cents: totalAmountCents,
      },
      items: [...cart],
      notes,
      created_at: new Date().toISOString(),
    };

    const stockStore = useStockStore.getState();
    cart.forEach((cartItem) => {
      if (cartItem.variant_id) {
        stockStore.changeVariantStatus(
          cartItem.article_id,
          cartItem.variant_id,
          "vendu",
          `Vente directe comptoir ${saleNumber}`
        );
      }
    });

    set((state) => ({
      salesHistory: [newSale, ...state.salesHistory],
      cart: [],
      selectedCustomer: null,
      lastCompletedSale: newSale,
    }));

    return newSale;
  },

  getTodayTransactions: () => {
    const { salesHistory } = get();
    const rentalStore = useRentalStore.getState();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const transactions: CaisseTransactionItem[] = [];

    // 1. Ventes directes d'aujourd'hui
    salesHistory.forEach((sale) => {
      if (sale.created_at.slice(0, 10) === todayStr) {
        transactions.push({
          id: sale.id,
          reference_number: sale.sale_number,
          type: "vente_directe",
          client_name: sale.customer_name,
          payment_method: sale.payment.method,
          amount_cents: sale.total_amount_cents,
          transaction_ref:
            sale.payment.transaction_ref ||
            sale.payment.cheque_number ||
            (sale.payment.method === "especes" ? "Espèces Comptoir" : undefined),
          created_at: sale.created_at,
          operator_name: sale.user_name,
        });
      }
    });

    // 2. Encaissements de locations du jour (acomptes et soldes)
    rentalStore.contracts.forEach((c) => {
      const contractDate = (c.updated_at || c.created_at).slice(0, 10);
      if (contractDate === todayStr && c.paid_amount_cents > 0) {
        const isFull = c.remaining_amount_cents === 0;
        transactions.push({
          id: `pay-${c.id}`,
          reference_number: c.contract_number,
          type: isFull ? "location_solde" : "location_acompte",
          client_name: c.customer_name,
          payment_method: (c.payment_method as CaissePaymentMethod) || "carte_bancaire",
          amount_cents: c.paid_amount_cents,
          transaction_ref: `Paiement Contrat ${c.contract_number}`,
          created_at: c.updated_at || c.created_at,
          operator_name: "Jean-Philippe Directeur",
        });
      }
    });

    return transactions.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getClotureDraft: (countedCashCents?: number) => {
    const { initialCashFloatCents, currentCashier } = get();
    const transactions = get().getTodayTransactions();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    let salesTotal = 0;
    let rentalsTotal = 0;
    let depositsTotal = 0;

    const breakdown: ClotureCaisse["breakdown"] = {
      especes: { total_cents: 0, transaction_count: 0 },
      carte_bancaire: { total_cents: 0, transaction_count: 0 },
      cheque: { total_cents: 0, transaction_count: 0 },
      virement: { total_cents: 0, transaction_count: 0 },
    };

    transactions.forEach((tx) => {
      if (tx.type === "vente_directe") {
        salesTotal += tx.amount_cents;
      } else if (tx.type === "location_caution") {
        depositsTotal += tx.amount_cents;
      } else {
        rentalsTotal += tx.amount_cents;
      }

      const method = tx.payment_method;
      if (method in breakdown) {
        breakdown[method as keyof typeof breakdown].total_cents += tx.amount_cents;
        breakdown[method as keyof typeof breakdown].transaction_count += 1;
      }
    });

    const grandTotal = salesTotal + rentalsTotal;
    const theoreticalCash = initialCashFloatCents + breakdown.especes.total_cents;
    const countedCash = countedCashCents ?? theoreticalCash;
    const discrepancy = countedCash - theoreticalCash;

    return {
      id: `cloture-${todayStr}`,
      cloture_number: `Z-${todayStr.replace(/-/g, "")}-01`,
      date: todayStr,
      closed_at: now.toISOString(),
      closed_by_user_id: currentCashier.id,
      closed_by_user_name: currentCashier.name,
      closed_by_role: currentCashier.role,
      status: "ouverte",
      initial_cash_float_cents: initialCashFloatCents,
      sales_total_cents: salesTotal,
      rentals_total_cents: rentalsTotal,
      deposits_total_cents: depositsTotal,
      grand_total_cents: grandTotal,
      breakdown,
      theoretical_cash_cents: theoreticalCash,
      counted_cash_cents: countedCash,
      discrepancy_cents: discrepancy,
    };
  },

  validateTodayCloture: async (countedCashCents: number, operatorNotes?: string) => {
    const currentUser = useAuthStore.getState().currentUser;
    if (!currentUser) {
      throw new Error("Opération impossible : aucun utilisateur n'est actuellement authentifié.");
    }

    if (isTauri()) {
      const closedSession = await invokeCommand<any>("close_cash_session", {
        dto: {
          session_id: null,
          utilisateur_id: currentUser.id,
          counted_cash_cents: countedCashCents,
          operator_notes: operatorNotes || null,
        },
      });

      const finalized: ClotureCaisse = {
        id: closedSession.id,
        cloture_number: closedSession.cloture_number,
        date: closedSession.date,
        closed_at: closedSession.closed_at || new Date().toISOString(),
        closed_by_user_id: closedSession.closed_by_user_id || currentUser.id,
        closed_by_user_name: closedSession.closed_by_user_name || currentUser.full_name,
        closed_by_role: closedSession.closed_by_role || "Opérateur Caisse",
        status: "cloturee",
        initial_cash_float_cents: closedSession.initial_cash_float_cents,
        sales_total_cents: closedSession.sales_total_cents,
        rentals_total_cents: closedSession.rentals_total_cents,
        deposits_total_cents: closedSession.deposits_total_cents,
        grand_total_cents: closedSession.grand_total_cents,
        breakdown: closedSession.breakdown,
        theoretical_cash_cents: closedSession.theoretical_cash_cents,
        counted_cash_cents: closedSession.counted_cash_cents ?? countedCashCents,
        discrepancy_cents: closedSession.discrepancy_cents ?? (countedCashCents - closedSession.theoretical_cash_cents),
        operator_notes: closedSession.operator_notes,
      };

      set((state) => ({
        todayCloture: finalized,
        cloturesHistory: [finalized, ...state.cloturesHistory.filter((c) => c.id !== finalized.id)],
      }));

      return finalized;
    }

    // Mode hors Tauri (tests vitest) - pas de dbStorage.save
    const draft = get().getClotureDraft(countedCashCents);
    const finalized: ClotureCaisse = {
      ...draft,
      status: "cloturee",
      closed_at: new Date().toISOString(),
      closed_by_user_id: currentUser.id,
      closed_by_user_name: currentUser.full_name,
      counted_cash_cents: countedCashCents,
      discrepancy_cents: countedCashCents - draft.theoretical_cash_cents,
      operator_notes: operatorNotes,
    };

    set((state) => ({
      todayCloture: finalized,
      cloturesHistory: [finalized, ...state.cloturesHistory],
    }));

    return finalized;
  },

  reopenCaisse: () => {
    set({ todayCloture: null });
  },
}));
