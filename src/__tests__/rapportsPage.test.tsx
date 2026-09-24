import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RapportsPage } from "@/pages/RapportsPage";
import * as tauriService from "@/services/tauri";
import * as reportService from "@/services/reportService";
import type { RapportsOverviewDto } from "@/types/reports";

const mockOverview: RapportsOverviewDto = {
  periode: "mois",
  date_debut: "2026-10-01",
  date_fin: "2026-10-31",
  financier: {
    ca_total_centimes: 65000,
    ca_locations_centimes: 45000,
    ca_ventes_centimes: 20000,
    nombre_contrats: 4,
    nombre_ventes: 2,
    taux_retard_pourcentage: 25.0,
    panier_moyen_centimes: 10833,
  },
  caisse: {
    total_reglements_centimes: 55000,
    reglements_par_mode: [
      { moyen: "especes", label: "Espèces", montant_centimes: 35000, nb_transactions: 3 },
      { moyen: "carte_bancaire", label: "Carte Bancaire", montant_centimes: 20000, nb_transactions: 2 },
      { moyen: "cheque", label: "Chèque", montant_centimes: 0, nb_transactions: 0 },
      { moyen: "virement", label: "Virement", montant_centimes: 0, nb_transactions: 0 },
    ],
    nombre_transactions: 5,
  },
  stock: {
    valeur_totale_stock_centimes: 1200000,
    nombre_articles_total: 48,
    pieces_en_location: 12,
    pieces_en_pressing: 5,
    cout_pressing_centimes: 8500,
  },
};

