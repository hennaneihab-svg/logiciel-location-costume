import { create } from "zustand";
import type {
  RentalContract,
  RentalContractStatus,
  NewRentalFormInput,
  RentalArticleItem,
} from "@/types/rental";
import { useStockStore } from "@/store/stockStore";
import { useClientStore } from "@/store/clientStore";
import { calculateRentalDays } from "@/lib/utils";
import { dbStorage } from "@/services/dbStorage";

interface RentalStoreState {
  contracts: RentalContract[];
  selectedContractForPdf: RentalContract | null;
  selectedContractForReturn: RentalContract | null;
  activeFilter: "all" | "en_cours" | "reserve" | "en_retard" | "retourne";
  searchQuery: string;

  // Modals
  isCreateRentalModalOpen: boolean;
  isPdfPreviewModalOpen: boolean;
  isReturnModalOpen: boolean;

  // Actions
  setFilter: (
    filter: "all" | "en_cours" | "reserve" | "en_retard" | "retourne"
  ) => void;
  setSearchQuery: (q: string) => void;
  setCreateRentalModalOpen: (open: boolean) => void;
  setPdfPreviewModalOpen: (
    open: boolean,
    contract?: RentalContract | null
  ) => void;
  setReturnModalOpen: (open: boolean, contract?: RentalContract | null) => void;

  checkVariantAvailability: (
    variantId: string,
    pickupDate: string,
    returnDate: string,
    excludeContractId?: string
  ) => { available: boolean; conflictReason?: string };

  createRentalContract: (
    input: NewRentalFormInput
  ) => Promise<RentalContract>;

  processReturn: (
    contractId: string,
    itemsReturnData: {
      variant_id: string;
      condition: "bon_etat" | "a_nettoyer" | "endommage";
      damage_fee_cents: number;
      damage_notes?: string;
    }[]
  ) => void;
}

