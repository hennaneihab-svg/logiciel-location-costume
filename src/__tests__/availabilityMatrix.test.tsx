import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { AvailabilityMatrix } from "@/components/matrix/AvailabilityMatrix";
import { useMatrixStore } from "@/store/matrixStore";
import { useRentalStore } from "@/store/rentalStore";
import * as tauriService from "@/services/tauri";
import type { VariantAvailabilityMatrixRow } from "@/types/matrix";
import type { RentalContract } from "@/types/rental";

const mockMatrixData: VariantAvailabilityMatrixRow[] = [
  {
    variante_id: "var-test-01",
    article_id: "art-test-01",
    article_nom: "Smoking Col Châle Soie Noir",
    reference: "SMK-NOIR-01",
    taille: "48",
    sous_taille: "Drop 7",
    statut_actuel: "disponible",
    slots: [
      {
        date_debut: "2026-09-18",
        date_fin: "2026-09-22",
        nature: "location",
        reference_id: "loc-test-01",
        reference_code: "LOC-2026-0001",
        description: "Contrat de location LOC-2026-0001",
        client_nom: "Alexandre De La Tour",
      },
      {
        date_debut: "2026-09-22",
        date_fin: "2026-09-25",
        nature: "pressing",
        reference_id: "loc-test-01",
        reference_code: "TAMPON-LOC-2026-0001",
        description: "Tampon pressing automatique après restitution",
        client_nom: "Alexandre De La Tour",
      },
    ],
  },
  {
    variante_id: "var-test-02",
    article_id: "art-test-02",
    article_nom: "Costume 3P Prince de Galles",
    reference: "CST-3P-GRIS",
    taille: "52",
    sous_taille: "Drop 8",
    statut_actuel: "en_retard",
    slots: [
      {
        date_debut: "2026-09-14",
        date_fin: "2026-09-16",
        nature: "retard",
        reference_id: "loc-test-02",
        reference_code: "LOC-2026-0002",
        description: "Retard de restitution constaté",
        client_nom: "Jean-Pierre Laurent",
      },
    ],
  },
];

const mockContracts: RentalContract[] = [
  {
    id: "loc-test-01",
    contract_number: "LOC-2026-0001",
    customer_id: "cli-001",
    customer_name: "Alexandre De La Tour",
    customer_phone: "06 12 34 56 78",
    status: "reserve",
    pickup_date: "2026-09-18",
    return_date_scheduled: "2026-09-22",
    total_rental_cents: 18000,
    cleaning_fee_cents: 0,
    late_fee_cents: 0,
    damage_fee_cents: 0,
    total_amount_cents: 18000,
    paid_amount_cents: 18000,
    remaining_amount_cents: 0,
    deposit_amount_cents: 45000,
    deposit_status: "non_recue",
    deposit_method: "empreinte_cb",
    payment_method: "carte_bancaire",
    discount_cents: 0,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    items: [
      {
        variant_id: "var-test-01",
        article_id: "art-test-01",
        article_name: "Smoking Col Châle Soie Noir",
        reference: "SMK-NOIR-01",
        barcode: "BAR-SMK-001-48",
        size: "48",
        unit_price_cents: 18000,
        deposit_cents: 45000,
        cleaning_fee_cents: 1500,
        pickup_condition: "excellent",
        is_returned: false,
      },
    ],
  },
  {
    id: "loc-test-02",
    contract_number: "LOC-2026-0002",
    customer_id: "cli-002",
    customer_name: "Jean-Pierre Laurent",
    customer_phone: "06 98 76 54 32",
    status: "en_retard",
    pickup_date: "2026-09-10",
    return_date_scheduled: "2026-09-14",
    total_rental_cents: 16500,
    cleaning_fee_cents: 0,
    late_fee_cents: 2000,
    damage_fee_cents: 0,
    total_amount_cents: 18500,
    paid_amount_cents: 16500,
    remaining_amount_cents: 2000,
    deposit_amount_cents: 42000,
    deposit_status: "non_recue",
    deposit_method: "cheque",
    payment_method: "carte_bancaire",
    discount_cents: 0,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    items: [],
  },
];