describe("LOT RAPPORTS — Tests Vitest RapportsPage & reportService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche fidèlement les métriques réelles calculées par SQLite sans aucune valeur codée en dur", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);
    vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd: string) => {
      if (cmd === "get_rapports_overview") {
        return mockOverview as any;
      }
      return [] as any;
    });

    render(<RapportsPage />);

    // Attente du chargement
    await waitFor(() => {
      expect(screen.getByTestId("ca-total").textContent).toContain("65 000");
    });

    // 1. Métriques Financières
    expect(screen.getByTestId("ca-locations").textContent).toContain("45 000");
    expect(screen.getByTestId("ca-ventes").textContent).toContain("20 000");
    expect(screen.getByTestId("nb-contrats").textContent).toContain("4 loc. / 2 vte.");
    expect(screen.getByTestId("taux-retard").textContent).toContain("25%");

    // 2. Métriques Caisse
    expect(screen.getByTestId("total-reglements").textContent).toContain("55 000");
    expect(screen.getByTestId("nb-transactions").textContent).toContain("5 transaction(s)");
    expect(screen.getByText(/35 000/)).toBeTruthy();

    // 3. Métriques Stock
    expect(screen.getByTestId("valeur-stock").textContent).toContain("1 200 000");
    expect(screen.getByTestId("total-pieces").textContent).toContain("48 pièce(s)");
    expect(screen.getByTestId("pieces-location").textContent).toContain("12 pièce(s)");
    expect(screen.getByTestId("pieces-pressing").textContent).toContain("5 pièce(s)");
    expect(screen.getByTestId("cout-pressing").textContent).toContain("8 500");
  });

  it("re-déclenche l'appel IPC avec la période sélectionnée lors du clic sur un filtre temporel", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);
    const invokeSpy = vi.spyOn(tauriService, "invokeCommand").mockResolvedValue(mockOverview as any);

    render(<RapportsPage />);

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledWith("get_rapports_overview", expect.objectContaining({
        periode: "mois",
      }));
    });

    // Clic sur "7 jours"
    fireEvent.click(screen.getByText("7 jours"));

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledWith("get_rapports_overview", expect.objectContaining({
        periode: "semaine",
      }));
    });

    // Clic sur "Cette année"
    fireEvent.click(screen.getByText("Cette année"));

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledWith("get_rapports_overview", expect.objectContaining({
        periode: "annee",
      }));
    });
  });

  it("ouvre la modale d'aperçu et charge les transactions détaillées", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);
    vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd: string) => {
      if (cmd === "get_rapports_overview") return mockOverview as any;
      if (cmd === "get_financial_transactions_report") {
        return [
          {
            id: "tx-1",
            reference: "LOC-2026-0042",
            type_operation: "solde",
            client_nom: "Amine Bouzid",
            moyen_paiement: "especes",
            montant_centimes: 18000,
            date_operation: "2026-10-15T14:00:00Z",
            operateur_nom: "Jean-Philippe",
          },
        ];
      }
      return [] as any;
    });

    render(<RapportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("ca-total")).toBeTruthy();
    });

    // Clic sur le premier bouton "Aperçu"
    const apercuButtons = screen.getAllByText("Aperçu");
    fireEvent.click(apercuButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Aperçu du Rapport Financier")).toBeTruthy();
      expect(screen.getByText("LOC-2026-0042")).toBeTruthy();
      expect(screen.getByText("Amine Bouzid")).toBeTruthy();
      expect(screen.getByText(/18 000/)).toBeTruthy();
    });
  });

  it("déclenche l'export CSV avec le nom et les données conformes à la période sélectionnée", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);
    vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd: string) => {
      if (cmd === "get_rapports_overview") return mockOverview as any;
      if (cmd === "get_financial_transactions_report") return [] as any;
      return [] as any;
    });
    const exportCsvSpy = vi.spyOn(reportService, "exportFinancialReportCsv").mockImplementation(() => {});

    render(<RapportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("ca-total")).toBeTruthy();
    });

    // Clic sur le bouton CSV de la carte Rapport Financier
    const csvButton = screen.getByTitle("Exporter le rapport financier en CSV / Excel");
    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(exportCsvSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          periode: "mois",
          financier: expect.objectContaining({ ca_total_centimes: 65000 }),
        }),
        expect.any(Array)
      );
    });
  });

  it("consomme directement les données affichées lors de l'export après changement de filtre, sans appel IPC divergent ni état antérieur", async () => {
    vi.spyOn(tauriService, "isTauri").mockReturnValue(true);

    const mockOverviewMonth: RapportsOverviewDto = {
      ...mockOverview,
      periode: "mois",
      financier: { ...mockOverview.financier, ca_total_centimes: 65000 },
    };

    const mockOverviewToday: RapportsOverviewDto = {
      ...mockOverview,
      periode: "aujourdhui",
      date_debut: "2026-10-24",
      date_fin: "2026-10-24",
      financier: { ...mockOverview.financier, ca_total_centimes: 12000, nombre_contrats: 1 },
    };

    const txMonth = [
      {
        id: "tx-month",
        reference: "LOC-MOIS-01",
        type_operation: "acompte",
        client_nom: "Client Mois",
        moyen_paiement: "especes",
        montant_centimes: 65000,
        date_operation: "2026-10-10T10:00:00Z",
        operateur_nom: "Op1",
      },
    ];

    const txToday = [
      {
        id: "tx-today",
        reference: "LOC-TODAY-01",
        type_operation: "solde",
        client_nom: "Client Aujourd'hui",
        moyen_paiement: "carte_bancaire",
        montant_centimes: 12000,
        date_operation: "2026-10-24T15:30:00Z",
        operateur_nom: "Op2",
      },
    ];

    const invokeSpy = vi.spyOn(tauriService, "invokeCommand").mockImplementation(async (cmd: string, args: any) => {
      if (cmd === "get_rapports_overview") {
        if (args?.periode === "aujourdhui") return mockOverviewToday as any;
        return mockOverviewMonth as any;
      }
      if (cmd === "get_financial_transactions_report") {
        if (args?.periode === "aujourdhui") return txToday as any;
        return txMonth as any;
      }
      return [] as any;
    });

    const exportCsvSpy = vi.spyOn(reportService, "exportFinancialReportCsv").mockImplementation(() => {});

    render(<RapportsPage />);

    // 1. Initialement chargé avec le filtre par défaut "mois"
    await waitFor(() => {
      expect(screen.getByTestId("ca-total").textContent).toContain("65 000");
    });

    // 2. L'utilisateur change le filtre temporel vers "Aujourd'hui"
    const todayButton = screen.getByText("Aujourd'hui");
    fireEvent.click(todayButton);

    // Vérifie que l'écran affiche les nouvelles données résolues
    await waitFor(() => {
      expect(screen.getByTestId("ca-total").textContent).toContain("12 000");
    });

    // Enregistre le nombre d'appels IPC avant le clic d'export
    const callsBeforeExport = invokeSpy.mock.calls.length;

    // 3. Déclenchement de l'export CSV
    const csvButton = screen.getByTitle("Exporter le rapport financier en CSV / Excel");
    fireEvent.click(csvButton);

    // 4. Vérification stricte :
    // a) Zéro nouvel appel IPC au moment du clic sur Exporter (aucun recalcul ni appel divergent)
    expect(invokeSpy.mock.calls.length).toBe(callsBeforeExport);

    // b) L'export reçoit exactement les données de la nouvelle période sélectionnée (pas "mois" ni l'état antérieur)
    expect(exportCsvSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        periode: "aujourdhui",
        financier: expect.objectContaining({ ca_total_centimes: 12000, nombre_contrats: 1 }),
      }),
      expect.arrayContaining([
        expect.objectContaining({
          reference: "LOC-TODAY-01",
          client_nom: "Client Aujourd'hui",
          montant_centimes: 12000,
        }),
      ])
    );

    // c) Aucune donnée de l'ancienne période n'est présente dans l'export
    const exportedRows = exportCsvSpy.mock.calls[0]?.[1] || [];
    expect(exportedRows.some((r) => r.reference === "LOC-MOIS-01")).toBe(false);
  });
});
