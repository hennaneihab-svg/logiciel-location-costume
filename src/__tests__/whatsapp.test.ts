import { describe, it, expect } from "vitest";
import { formatPhoneForWhatsApp, buildWhatsAppLink } from "@/lib/whatsapp";
import {
  buildRappelRetourMessage,
  buildConfirmationReservationMessage,
} from "@/lib/whatsappTemplates";

describe("formatPhoneForWhatsApp", () => {
  it("normalise le format local standard algérien commençant par 0", () => {
    expect(formatPhoneForWhatsApp("0555 12 34 56")).toBe("213555123456");
    expect(formatPhoneForWhatsApp("0661-22-33-44")).toBe("213661223344");
    expect(formatPhoneForWhatsApp("0770.11.22.33")).toBe("213770112233");
    expect(formatPhoneForWhatsApp("0550123456")).toBe("213550123456");
  });

  it("normalise un numéro déjà au format international avec + ou 00", () => {
    expect(formatPhoneForWhatsApp("+213 555 12 34 56")).toBe("213555123456");
    expect(formatPhoneForWhatsApp("00213 661 22 33 44")).toBe("213661223344");
    expect(formatPhoneForWhatsApp("+213555123456")).toBe("213555123456");
  });

  it("conserve un numéro déjà normalisé sans indicatif supplémentaire", () => {
    expect(formatPhoneForWhatsApp("213555123456")).toBe("213555123456");
  });

  it("gère les séparateurs, espaces et parenthèses", () => {
    expect(formatPhoneForWhatsApp("(+213) 0555-12/34.56")).toBe("2130555123456");
    expect(formatPhoneForWhatsApp(" 05 50 12 34 56 ")).toBe("213550123456");
  });

  it("retourne null pour les numéros invalides ou vides", () => {
    expect(formatPhoneForWhatsApp("")).toBeNull();
    expect(formatPhoneForWhatsApp("   ")).toBeNull();
    expect(formatPhoneForWhatsApp("123")).toBeNull(); // trop court
    expect(formatPhoneForWhatsApp("non-un-numero")).toBeNull();
    expect(formatPhoneForWhatsApp("++--//")).toBeNull();
  });
});

describe("buildWhatsAppLink", () => {
  it("génère un lien wa.me correct avec message encodé", () => {
    const link = buildWhatsAppLink("0555 12 34 56", "Bonjour M. Karim, rappel pour votre costume");
    expect(link).not.toBeNull();
    expect(link).toContain("https://wa.me/213555123456?text=");
    expect(link).toContain(encodeURIComponent("Bonjour M. Karim, rappel pour votre costume"));
  });

  it("génère un lien sans paramètre text si message absent ou vide", () => {
    const link = buildWhatsAppLink("0555 12 34 56");
    expect(link).toBe("https://wa.me/213555123456");

    const linkEmpty = buildWhatsAppLink("0555 12 34 56", "   ");
    expect(linkEmpty).toBe("https://wa.me/213555123456");
  });

  it("retourne null si le numéro de téléphone est invalide", () => {
    expect(buildWhatsAppLink("", "Hello")).toBeNull();
    expect(buildWhatsAppLink("invalid", "Hello")).toBeNull();
  });
});

describe("WhatsApp Templates", () => {
  it("génère un message de rappel de retour poli et signé", () => {
    const msg = buildRappelRetourMessage("Karim Benali", "Smoking Midnight Blue", "18/09/2026");
    expect(msg).toContain("Bonjour Karim Benali,");
    expect(msg).toContain("Smoking Midnight Blue");
    expect(msg).toContain("18/09/2026");
    expect(msg).toContain("Atelier Prestige");
  });

  it("génère un message avec mention du retard si présent", () => {
    const msg = buildRappelRetourMessage("Karim Benali", "Smoking Midnight Blue", "15/09/2026", 2);
    expect(msg).toContain("retard de 2 jours");
  });

  it("génère un message de confirmation de réservation", () => {
    const msg = buildConfirmationReservationMessage(
      "Yacine Hadj",
      "Costume 3 Pièces Prince de Galles",
      "20/09/2026",
      "23/09/2026"
    );
    expect(msg).toContain("Bonjour Yacine Hadj,");
    expect(msg).toContain("Costume 3 Pièces Prince de Galles");
    expect(msg).toContain("20/09/2026");
    expect(msg).toContain("23/09/2026");
    expect(msg).toContain("Atelier Prestige");
  });
});

describe("ouvrirWhatsApp", () => {
  it("retourne une erreur claire si le numéro de téléphone est invalide ou vide", async () => {
    const { ouvrirWhatsApp } = await import("@/lib/whatsapp");
    const res = await ouvrirWhatsApp("");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Numéro de téléphone invalide ou manquant");
  });
});
