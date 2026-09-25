import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AvailabilityMatrix } from "@/components/matrix/AvailabilityMatrix";
import { EssaiCabineModal } from "@/components/matrix/EssaiCabineModal";
import { ClientDetailModal } from "@/components/clients/ClientDetailModal";
import { useMatrixStore } from "@/store/matrixStore";
import { useClientStore } from "@/store/clientStore";
import * as tauriCore from "@tauri-apps/api/core";
import type { VariantAvailabilityMatrixRow, EssaiCabineDetailDto } from "@/types/matrix";

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockMatrixWithFitting: VariantAvailabilityMatrixRow[] = [
  {
    variante_id: "var-robe-01",
    article_id: "art-robe-01",
    article_nom: "Robe Sirène Soie Sauvage",
    reference: "ROB-SIRENE-01",
    taille: "38",
    sous_taille: null,
    statut_actuel: "disponible",
    slots: [
      {
        date_debut: "2026-09-15",
        date_fin: "2026-09-15",
        nature: "essayage",
        reference_id: "ess-001",
        reference_code: "ESS-2026-0001",
        description: "Essayage cabine (Mme Sarah B.)",
        client_nom: "Sarah Benali",
      },
    ],
  },
];

describe("LOT MOD-2 & MOD-3 — Intégration Essayage & Mensurations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMatrixStore.setState({
      startDate: "2026-09-14",
      daysCount: 30,
      rows: mockMatrixWithFitting,
      isLoading: false,
      searchQuery: "",
      selectedCategory: null,
      selectedArticleId: null,
      page: 1,
      pageSize: 20,
      loadMatrix: vi.fn(),
    });
  });

  it("affiche la légende 'Essayage cabine' dans la Matrice de Disponibilité", () => {
    render(<AvailabilityMatrix />);
    expect(screen.getByText("Essayage cabine")).toBeTruthy();
  });

  // Test J4 Vitest
  it("affiche le créneau essayage dans la Matrice avec sa couleur dédiée et ses informations au survol", async () => {
    render(<AvailabilityMatrix />);
    const slot = screen.getByTestId("slot-essayage");
    expect(slot).toBeTruthy();
    expect(slot.textContent).toContain("ESS");
    expect(slot.className).toContain("bg-status-fitting-bg");
    expect(slot.className).toContain("text-status-fitting");

    // Déclencher le survol sur la cellule de l'essayage
    const cell = screen.getByTestId("cell-var-robe-01-2026-09-15");
    fireEvent.mouseEnter(cell);

    // Vérifier les informations au survol affichées dans l'info-bulle (tooltip)
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain("Essayage cabine");
    expect(tooltip.textContent).toContain("ESS-2026-0001");
    expect(tooltip.textContent).toContain("Sarah Benali");
    expect(tooltip.textContent).toContain("Robe Sirène Soie Sauvage");
  });

  // Test I4 Vitest
  it("enregistre et réaffiche correctement les valeurs saisies dans le formulaire de mensurations", async () => {
    const mockInvoke = vi.mocked(tauriCore.invoke);
    let currentMensurations: any = null;

    mockInvoke.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === "get_client_mensurations_active") {
        return currentMensurations;
      }
      if (cmd === "get_client_mensurations_history") {
        return currentMensurations ? [currentMensurations] : [];
      }
      if (cmd === "get_client_rentals") {
        return [];
      }
      if (cmd === "create_client_mensurations") {
        currentMensurations = {
          id: "men-test-01",
          client_id: args.clientId,
          date_mesure: "2026-09-25",
          tour_poitrine: args.dto.tour_poitrine,
          tour_taille: args.dto.tour_taille,
          tour_hanches: args.dto.tour_hanches,
          stature: args.dto.stature,
          longueur_bras: args.dto.longueur_bras,
          longueur_jambe: args.dto.longueur_jambe,
          tour_cou: args.dto.tour_cou,
          pointure: args.dto.pointure,
          notes_morphologie: args.dto.notes_mensurations,
          est_actuel: 1,
          created_at: "2026-09-25T12:00:00Z",
        };
        return currentMensurations;
      }
      return null;
    });

    useClientStore.setState({
      isDetailModalOpen: true,
      selectedClient: {
        id: "cli-001",
        first_name: "Sarah",
        last_name: "Benali",
        phone: "0612345678",
        email: "sarah@example.com",
        address: "10 rue Royale",
        postal_code: "75008",
        city: "Paris",
        notes: "Note libre ancienne intacte",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        caution_total: 0,
        total_rentals: 0,
        status: "actif",
        avatar: "",
        rentals: [],
      } as any,
    });

    render(<ClientDetailModal />);

    // Section présente
    expect(screen.getByText("Mensurations & Profil Atelier")).toBeTruthy();

    // Ouvrir le formulaire de prise de mesure
    const addBtn = screen.getByText("Nouvelle mesure");
    fireEvent.click(addBtn);

    // Saisie des valeurs
    const poitrineInput = screen.getByPlaceholderText("88");
    fireEvent.change(poitrineInput, { target: { value: "90" } });

    const tailleInput = screen.getByPlaceholderText("68");
    fireEvent.change(tailleInput, { target: { value: "66" } });

    const hanchesInput = screen.getByPlaceholderText("94");
    fireEvent.change(hanchesInput, { target: { value: "95" } });

    const statureInput = screen.getByPlaceholderText("172");
    fireEvent.change(statureInput, { target: { value: "170" } });

    // Validation
    const saveBtn = screen.getByText("Sauvegarder");
    fireEvent.click(saveBtn);

    // Vérification de l'enregistrement IPC
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create_client_mensurations",
        expect.objectContaining({
          clientId: "cli-001",
          dto: expect.objectContaining({
            tour_poitrine: 90,
            tour_taille: 66,
            tour_hanches: 95,
            stature: 170,
          }),
        })
      );
    });

    // Vérification du réaffichage des valeurs enregistrées
    await waitFor(() => {
      expect(screen.getByText("90 cm")).toBeTruthy();
      expect(screen.getByText("66 cm")).toBeTruthy();
      expect(screen.getByText("95 cm")).toBeTruthy();
      expect(screen.getByText("170 cm")).toBeTruthy();
    });
  });

  it("permet de soumettre la mise en cabine d'une pièce via EssaiCabineModal", async () => {
    const mockInvoke = vi.mocked(tauriCore.invoke);
    mockInvoke.mockResolvedValueOnce([]); // list_clients
    mockInvoke.mockResolvedValueOnce({ id: "ess-test", numero_essai: "ESS-2026-0002" });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <EssaiCabineModal
        isOpen={true}
        onClose={handleClose}
        varianteId="var-robe-01"
        articleNom="Robe Sirène Soie Sauvage"
        articleRef="ROB-SIRENE-01"
        taille="38"
        activeEssai={null}
        onSuccess={handleSuccess}
      />
    );

    expect(screen.getByText("Mise en cabine d'essayage")).toBeTruthy();

    const startBtn = screen.getByText("Lancer l'essayage en cabine");
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create_essai_cabine",
        expect.objectContaining({
          dto: expect.objectContaining({
            variante_id: "var-robe-01",
          }),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it("permet de clôturer un essayage avec retouche et enchaînement atelier", async () => {
    const mockInvoke = vi.mocked(tauriCore.invoke);
    mockInvoke.mockResolvedValueOnce([]); // list_clients
    mockInvoke.mockResolvedValueOnce({ id: "ess-001", statut: "termine", resultat: "retouche_necessaire" });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    const activeEssai: EssaiCabineDetailDto = {
      id: "ess-001",
      numero_essai: "ESS-2026-0001",
      variante_id: "var-robe-01",
      article_id: "art-robe-01",
      article_nom: "Robe Sirène Soie Sauvage",
      article_reference: "ROB-SIRENE-01",
      taille: "38",
      client_id: "cli-001",
      client_nom: "Sarah Benali",
      date_debut: "2026-09-15T14:00:00Z",
      date_fin_prevue: "2026-09-15T15:00:00Z",
      date_fin_effective: null,
      statut: "en_cours",
      resultat: null,
      pressing_envoi_id: null,
      notes: null,
      created_at: "2026-09-15T14:00:00Z",
    };

    render(
      <EssaiCabineModal
        isOpen={true}
        onClose={handleClose}
        varianteId="var-robe-01"
        articleNom="Robe Sirène Soie Sauvage"
        articleRef="ROB-SIRENE-01"
        taille="38"
        activeEssai={activeEssai}
        onSuccess={handleSuccess}
      />
    );

    expect(screen.getByText("Clôture essayage ESS-2026-0001")).toBeTruthy();

    // Cliquer sur le bouton "Retouche"
    const retoucheBtn = screen.getByText("Retouche");
    fireEvent.click(retoucheBtn);

    expect(screen.getByText("Transférer immédiatement en atelier de retouche (statut : en_retouche)")).toBeTruthy();

    const finishBtn = screen.getByText("Valider la sortie de cabine");
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "finish_essai_cabine",
        expect.objectContaining({
          dto: expect.objectContaining({
            essai_id: "ess-001",
            resultat: "retouche_necessaire",
            envoyer_retouche: true,
          }),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
    });
  });
});