// 15 contrats initiaux complets et réalistes
const INITIAL_CONTRACTS: RentalContract[] = [
  {
    id: "loc-013",
    contract_number: "LOC-2026-0013",
    customer_id: "cli-001",
    customer_name: "Jean Dupont",
    customer_phone: "06 12 34 56 78",
    customer_email: "jean.dupont@gmail.com",
    customer_address: "14 Rue de la Paix, 75002 Paris",
    customer_cni: "CNI-FR-220975102934",
    status: "en_cours",
    event_date: "2026-09-13",
    pickup_date: "2026-09-11",
    return_date_scheduled: "2026-09-15",
    items: [
      {
        variant_id: "var-008",
        article_id: "art-005",
        article_name: "Costume 3 Pièces Bleu Royal Cérémonie",
        reference: "CST-3P-ROYAL",
        barcode: "BAR-CST-005-50",
        size: "50",
        sub_size: "Drop 7",
        unit_price_cents: 15000,
        deposit_cents: 40000,
        cleaning_fee_cents: 1200,
        pickup_condition: "excellent",
        is_returned: false,
      },
    ],
    total_rental_cents: 15000,
    cleaning_fee_cents: 1200,
    discount_cents: 0,
    late_fee_cents: 0,
    damage_fee_cents: 0,
    total_amount_cents: 15000,
    deposit_amount_cents: 40000,
    deposit_status: "cheque_retenu",
    deposit_method: "cheque",
    deposit_notes: "Chèque en coffre",
    paid_amount_cents: 15000,
    payment_method: "carte_bancaire",
    remaining_amount_cents: 0,
    notes: "Retour attendu le 15/09",
    created_at: "2026-09-06T10:00:00.000Z",
    updated_at: "2026-09-11T14:20:00.000Z",
  },
  {
    id: "loc-012",
    contract_number: "LOC-2026-0012",
    customer_id: "cli-005",
    customer_name: "Lucas Bernard",
    customer_phone: "07 11 33 55 77",
    customer_email: "lucas.bernard@free.fr",
    customer_address: "12 Allée des Tilleuls, 92100 Boulogne",
    customer_cni: "CNI-FR-230192847102",
    status: "en_cours",
    event_date: "2026-09-12",
    pickup_date: "2026-09-11",
    return_date_scheduled: "2026-09-14",
    items: [
      {
        variant_id: "var-018",
        article_id: "art-013",
        article_name: "Richelieu Bout Droit Cuir Glacé Noir",
        reference: "CHS-RCH-GLAC",
        barcode: "BAR-CHS-013-43",
        size: "43",
        sub_size: "Bout droit",
        unit_price_cents: 6000,
        deposit_cents: 18000,
        cleaning_fee_cents: 500,
        pickup_condition: "bon",
        is_returned: false,
      },
    ],
    total_rental_cents: 6000,
    cleaning_fee_cents: 500,
    discount_cents: 0,
    late_fee_cents: 0,
    damage_fee_cents: 0,
    total_amount_cents: 6000,
    deposit_amount_cents: 18000,
    deposit_status: "empreinte_cb",
    deposit_method: "empreinte_cb",
    paid_amount_cents: 6000,
    payment_method: "carte_bancaire",
    remaining_amount_cents: 0,
    notes: "Retour attendu aujourd'hui 14/09 !",
    created_at: "2026-09-05T11:00:00.000Z",
    updated_at: "2026-09-11T16:30:00.000Z",
  },
  {
    id: "loc-011",
    contract_number: "LOC-2026-0011",
    customer_id: "cli-006",
    customer_name: "Marc Lefebvre",
    customer_phone: "06 44 22 11 00",
    customer_email: "marc.lefebvre@wanadoo.fr",
    customer_address: "45 Rue Nationale, 59000 Lille",
    customer_cni: "CNI-FR-180959281723",
    status: "en_retard",
    event_date: "2026-09-10",
    pickup_date: "2026-09-08",
    return_date_scheduled: "2026-09-12",
    items: [
      {
        variant_id: "var-002",
        article_id: "art-001",
        article_name: "Smoking Col Châle Soie Noir",
        reference: "SMK-NOIR-01",
        barcode: "BAR-SMK-001-50",
        size: "50",
        sub_size: "Drop 7",
        unit_price_cents: 18000,
        deposit_cents: 45000,
        cleaning_fee_cents: 1500,
        pickup_condition: "excellent",
        is_returned: false,
      },
    ],
    total_rental_cents: 18000,
    cleaning_fee_cents: 1500,
    discount_cents: 0,
    late_fee_cents: 4000,
    damage_fee_cents: 0,
    total_amount_cents: 22000,
    deposit_amount_cents: 45000,
    deposit_status: "cheque_retenu",
    deposit_method: "cheque",
    paid_amount_cents: 18000,
    payment_method: "carte_bancaire",
    remaining_amount_cents: 4000,
    notes: "Non restitué le 12/09 ! +4 000 DA pénalité de retard appliquée",
    created_at: "2026-09-01T15:00:00.000Z",
    updated_at: "2026-09-14T09:00:00.000Z",
  },
  {
    id: "loc-014",
    contract_number: "LOC-2026-0014",
    customer_id: "cli-002",
    customer_name: "Alexandre Mercier",
    customer_phone: "07 98 76 54 32",
    customer_email: "alex.mercier@orange.fr",
    customer_address: "8 Avenue des États-Unis, 78000 Versailles",
    customer_cni: "PASS-FR-19AB89201",
    status: "reserve",
    event_date: "2026-09-19",
    pickup_date: "2026-09-17",
    return_date_scheduled: "2026-09-21",
    items: [
      {
        variant_id: "var-005",
        article_id: "art-002",
        article_name: "Smoking Midnight Blue Col Pointe",
        reference: "SMK-BLEU-02",
        barcode: "BAR-SMK-002-52",
        size: "52",
        sub_size: "Standard",
        unit_price_cents: 19000,
        deposit_cents: 50000,
        cleaning_fee_cents: 1500,
        pickup_condition: "excellent",
        is_returned: false,
      },
    ],
    total_rental_cents: 19000,
    cleaning_fee_cents: 1500,
    discount_cents: 0,
    late_fee_cents: 0,
    damage_fee_cents: 0,
    total_amount_cents: 19000,
    deposit_amount_cents: 50000,
    deposit_status: "empreinte_cb",
    deposit_method: "empreinte_cb",
    paid_amount_cents: 5000,
    payment_method: "carte_bancaire",
    remaining_amount_cents: 14000,
    notes: "Acompte versé, solde au départ",
    created_at: "2026-09-08T15:00:00.000Z",
    updated_at: "2026-09-08T15:00:00.000Z",
  },
  {
    id: "loc-015",
    contract_number: "LOC-2026-0015",
    customer_id: "cli-003",
    customer_name: "Maxime Laroche",
    customer_phone: "06 55 44 33 22",
    customer_email: "max.laroche@outlook.com",
    customer_address: "25 Boulevard Victor Hugo, 92200 Neuilly",
    customer_cni: "PERM-FR-8409124401",
    status: "reserve",
    event_date: "2026-09-21",
    pickup_date: "2026-09-19",
    return_date_scheduled: "2026-09-23",
    items: [
      {
        variant_id: "var-007",
        article_id: "art-004",
        article_name: "Smoking Velours Vert Émeraude",
        reference: "SMK-VERT-04",
        barcode: "BAR-SMK-004-50",
        size: "50",
        sub_size: "Standard",
        unit_price_cents: 19500,
        deposit_cents: 50000,
        cleaning_fee_cents: 2000,
        pickup_condition: "excellent",
        is_returned: false,
      },
    ],
    total_rental_cents: 19500,
    cleaning_fee_cents: 2000,
    discount_cents: 0,
    late_fee_cents: 0,
    damage_fee_cents: 0,
    total_amount_cents: 19500,
    deposit_amount_cents: 50000,
    deposit_status: "non_recue",
    deposit_method: "empreinte_cb",
    paid_amount_cents: 5000,
    payment_method: "carte_bancaire",
    remaining_amount_cents: 14500,
    notes: "Acompte versé",
    created_at: "2026-09-10T16:00:00.000Z",
    updated_at: "2026-09-10T16:00:00.000Z",
  },
  {
    id: "loc-010",
    contract_number: "LOC-2026-0010",
    customer_id: "cli-004",
    customer_name: "Thomas Martin",
    customer_phone: "06 99 88 77 66",
    customer_email: "thomas.martin@sfr.fr",
    customer_address: "3 Rue de la République, 69002 Lyon",
    customer_cni: "CNI-FR-210469281923",
    status: "retourne",
    event_date: "2026-09-05",
    pickup_date: "2026-09-03",
    return_date_scheduled: "2026-09-07",
    return_date_actual: "2026-09-07",
    items: [
      {
        variant_id: "var-004",
        article_id: "art-002",
        article_name: "Smoking Midnight Blue Col Pointe",
        reference: "SMK-BLEU-02",
        barcode: "BAR-SMK-002-50",
        size: "50",
        sub_size: "Standard",
        unit_price_cents: 19000,
        deposit_cents: 50000,
        cleaning_fee_cents: 1500,
        pickup_condition: "excellent",
        return_condition: "bon_etat",
        is_returned: true,
        return_date: "2026-09-07",
      },
    ],
    total_rental_cents: 19000,
    cleaning_fee_cents: 1500,
    discount_cents: 0,
    late_fee_cents: 0,
    damage_fee_cents: 0,
    total_amount_cents: 19000,
    deposit_amount_cents: 50000,
    deposit_status: "restituee",
    deposit_method: "cheque",
    paid_amount_cents: 19000,
    payment_method: "carte_bancaire",
    remaining_amount_cents: 0,
    notes: "Restitué conforme et dans les délais",
    created_at: "2026-08-28T14:00:00.000Z",
    updated_at: "2026-09-07T17:30:00.000Z",
  },
];

