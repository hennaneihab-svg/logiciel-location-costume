import { describe, it, expect } from "vitest";
import { validateImageFile, stripBase64Header, MAX_IMAGE_SIZE_BYTES } from "@/lib/imageProcessor";

describe("Image Processor & Validation", () => {
  it("valide un fichier image conforme", () => {
    const validFile = new File(["dummy-content"], "test.webp", { type: "image/webp" });
    const result = validateImageFile(validFile);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("refuse un fichier qui n'est pas une image", () => {
    const textFile = new File(["dummy-content"], "document.pdf", { type: "application/pdf" });
    const result = validateImageFile(textFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("pas une image");
  });

  it("refuse un fichier dépassant 10 Mo", () => {
    // Simule un fichier de 11 Mo
    const largeFile = {
      name: "huge.jpg",
      type: "image/jpeg",
      size: MAX_IMAGE_SIZE_BYTES + 1024 * 1024,
    } as unknown as File;

    const result = validateImageFile(largeFile);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("trop volumineuse");
  });

  it("extrait correctement le mime et le base64 d'une data URL", () => {
    const sampleDataUrl = "data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASo=";
    const { mime, base64 } = stripBase64Header(sampleDataUrl);
    expect(mime).toBe("image/webp");
    expect(base64).toBe("UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASo=");
  });
});