describe("LOT MATRICE PARTIE B — AvailabilityMatrix Frontend & Store Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Configuration de base du store avec date de référence fixe
    useMatrixStore.setState({
      startDate: "2026-09-14",
      daysCount: 30,
      rows: mockMatrixData,
      isLoading: false,
      error: null,
      searchQuery: "",
      selectedCategory: null,
      selectedArticleId: null,
      page: 1,
      pageSize: 20,
      selectedContractId: null,
      selectedContractCode: null,
    });

    useRentalStore.setState({
      contracts: mockContracts,
    });
  });

  it("B3.1 : affiche correctement les créneaux avec location + pressing consécutifs et retard", async () => {
    render(<AvailabilityMatrix />);

    // 1. Vérification de la présence des références des variantes
    expect(screen.getAllByText("Smoking Col Châle Soie Noir").length).toBeGreaterThan(0);
    expect(screen.getByText("Costume 3P Prince de Galles")).toBeTruthy();
    expect(screen.getAllByText("SMK-NOIR-01").length).toBeGreaterThan(0);
    expect(screen.getByText("CST-3P-GRIS")).toBeTruthy();

    // 2. Vérification des créneaux Location et Pressing consécutifs
    const locationSlots = screen.getAllByTestId("slot-location");
    expect(locationSlots.length).toBeGreaterThan(0);

    const pressingSlots = screen.getAllByTestId("slot-pressing");
    expect(pressingSlots.length).toBeGreaterThan(0);

    // 3. Vérification du créneau Retard
    const retardSlots = screen.getAllByTestId("slot-retard");
    expect(retardSlots.length).toBeGreaterThan(0);

    // 4. Vérification de la mention de l'horizon glissant de 30 jours
    expect(screen.getByText(/Horizon glissant de 30 jours/i)).toBeTruthy();
  });

  it("B3.2 : le clic sur un bloc location déclenche bien l'ouverture de la fiche contrat attendue", async () => {
    render(<AvailabilityMatrix />);

    // Trouver le bloc de la location
    const locationSlots = screen.getAllByTestId("slot-location");
    expect(locationSlots.length).toBeGreaterThan(0);

    // Clic utilisateur sur le premier bloc location
    fireEvent.click(locationSlots[0]);

    // La modal de consultation rapide du contrat doit s'ouvrir avec le numéro de contrat
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.getByText(/Fiche Contrat LOC-2026-0001/i)).toBeTruthy();
      expect(screen.getByText("Alexandre De La Tour")).toBeTruthy();
      expect(screen.getByText("06 12 34 56 78")).toBeTruthy();
      expect(screen.getByText(/Ouvrir Bon de Location \(PDF\)/i)).toBeTruthy();
    });

    // Fermeture de la modal
    const closeBtn = screen.getByText("Fermer");
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("B3.3 : la navigation temporelle modifie la période et recharge la matrice", async () => {
    const invokeSpy = vi.spyOn(tauriService, "invokeCommand").mockResolvedValue(mockMatrixData);
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

    render(<AvailabilityMatrix />);

    // Clic sur bouton avancer de 7 jours
    const nextWeekBtn = screen.getByTitle("Avancer de 7 jours");
    fireEvent.click(nextWeekBtn);

    // Date de début décalée au 2026-09-21 (14 + 7 jours)
    await waitFor(() => {
      expect(useMatrixStore.getState().startDate).toBe("2026-09-21");
      expect(invokeSpy).toHaveBeenCalledWith("get_availability_matrix", expect.objectContaining({
        dateDebut: "2026-09-21",
        dateFin: "2026-10-20",
      }));
    });
  });

  it("B3.4 : le filtre textuel filtre instantanément les variantes affichées", async () => {
    render(<AvailabilityMatrix />);

    expect(screen.getByText("Costume 3P Prince de Galles")).toBeTruthy();

    // Recherche "Prince"
    const searchInput = screen.getByPlaceholderText("Filtrer modèle, taille, réf...");
    fireEvent.change(searchInput, { target: { value: "Prince" } });

    await waitFor(() => {
      expect(screen.queryByText("Smoking Col Châle Soie Noir")).toBeNull();
      expect(screen.getByText("Costume 3P Prince de Galles")).toBeTruthy();
    });
  });

  it("C4.1 : drag-and-drop vers une plage libre -> modale de confirmation -> validation -> mise à jour visuelle après succès", async () => {
    const toastSuccessSpy = vi.spyOn(toast, "success");
    const rescheduleSpy = vi.spyOn(useMatrixStore.getState(), "rescheduleRental").mockResolvedValue({
      success: true,
      location_id: "LOC-2026-0001",
      numero_location: "LOC-2026-0001",
      current_variant_id: "var-001",
      target_variant_id: "var-001",
      new_pickup_date: "2026-09-26",
      new_return_date: "2026-09-30",
      message: "Reprogrammation réussie",
    });

    render(<AvailabilityMatrix />);

    const locationSlot = screen.getAllByTestId("slot-location")[0];
    const targetCell = screen.getByTestId("cell-var-001-2026-09-26");

    // Simuler le drag and drop vers la case libre 2026-09-26
    fireEvent.dragStart(locationSlot);
    fireEvent.dragOver(targetCell);
    fireEvent.drop(targetCell);

    // La modale de confirmation doit s'ouvrir
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(screen.getByText(/Confirmer la reprogrammation/i)).toBeTruthy();
      expect(screen.getByText("2026-09-26")).toBeTruthy();
    });

    // Clic sur "Confirmer le déplacement"
    const confirmBtn = screen.getByText("Confirmer le déplacement");
    fireEvent.click(confirmBtn);

    // Vérifier l'appel à rescheduleRental et la fermeture de la modale
    await waitFor(() => {
      expect(rescheduleSpy).toHaveBeenCalledWith(expect.objectContaining({
        new_pickup_date: "2026-09-26",
        new_return_date: "2026-09-30",
      }));
      expect(toastSuccessSpy).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("C4.2 : drag-and-drop vers une plage en conflit -> annulation automatique avec message d'erreur affiché, aucun appel d'écriture déclenché", async () => {
    const toastErrorSpy = vi.spyOn(toast, "error");
    const rescheduleSpy = vi.spyOn(useMatrixStore.getState(), "rescheduleRental");

    render(<AvailabilityMatrix />);

    const locationSlot = screen.getAllByTestId("slot-location")[0];
    // Cellule occupée par un créneau de retard sur var-002 au 2026-09-14
    const conflictCell = screen.getByTestId("cell-var-002-2026-09-14");

    // Simuler le drag and drop vers la case en conflit
    fireEvent.dragStart(locationSlot);
    fireEvent.dragOver(conflictCell);
    fireEvent.drop(conflictCell);

    // Doit être immédiatement rejeté : pas de modale de confirmation, toast d'erreur affiché
    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(rescheduleSpy).not.toHaveBeenCalled();
    });
  });
});
