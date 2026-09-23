import { describe, it, expect, vi, beforeAll } from "vitest";
import { generateReceiptPdf, generateCloturePdf } from "@/services/receiptPdfService";
import type { DirectSale, ClotureCaisse, CaisseTransactionItem } from "@/types/caisse";

describe("Module Caisse & Impression — Ticket de Caisse 80mm & Clôture Z (receiptPdfService)", () => {
  beforeAll(() => {
    // Polyfill URL.createObjectURL si non défini dans l'environnement jsdom
    if (typeof window !== "undefined" && !window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-blob-ticket");
      window.URL.revokeObjectURL = vi.fn();
    }
  });

  it("Génère un ticket de caisse 80mm valide pour vente directe avec ventilation en Dinars Algériens (DA)", async () => {
    const mockSale: DirectSale = {
      id: "vte-test-001",
      sale_number: "VTE-2026-0001",
      customer_name: "Client Comptoir",
      user_id: "usr-001",
      user_name: "Jean-Philippe Directeur",
      created_at: new Date().toISOString(),
      total_amount_cents: 30000,
      tax_rate: 0.19,
      tax_amount_cents: 4790,
      payment: {
        method: "especes",
        amount_paid_cents: 30000,
        cash_received_cents: 30000,
        change_returned_cents: 0,
      },
      items: [
        {
          id: "item-1",
          article_id: "art-001",
          name: "Smoking Noir Prestige",
          reference: "SMK-001",
          category_name: "Smokings",
          size: "52",
          quantity: 1,
          unit_price_cents: 25000,
          subtotal_cents: 25000,
        },
        {
          id: "item-2",
          article_id: "art-002",
          name: "Noeud Papillon Soie",
          reference: "ACC-002",
          category_name: "Accessoires",
          quantity: 2,
          unit_price_cents: 2500,
          subtotal_cents: 5000,
        },
      ],
    };

    const result = await generateReceiptPdf(mockSale);

    expect(result).toBeDefined();
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(result.pdfBytes.length).toBeGreaterThan(100);
    expect(result.fileName).toContain("TICKET-VTE-2026-0001");
    expect(typeof result.download).toBe("function");
    expect(typeof result.print).toBe("function");
  });

  it("Génère un Ticket Z de clôture de caisse avec totaux consolidés et réconciliation tiroir", async () => {
    const mockCloture: ClotureCaisse = {
      id: "z-test-001",
      cloture_number: "Z-20260923-01",
      date: "2026-09-23",
      closed_at: new Date().toISOString(),
      closed_by_user_id: "usr-001",
      closed_by_user_name: "Jean-Philippe Directeur",
      closed_by_role: "admin",
      status: "cloturee",
      initial_cash_float_cents: 20000,
      sales_total_cents: 15000,
      rentals_total_cents: 20000,
      deposits_total_cents: 10000,
      grand_total_cents: 35000,
      breakdown: {
        especes: { total_cents: 25000, transaction_count: 2 },
        carte_bancaire: { total_cents: 10000, transaction_count: 1 },
        cheque: { total_cents: 0, transaction_count: 0 },
        virement: { total_cents: 0, transaction_count: 0 },
      },
      theoretical_cash_cents: 45000,
      counted_cash_cents: 45000,
      discrepancy_cents: 0,
    };

    const mockTransactions: CaisseTransactionItem[] = [
      {
        id: "tx-1",
        reference_number: "VTE-2026-0001",
        type: "vente_directe",
        client_name: "Client Comptoir",
        payment_method: "especes",
        amount_cents: 15000,
        created_at: new Date().toISOString(),
        operator_name: "Jean-Philippe Directeur",
      },
    ];

    const result = await generateCloturePdf(mockCloture, mockTransactions);

    expect(result).toBeDefined();
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(result.pdfBytes.length).toBeGreaterThan(100);
    expect(result.fileName).toContain("CLOTURE-Z-20260923-01");
    expect(typeof result.download).toBe("function");
    expect(typeof result.print).toBe("function");
  });
});
