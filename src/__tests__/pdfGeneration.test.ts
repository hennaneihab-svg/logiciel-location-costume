import { describe, it, expect, vi } from "vitest";
import { generateRentalContractPdf } from "@/services/pdfService";
import { useRentalStore } from "@/store/rentalStore";
import { PDFDocument } from "pdf-lib";

// Mock URL.createObjectURL pour l environnement Node/jsdom
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
}

describe("Module D — Génération du Bon de Location PDF en 2 Exemplaires", () => {
  it("Génère un document PDF binaire valide avec 2 pages distinctes (Boutique et Client)", async () => {
    const contract = useRentalStore.getState().contracts[0];
    expect(contract).toBeDefined();

    const result = await generateRentalContractPdf(contract);

    expect(result).toBeDefined();
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.fileName).toContain(contract.contract_number);

    // Recharger avec pdf-lib pour vérifier qu il y a bien 2 pages
    const loadedDoc = await PDFDocument.load(result.pdfBytes);
    expect(loadedDoc.getPageCount()).toBe(2);

    const page1 = loadedDoc.getPage(0);
    const page2 = loadedDoc.getPage(1);
    expect(page1.getWidth()).toBeCloseTo(595.28, 1);
    expect(page2.getHeight()).toBeCloseTo(841.89, 1);
  });
});
