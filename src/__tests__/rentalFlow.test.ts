import { describe, it, expect } from "vitest";
import { useRentalStore } from "@/store/rentalStore";
import { useStockStore } from "@/store/stockStore";
import { useClientStore } from "@/store/clientStore";

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
});
