import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RentalPaymentModal } from "@/components/rentals/RentalPaymentModal";
import { useRentalStore } from "@/store/rentalStore";
import { useAuthStore } from "@/store/authStore";
import * as tauriService from "@/services/tauri";
import type { RentalContract } from "@/types/rental";

const mockContractWithBalance: RentalContract = {
  id: "loc-test-01",
  contract_number: "LOC-2026-0001",
  customer_id: "cli-001",
  customer_name: "Karim Benzema",
  customer_phone: "0550123456",
  status: "en_cours",
  pickup_date: "2026-10-01",
  return_date_scheduled: "2026-10-05",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  total_rental_cents: 18000,
  cleaning_fee_cents: 0,
  late_fee_cents: 0,
  damage_fee_cents: 0,
  total_amount_cents: 18000,
  paid_amount_cents: 11000,
  remaining_amount_cents: 7000,
  deposit_amount_cents: 20000,
  deposit_method: "especes",
  deposit_status: "non_recue",
  payment_method: "especes",
  discount_cents: 0,
  items: [],
};

const mockContractFullyPaid: RentalContract = {
  ...mockContractWithBalance,
  id: "loc-test-02",
  contract_number: "LOC-2026-0002",
  paid_amount_cents: 18000,
  remaining_amount_cents: 0,
  deposit_amount_cents: 25000,
};

describe("D3 — Tests Vitest RentalPaymentModal & recordContractPayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      currentUser: {
        id: "usr-admin-01",
        username: "admin",
        full_name: "Administrateur Test",
        role: "admin",
        is_active: true,
        password_hash: "hash",
        created_at: "2026-01-01T00:00:00Z",
      },
    });
  });

  describe("RentalPaymentModal.tsx", () => {
    it("affiche les types de paiement disponibles et pré-remplit le solde restant si solde > 0", () => {
      const handleClose = vi.fn();
      render(<RentalPaymentModal contract={mockContractWithBalance} onClose={handleClose} />);

      // Vérifie les types de paiement disponibles
      expect(screen.getByText("Règlement du Solde")).toBeTruthy();
      expect(screen.getByText("Encaissement Caution")).toBeTruthy();

      // Montant pré-rempli avec le solde restant (7 000)
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(input.value).toBe("7000");

      // Vérifie les labels de situation financière
      expect(screen.getByText("Reste Dû")).toBeTruthy();
    });

    it("pré-remplit automatiquement le montant avec la caution si le contrat est déjà soldé", () => {
      const handleClose = vi.fn();
      render(<RentalPaymentModal contract={mockContractFullyPaid} onClose={handleClose} />);

      // Montant pré-rempli avec la caution (25 000)
      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(input.value).toBe("25000");
    });

    it("permet de basculer interactivement entre le type solde et caution", () => {
      const handleClose = vi.fn();
      render(<RentalPaymentModal contract={mockContractWithBalance} onClose={handleClose} />);

      const input = screen.getByRole("spinbutton") as HTMLInputElement;
      expect(input.value).toBe("7000");

      // Clic sur "Encaissement Caution"
      fireEvent.click(screen.getByText("Encaissement Caution"));
      expect(input.value).toBe("20000");

      // Clic retour sur "Règlement du Solde"
      fireEvent.click(screen.getByText("Règlement du Solde"));
      expect(input.value).toBe("7000");
    });

    it("permet de sélectionner n'importe quel moyen de paiement parmi les 4 disponibles", () => {
      const handleClose = vi.fn();
      render(<RentalPaymentModal contract={mockContractWithBalance} onClose={handleClose} />);

      // Vérification des 4 moyens de paiement
      expect(screen.getByText("Espèces")).toBeTruthy();
      expect(screen.getByText("Carte")).toBeTruthy();
      expect(screen.getByText("Chèque")).toBeTruthy();
      expect(screen.getByText("Virement")).toBeTruthy();

      // Clic sur "Espèces"
      const especesBtn = screen.getByText("Espèces");
      fireEvent.click(especesBtn);
      expect(especesBtn.className).toContain("bg-foreground");

      // Clic sur "Virement"
      const virementBtn = screen.getByText("Virement");
      fireEvent.click(virementBtn);
      expect(virementBtn.className).toContain("bg-foreground");
      expect(especesBtn.className).not.toContain("bg-foreground");
    });

    it("soumet le formulaire et appelle recordContractPayment avec les bons paramètres", async () => {
      const handleClose = vi.fn();
      const recordPaymentSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(useRentalStore.getState(), "recordContractPayment").mockImplementation(recordPaymentSpy);

      render(<RentalPaymentModal contract={mockContractWithBalance} onClose={handleClose} />);

      // Sélection espèces et changement montant à 5000
      fireEvent.click(screen.getByText("Espèces"));
      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "5000" } });

      // Clic soumission
      fireEvent.click(screen.getByText("Valider le règlement"));

      await waitFor(() => {
        expect(recordPaymentSpy).toHaveBeenCalledWith(
          "loc-test-01",
          5000,
          "solde",
          "especes",
          undefined
        );
      });
    });
  });

  describe("Store rentalStore — action recordContractPayment", () => {
    it("effectue l'appel IPC Tauri 'record_payment' avec le DTO structuré en environnement natif", async () => {
      vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

      let capturedCommand = "";
      let capturedPayload: any = null;

      vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd, args) => {
        capturedCommand = cmd;
        capturedPayload = args;
        return {} as any;
      });

      const loadContractsSpy = vi.spyOn(useRentalStore.getState(), "loadContracts").mockResolvedValue(undefined);

      await useRentalStore.getState().recordContractPayment(
        "loc-test-01",
        6000,
        "solde",
        "carte_bancaire",
        "Paiement partiel CB"
      );

      expect(capturedCommand).toBe("record_payment");
      expect(capturedPayload).toEqual({
        dto: {
          location_id: "loc-test-01",
          vente_id: null,
          utilisateur_id: "usr-admin-01",
          montant_centimes: 6000,
          type_paiement: "solde",
          moyen_paiement: "carte_bancaire",
          reference_transaction: null,
          notes: "Paiement partiel CB",
        },
      });
      expect(loadContractsSpy).toHaveBeenCalledTimes(1);
    });

    it("remonte fidèlement toute erreur IPC à l'UI sans repli silencieux", async () => {
      vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

      const errorMessage = "Erreur fatale SQLite : verrouillage base de données";
      vi.spyOn(tauriService, "invokeCommand").mockRejectedValue(new Error(errorMessage));

      await expect(
        useRentalStore.getState().recordContractPayment(
          "loc-test-01",
          3000,
          "solde",
          "especes"
        )
      ).rejects.toThrow(errorMessage);

      // Vérifie que l'indicateur de chargement n'est pas resté bloqué à true
      expect(useRentalStore.getState().isLoading).toBe(false);
    });

    it("recharge obligatoirement la liste des contrats après un succès IPC", async () => {
      vi.spyOn(tauriService, "isTauri").mockReturnValue(true);
      vi.spyOn(tauriService, "invokeCommand").mockResolvedValue({} as any);

      let loadCalled = false;
      vi.spyOn(useRentalStore.getState(), "loadContracts").mockImplementation(async () => {
        loadCalled = true;
      });

      await useRentalStore.getState().recordContractPayment(
        "loc-test-01",
        4000,
        "solde",
        "especes"
      );

      expect(loadCalled).toBe(true);
    });
  });
});
