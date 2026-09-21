import { describe, it, expect, vi } from "vitest";
import { useRentalStore } from "@/store/rentalStore";
import { useStockStore } from "@/store/stockStore";
import { useClientStore } from "@/store/clientStore";
import { useAuthStore, INITIAL_USERS } from "@/store/authStore";

describe("Module D & C — Flux de Création de Location de Bout en Bout", () => {
  it("Vérifie la disponibilité d une variante et bloque si dates en conflit", () => {
    const { checkVariantAvailability, contracts } = useRentalStore.getState();
    const activeContract = contracts.find((c) => c.status === "en_cours" && c.items.length > 0);
    expect(activeContract).toBeDefined();

    if (activeContract && activeContract.items.length > 0) {
      const variantId = activeContract.items[0].variant_id;
      // Conflit exact sur la période du contrat
      const conflictResult = checkVariantAvailability(
        variantId,
        activeContract.pickup_date,
        activeContract.return_date_scheduled
      );
      expect(conflictResult.available).toBe(false);
      expect(conflictResult.conflictReason).toBeDefined();

      // Pas de conflit sur une période future lointaine (ex: année 2030)
      const freeResult = checkVariantAvailability(
        variantId,
        "2030-06-01",
        "2030-06-05"
      );
      expect(freeResult.available).toBe(true);
    }
  });

  it("Crée une nouvelle location avec calcul automatique du reste à payer", async () => {
    const client = useClientStore.getState().clients[0];
    const article = useStockStore.getState().articles[0];
    const variant = article.variants[0];

    const initialCount = useRentalStore.getState().contracts.length;

    const today = new Date().toISOString().slice(0, 10);
    const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const newContract = await useRentalStore.getState().createRentalContract({
      customer_id: client.id,
      pickup_date: today,
      return_date_scheduled: in3Days,
      selected_variant_ids: [variant.id],
      discount_cents: 1000, // 1 000 DA de remise
      deposit_amount_cents: 20000, // 20 000 DA de caution
      deposit_method: "empreinte_cb",
      paid_amount_cents: 5000, // 5 000 DA d acompte
      payment_method: "carte_bancaire",
      notes: "Test unitaire de création de contrat",
    });

    expect(newContract).toBeDefined();
    expect(newContract.contract_number).toMatch(/^LOC-2026-\d{4}$/);
    expect(newContract.customer_name).toContain(client.first_name);
    expect(newContract.status).toBe("en_cours");
    expect(newContract.discount_cents).toBe(1000);
    expect(newContract.deposit_amount_cents).toBe(20000);
    expect(newContract.paid_amount_cents).toBe(5000);
    expect(newContract.remaining_amount_cents).toBe(
      newContract.total_amount_cents - 5000
    );

    // Vérifie qu il a bien été ajouté à la liste
    const afterCount = useRentalStore.getState().contracts.length;
    expect(afterCount).toBe(initialCount + 1);
  });

  it("Calcule correctement le prix total selon la durée (1 jour, 5 jours, même jour)", async () => {
    const client = useClientStore.getState().clients[0];
    const article = useStockStore.getState().articles[0]; // prix de loc: 18 000 DA/j
    const variant = article.variants[0];

    const basePrice = article.rental_price_cents; // 18 000 DA

    // Cas 1 : 1 jour
    const contract1d = await useRentalStore.getState().createRentalContract({
      customer_id: client.id,
      pickup_date: "2031-01-01",
      return_date_scheduled: "2031-01-02",
      selected_variant_ids: [variant.id],
      discount_cents: 0,
      deposit_amount_cents: 10000,
      deposit_method: "especes",
      paid_amount_cents: basePrice * 1,
      payment_method: "especes",
    });
    expect(contract1d.total_rental_cents).toBe(basePrice * 1);
    expect(contract1d.total_amount_cents).toBe(basePrice * 1);

    // Cas 2 : 5 jours
    const contract5d = await useRentalStore.getState().createRentalContract({
      customer_id: client.id,
      pickup_date: "2031-02-01",
      return_date_scheduled: "2031-02-06",
      selected_variant_ids: [variant.id],
      discount_cents: 0,
      deposit_amount_cents: 10000,
      deposit_method: "especes",
      paid_amount_cents: basePrice * 5,
      payment_method: "especes",
    });
    expect(contract5d.total_rental_cents).toBe(basePrice * 5); // 18 000 * 5 = 90 000 DA
    expect(contract5d.total_amount_cents).toBe(basePrice * 5);

    // Cas 3 : Cas limite même jour (minimum 1 jour facturé)
    const contractSameDay = await useRentalStore.getState().createRentalContract({
      customer_id: client.id,
      pickup_date: "2031-03-01",
      return_date_scheduled: "2031-03-01",
      selected_variant_ids: [variant.id],
      discount_cents: 0,
      deposit_amount_cents: 10000,
      deposit_method: "especes",
      paid_amount_cents: basePrice * 1,
      payment_method: "especes",
    });
    expect(contractSameDay.total_rental_cents).toBe(basePrice * 1);
    expect(contractSameDay.total_amount_cents).toBe(basePrice * 1);
  });

  it("En mode Tauri natif : rejette si aucun utilisateur n'est connecté", async () => {
    const tauriModule = await import("@/services/tauri");
    const isTauriSpy = vi.spyOn(tauriModule, "isTauri").mockReturnValue(true);
    useAuthStore.setState({ currentUser: null, isAuthenticated: false });

    await expect(
      useRentalStore.getState().createRentalContract({
        customer_id: "cli-001",
        pickup_date: "2026-11-01",
        return_date_scheduled: "2026-11-04",
        selected_variant_ids: ["var-001"],
        discount_cents: 0,
        deposit_method: "cheque",
        deposit_amount_cents: 50000,
        paid_amount_cents: 5000,
        payment_method: "carte_bancaire",
      })
    ).rejects.toThrow("Opération impossible : aucun utilisateur connecté");

    isTauriSpy.mockRestore();
  });

  it("En mode Tauri natif : invoque 'create_rental' via IPC sans fallback localStorage", async () => {
    const tauriModule = await import("@/services/tauri");
    const isTauriSpy = vi.spyOn(tauriModule, "isTauri").mockReturnValue(true);
    useAuthStore.setState({ currentUser: INITIAL_USERS[0], isAuthenticated: true });

    const mockCreatedContract = {
      id: "loc-tauri-001",
      contract_number: "LOC-2026-0099",
      customer_id: "cli-001",
      customer_name: "Jean Dupont",
      customer_phone: "06 12 34 56 78",
      status: "reserve" as const,
      pickup_date: "2026-11-01",
      return_date_scheduled: "2026-11-04",
      items: [],
      total_rental_cents: 20000,
      cleaning_fee_cents: 1000,
      discount_cents: 0,
      late_fee_cents: 0,
      damage_fee_cents: 0,
      total_amount_cents: 20000,
      deposit_amount_cents: 50000,
      deposit_status: "cheque_retenu" as const,
      deposit_method: "cheque" as const,
      paid_amount_cents: 5000,
      payment_method: "carte_bancaire" as const,
      remaining_amount_cents: 15000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const invokeSpy = vi.spyOn(tauriModule, "invokeCommand").mockResolvedValue(mockCreatedContract);
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");

    const result = await useRentalStore.getState().createRentalContract({
      customer_id: "cli-001",
      pickup_date: "2026-11-01",
      return_date_scheduled: "2026-11-04",
      selected_variant_ids: ["var-001"],
      discount_cents: 0,
      deposit_method: "cheque",
      deposit_amount_cents: 50000,
      paid_amount_cents: 5000,
      payment_method: "carte_bancaire",
    });

    expect(invokeSpy).toHaveBeenCalledWith("create_rental", expect.objectContaining({
      dto: expect.objectContaining({
        customer_id: "cli-001",
        utilisateur_id: "usr-001",
        pickup_date: "2026-11-01",
        return_date_scheduled: "2026-11-04",
      }),
    }));

    expect(result.contract_number).toBe("LOC-2026-0099");
    expect(useRentalStore.getState().contracts.some((c) => c.id === "loc-tauri-001")).toBe(true);

    // RÈGLE ABSOLUE : aucun appel à localStorage.setItem
    expect(localStorageSpy).not.toHaveBeenCalled();

    isTauriSpy.mockRestore();
    invokeSpy.mockRestore();
    localStorageSpy.mockRestore();
  });

  it("En mode Tauri natif : propage les erreurs de validation SQLite sans masquer ni repli localStorage", async () => {
    const tauriModule = await import("@/services/tauri");
    const isTauriSpy = vi.spyOn(tauriModule, "isTauri").mockReturnValue(true);
    useAuthStore.setState({ currentUser: INITIAL_USERS[0], isAuthenticated: true });
    const invokeSpy = vi.spyOn(tauriModule, "invokeCommand").mockRejectedValue(
      new Error("Erreur de validation : Conflit de date pour Smoking Col Châle avec le contrat LOC-2026-0011")
    );
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");

    await expect(
      useRentalStore.getState().createRentalContract({
        customer_id: "cli-001",
        pickup_date: "2026-09-08",
        return_date_scheduled: "2026-09-12",
        selected_variant_ids: ["var-002"],
        discount_cents: 0,
        deposit_method: "cheque",
        deposit_amount_cents: 45000,
        paid_amount_cents: 0,
        payment_method: "carte_bancaire",
      })
    ).rejects.toThrow("Conflit de date");

    // Aucune écriture de repli silencieux
    expect(localStorageSpy).not.toHaveBeenCalled();

    isTauriSpy.mockRestore();
    invokeSpy.mockRestore();
    localStorageSpy.mockRestore();
  });

  it("processReturn en mode Tauri appelle 'register_return' et met à jour l état sans localStorage", async () => {
    const tauriModule = await import("@/services/tauri");
    const isTauriSpy = vi.spyOn(tauriModule, "isTauri").mockReturnValue(true);

    const mockReturned = {
      ...useRentalStore.getState().contracts[0],
      status: "retourne" as const,
      return_date_actual: "2026-09-21",
    };

    const invokeSpy = vi.spyOn(tauriModule, "invokeCommand").mockResolvedValue(mockReturned);
    const localStorageSpy = vi.spyOn(Storage.prototype, "setItem");

    const ret = await useRentalStore.getState().processReturn(mockReturned.id, [
      { variant_id: "var-008", condition: "bon_etat", damage_fee_cents: 0 },
    ]);

    expect(invokeSpy).toHaveBeenCalledWith("register_return", expect.anything());
    expect(ret.status).toBe("retourne");
    expect(localStorageSpy).not.toHaveBeenCalled();

    isTauriSpy.mockRestore();
    invokeSpy.mockRestore();
    localStorageSpy.mockRestore();
  });
});
