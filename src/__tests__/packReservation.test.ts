import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePackStore } from "@/store/packStore";
import * as tauriService from "@/services/tauri";

describe("Module Packs — Réservation Transactionnelle & Composition de Prestations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Effectue une réservation transactionnelle complète avec succès (variantes + accessoires)", async () => {
    const mockReservedLines = [
      {
        pack_item_id: "pitem-001",
        article_id: "art-001",
        article_nom: "Smoking Col Châle Soie Noir",
        variante_id: "var-001",
        quantite: 1,
        mode_gestion: "variante" as const,
      },
      {
        pack_item_id: "pitem-002",
        article_id: "art-013",
        article_nom: "Richelieu Bout Droit Cuir Glacé Noir",
        variante_id: "var-020",
        quantite: 1,
        mode_gestion: "variante" as const,
      },
      {
        pack_item_id: "pitem-003",
        article_id: "art-018",
        article_nom: "Nœud Papillon Satin Soie Noir à Nouer",
        variante_id: undefined,
        quantite: 1,
        mode_gestion: "quantite" as const,
      },
    ];

    // Mock IPC invokeCommand
    const invokeSpy = vi.spyOn(tauriService, "invokeCommand").mockResolvedValue(mockReservedLines);

    const result = await usePackStore.getState().reservePack({
      pack_id: "pack-marie-01",
      choices: [
        { pack_item_id: "pitem-001", article_id: "art-001", variante_id: "var-001" },
        { pack_item_id: "pitem-002", article_id: "art-013", variante_id: "var-020" },
        { pack_item_id: "pitem-003", article_id: "art-018", quantite: 1 },
      ],
    });

    expect(invokeSpy).toHaveBeenCalledWith("reserve_pack", {
      dto: {
        pack_id: "pack-marie-01",
        choices: [
          { pack_item_id: "pitem-001", article_id: "art-001", variante_id: "var-001" },
          { pack_item_id: "pitem-002", article_id: "art-013", variante_id: "var-020" },
          { pack_item_id: "pitem-003", article_id: "art-018", quantite: 1 },
        ],
      },
    });

    expect(result).toHaveLength(3);
    expect(result[0].variante_id).toBe("var-001");
    expect(result[2].mode_gestion).toBe("quantite");
  });

  it("Rejette la transaction et lève une erreur explicite si une variante ou accessoire est en rupture de stock", async () => {
    // Mock IPC rejet avec erreur explicite de transaction avortée (ROLLBACK)
    vi.spyOn(tauriService, "invokeCommand").mockRejectedValue(
      new Error("Stock insuffisant pour l'article 'Nœud Papillon Satin Soie' (quantité disponible inférieure à 1).")
    );

    await expect(
      usePackStore.getState().reservePack({
        pack_id: "pack-marie-01",
        choices: [
          { pack_item_id: "pitem-001", article_id: "art-001", variante_id: "var-001" },
          { pack_item_id: "pitem-003", article_id: "art-018", quantite: 1 },
        ],
      })
    ).rejects.toThrow("Stock insuffisant pour l'article 'Nœud Papillon Satin Soie'");
  });

  it("Rejette immédiatement si l'identifiant du pack est inexistant", async () => {
    await expect(
      usePackStore.getState().reservePack({
        pack_id: "pack-inexistant-999",
        choices: [],
      })
    ).rejects.toThrow("Pack introuvable : pack-inexistant-999");
  });
});
