import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RentalTableView } from "@/components/rentals/RentalTableView";
import { useRentalStore } from "@/store/rentalStore";
import { useAuthStore } from "@/store/authStore";
import type { RentalContract } from "@/types/rental";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const mockReservedContractWithoutDeposit: RentalContract = {
  id: "loc-pickup-01",
  contract_number: "LOC-2026-PICKUP-01",
  customer_id: "cli-001",
  customer_name: "Yassine Mansour",
  customer_phone: "0612345678",
  status: "reserve",
  pickup_date: "2026-10-01",
  return_date_scheduled: "2026-10-05",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  total_rental_cents: 15000,
  cleaning_fee_cents: 0,
  late_fee_cents: 0,
  damage_fee_cents: 0,
  total_amount_cents: 15000,
  paid_amount_cents: 15000,
  remaining_amount_cents: 0,
  deposit_amount_cents: 30000,
  deposit_method: "empreinte_cb",
  deposit_status: "non_recue",
  payment_method: "carte_bancaire",
  discount_cents: 0,
  items: [
    {
      variant_id: "var-pk-01",
      article_id: "art-pk-01",
      article_name: "Smoking Noir Prestige",
      reference: "SMK-01",
      barcode: "BAR-SMK-01",
      size: "50",
      sub_size: "Regular",
      unit_price_cents: 15000,
      deposit_cents: 30000,
      cleaning_fee_cents: 0,
      pickup_condition: "neuf",
      is_returned: false,
    },
  ],
};

const mockReservedContractWithDeposit: RentalContract = {
  ...mockReservedContractWithoutDeposit,
  id: "loc-pickup-02",
  contract_number: "LOC-2026-PICKUP-02",
  deposit_status: "encaissee",
};

const mockInProgressContract: RentalContract = {
  ...mockReservedContractWithDeposit,
  id: "loc-pickup-03",
  contract_number: "LOC-2026-PICKUP-03",
  status: "en_cours",
};

describe("G3/G4 — Validation physique du retrait (validate_rental_pickup)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      currentUser: {
        id: "usr-admin-01",
        username: "admin",
        full_name: "Admin System",
        role: "admin",
        is_active: true,
        password_hash: "mock",
        created_at: "2026-01-01T00:00:00Z",
      },
    });
  });

  it("affiche le bouton 'Confirmer retrait' uniquement pour les contrats 'reserve'", () => {
    useRentalStore.setState({
      contracts: [mockReservedContractWithDeposit, mockInProgressContract],
      activeFilter: "all",
      searchQuery: "",
    });

    render(<RentalTableView />);

    // Bouton présent pour le contrat réservé
    const pickupBtn = screen.getByTestId("confirm-pickup-loc-pickup-02");
    expect(pickupBtn).toBeDefined();

    // Bouton absent pour le contrat en cours
    expect(screen.queryByTestId("confirm-pickup-loc-pickup-03")).toBeNull();
  });

  it("bloque la validation et affiche un message clair si la caution n'est pas reçue", async () => {
    useRentalStore.setState({
      contracts: [mockReservedContractWithoutDeposit],
      activeFilter: "all",
      searchQuery: "",
    });

    render(<RentalTableView />);

    const pickupBtn = screen.getByTestId("confirm-pickup-loc-pickup-01");
    fireEvent.click(pickupBtn);

    expect(toast.error).toHaveBeenCalledWith(
      "Caution non enregistrée — encaissez ou enregistrez la caution avant de valider le retrait"
    );

    // Le contrat doit rester 'reserve'
    const currentContract = useRentalStore.getState().contracts.find((c) => c.id === "loc-pickup-01");
    expect(currentContract?.status).toBe("reserve");
  });

  it("valide avec succès le retrait si la caution est reçue : transitionne en 'en_cours', met à jour le stock et affiche un toast de succès", async () => {
    useRentalStore.setState({
      contracts: [mockReservedContractWithDeposit],
      activeFilter: "all",
      searchQuery: "",
    });

    render(<RentalTableView />);

    const pickupBtn = screen.getByTestId("confirm-pickup-loc-pickup-02");
    fireEvent.click(pickupBtn);

    await waitFor(() => {
      const updated = useRentalStore.getState().contracts.find((c) => c.id === "loc-pickup-02");
      expect(updated?.status).toBe("en_cours");
      expect(updated?.pickup_date_actual).toBeDefined();
    });

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Retrait validé — contrat LOC-2026-PICKUP-02 passé en cours")
    );
  });
});