export const useRentalStore = create<RentalStoreState>((set, get) => ({
  contracts: dbStorage.load<RentalContract[]>(dbStorage.KEYS.CONTRACTS, INITIAL_CONTRACTS),
  selectedContractForPdf: null,
  selectedContractForReturn: null,
  activeFilter: "all",
  searchQuery: "",

  isCreateRentalModalOpen: false,
  isPdfPreviewModalOpen: false,
  isReturnModalOpen: false,

  setFilter: (activeFilter) => set({ activeFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCreateRentalModalOpen: (open) => set({ isCreateRentalModalOpen: open }),

  setPdfPreviewModalOpen: (open, contract) =>
    set({
      isPdfPreviewModalOpen: open,
      selectedContractForPdf: contract || null,
    }),

  setReturnModalOpen: (open, contract) =>
    set({
      isReturnModalOpen: open,
      selectedContractForReturn: contract || null,
    }),

  checkVariantAvailability: (
    variantId,
    pickupDate,
    returnDate,
    excludeContractId
  ) => {
    const stockArticles = useStockStore.getState().articles;

    // 1. Trouver la variante dans le stock
    let targetVariant = null;
    for (const art of stockArticles) {
      const v = art.variants.find((item) => item.id === variantId);
      if (v) {
        targetVariant = v;
        break;
      }
    }

    if (!targetVariant) {
      return { available: false, conflictReason: "Variante introuvable en stock." };
    }

    // Si la variante est physiquement au pressing ou en retouche
    if (targetVariant.status === "au_pressing") {
      return {
        available: false,
        conflictReason: "Cette pièce est actuellement au pressing (nettoyage).",
      };
    }
    if (targetVariant.status === "en_retouche" || targetVariant.status === "indisponible") {
      return {
        available: false,
        conflictReason: "Cette pièce est en cours de réparation / indisponible.",
      };
    }

    // 2. Vérification des chevauchements de dates avec les contrats actifs
    const targetStart = new Date(pickupDate).getTime();
    const targetEnd = new Date(returnDate).getTime();

    const activeContracts = get().contracts.filter(
      (c) =>
        c.id !== excludeContractId &&
        (c.status === "reserve" || c.status === "en_cours" || c.status === "en_retard")
    );

    for (const c of activeContracts) {
      const hasVariant = c.items.some((item) => item.variant_id === variantId);
      if (hasVariant) {
        const contractStart = new Date(c.pickup_date).getTime();
        const contractEnd = new Date(c.return_date_scheduled).getTime();

        // Chevauchement : start1 <= end2 && end1 >= start2
        if (targetStart <= contractEnd && targetEnd >= contractStart) {
          return {
            available: false,
            conflictReason: `Conflit de date avec le contrat ${c.contract_number} (${c.customer_name}) du ${c.pickup_date} au ${c.return_date_scheduled}.`,
          };
        }
      }
    }

    return { available: true };
  },

  createRentalContract: async (input) => {
    const clients = useClientStore.getState().clients;
    const client = clients.find((c) => c.id === input.customer_id);
    if (!client) throw new Error("Client sélectionné introuvable.");

    // Vérifier si le client est blacklisté
    if (client.is_blacklisted) {
      throw new Error(
        `CLIENT EN LISTE NOIRE : ${client.blacklist_reason || "Accès restreint"}`
      );
    }

    const stockArticles = useStockStore.getState().articles;

    const durationDays = calculateRentalDays(input.pickup_date, input.return_date_scheduled);

    // Rassembler les items sélectionnés
    const items: RentalArticleItem[] = [];
    let totalRentalCents = 0;
    let cleaningFeeTotalCents = 0;
    let defaultDepositCents = 0;

    for (const varId of input.selected_variant_ids) {
      // Test disponibilité
      const check = get().checkVariantAvailability(
        varId,
        input.pickup_date,
        input.return_date_scheduled
      );
      if (!check.available) {
        throw new Error(check.conflictReason || "Article indisponible.");
      }

      for (const art of stockArticles) {
        const v = art.variants.find((item) => item.id === varId);
        if (v) {
          const itemTotalRental = art.rental_price_cents * durationDays;
          items.push({
            variant_id: v.id,
            article_id: art.id,
            article_name: art.name,
            reference: art.reference,
            barcode: v.barcode,
            size: v.size,
            sub_size: v.sub_size,
            unit_price_cents: itemTotalRental,
            deposit_cents: art.deposit_price_cents,
            cleaning_fee_cents: art.cleaning_fee_cents,
            pickup_condition: v.condition_state,
            is_returned: false,
          });

          totalRentalCents += itemTotalRental;
          cleaningFeeTotalCents += art.cleaning_fee_cents;
          defaultDepositCents += art.deposit_price_cents;
          break;
        }
      }
    }

    if (items.length === 0) {
      throw new Error("Veuillez sélectionner au moins un article pour le contrat.");
    }

    const totalFactureCents = Math.max(
      0,
      totalRentalCents - (input.discount_cents || 0)
    );
    const paidCents = input.paid_amount_cents || 0;
    const remainingCents = Math.max(0, totalFactureCents - paidCents);

    // Détermination du statut initial : si le retrait est aujourd'hui ou dans le passé -> "en_cours", sinon -> "reserve"
    const todayStr = new Date().toISOString().split("T")[0];
    const isTodayOrPast = input.pickup_date <= todayStr;
    const contractStatus: RentalContractStatus = isTodayOrPast ? "en_cours" : "reserve";

    const nextNumber = `LOC-2026-${String(get().contracts.length + 10).padStart(4, "0")}`;

    const newContract: RentalContract = {
      id: `loc-${Date.now()}`,
      contract_number: nextNumber,
      customer_id: client.id,
      customer_name: `${client.first_name} ${client.last_name}`,
      customer_phone: client.phone,
      customer_email: client.email,
      customer_address: `${client.address}, ${client.postal_code} ${client.city}`,
      customer_cni: client.identity_card_number,
      status: contractStatus,
      event_date: input.event_date,
      pickup_date: input.pickup_date,
      return_date_scheduled: input.return_date_scheduled,
      items,
      total_rental_cents: totalRentalCents,
      cleaning_fee_cents: cleaningFeeTotalCents,
      discount_cents: input.discount_cents || 0,
      late_fee_cents: 0,
      damage_fee_cents: 0,
      total_amount_cents: totalFactureCents,
      deposit_amount_cents: input.deposit_amount_cents || defaultDepositCents,
      deposit_status: input.deposit_method === "empreinte_cb" ? "empreinte_cb" : "cheque_retenu",
      deposit_method: input.deposit_method,
      paid_amount_cents: paidCents,
      payment_method: input.payment_method,
      remaining_amount_cents: remainingCents,
      notes: input.notes,
      pdf_archived_path: `/bons/2026-09/BON-${nextNumber}.pdf`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Décrémentation du stock disponible
    const newVariantStatus = isTodayOrPast ? "en_location" : "reserve";
    for (const item of items) {
      useStockStore
        .getState()
        .changeVariantStatus(
          item.article_id,
          item.variant_id,
          newVariantStatus,
          `Réservé pour contrat ${nextNumber} (${newContract.customer_name})`
        );
    }

    // 2. Ajout au store des locations et persistance
    set((state) => {
      const updatedContracts = [newContract, ...state.contracts];
      dbStorage.save(dbStorage.KEYS.CONTRACTS, updatedContracts);
      return {
        contracts: updatedContracts,
        isCreateRentalModalOpen: false,
      };
    });

    // 3. Ouvrir directement la prévisualisation PDF
    set({
      selectedContractForPdf: newContract,
      isPdfPreviewModalOpen: true,
    });

    return newContract;
  },

  processReturn: (contractId, itemsReturnData) => {
    const contract = get().contracts.find((c) => c.id === contractId);
    if (!contract) return;

    let totalDamageFeeCents = 0;
    let anyDamage = false;

    const updatedItems = contract.items.map((item) => {
      const returnData = itemsReturnData.find((r) => r.variant_id === item.variant_id);
      if (!returnData) return item;

      if (returnData.condition === "endommage") {
        anyDamage = true;
        totalDamageFeeCents += returnData.damage_fee_cents || 0;
      }

      // Synchroniser le statut de la pièce dans le stock
      const newStockStatus =
        returnData.condition === "bon_etat"
          ? "disponible"
          : returnData.condition === "a_nettoyer"
          ? "au_pressing"
          : "en_retouche";

      useStockStore
        .getState()
        .changeVariantStatus(
          item.article_id,
          item.variant_id,
          newStockStatus,
          `Retour contrat ${contract.contract_number} : état ${returnData.condition} ${returnData.damage_notes ? `(${returnData.damage_notes})` : ""}`
        );

      return {
        ...item,
        is_returned: true,
        return_condition: returnData.condition,
        damage_fee_cents: returnData.damage_fee_cents,
        damage_notes: returnData.damage_notes,
        return_date: new Date().toISOString().split("T")[0],
      };
    });

    // Statut caution : si dégâts -> conservee_partiellement, sinon restituée
    const depositStatus =
      totalDamageFeeCents > 0
        ? totalDamageFeeCents >= contract.deposit_amount_cents
          ? "conservee_totalement"
          : "conservee_partiellement"
        : "restituee";

    const finalStatus: RentalContractStatus = anyDamage ? "litige" : "retourne";

    const updatedContract: RentalContract = {
      ...contract,
      status: finalStatus,
      return_date_actual: new Date().toISOString().split("T")[0],
      items: updatedItems,
      damage_fee_cents: totalDamageFeeCents,
      deposit_status: depositStatus,
      updated_at: new Date().toISOString(),
    };

    set((state) => {
      const newContracts = state.contracts.map((c) =>
        c.id === contractId ? updatedContract : c
      );
      dbStorage.save(dbStorage.KEYS.CONTRACTS, newContracts);
      return {
        contracts: newContracts,
        isReturnModalOpen: false,
        selectedContractForReturn: null,
      };
    });
  },
}));
