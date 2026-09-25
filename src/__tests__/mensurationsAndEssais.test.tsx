import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AvailabilityMatrix } from "@/components/matrix/AvailabilityMatrix";
import { EssaiCabineModal } from "@/components/matrix/EssaiCabineModal";
import { useMatrixStore } from "@/store/matrixStore";
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

  it("affiche le slot d'essayage avec l'indicatif ESS et la classe status-fitting", () => {
    render(<AvailabilityMatrix />);
    const slot = screen.getByTestId("slot-essayage");
    expect(slot).toBeTruthy();
    expect(slot.textContent).toContain("ESS");
    expect(slot.className).toContain("bg-status-fitting-bg");
    expect(slot.className).toContain("text-status-fitting");
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
