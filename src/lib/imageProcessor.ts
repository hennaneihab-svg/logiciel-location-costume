/**
 * Utilitaires de manipulation d'images :
 * - Redimensionnement d'image principale (max 800px) et miniature (max 240px)
 * - Conversion en WebP avec qualité 0.8
 * - Validation de la taille (max 10 Mo)
 */

export interface ProcessedArticleImage {
  mime: string;
  dataBase64: string;
  thumbBase64: string;
}

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "Le fichier sélectionné n'est pas une image valide." };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `L'image est trop volumineuse (${(file.size / (1024 * 1024)).toFixed(1)} Mo). Limite maximale : 10 Mo.`,
    };
  }
  return { valid: true };
}

/**
 * Charge un fichier File ou un Blob ou un Data URL dans un élément Image HTML
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image pour le traitement"));
    img.src = src;
  });
}

/**
 * Redimensionne une image source sur un canvas et retourne sa data URL en WebP
 */
export function resizeImageToCanvas(
  img: HTMLImageElement,
  maxWidth: number,
  quality = 0.8,
  preferredMime = "image/webp"
): string {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Impossible d'initialiser le contexte 2D du canvas");
  }

  // Lissage haute qualité
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  let dataUrl = canvas.toDataURL(preferredMime, quality);
  // Repli si le navigateur ne supporte pas WebP en export canvas
  if (!dataUrl.startsWith("data:image/webp")) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return dataUrl;
}

/**
 * Extrait le base64 brut sans le préfixe data:mime;base64,
 */
export function stripBase64Header(dataUrl: string): { mime: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { mime: "image/webp", base64: dataUrl };
  }
  return {
    mime: match[1],
    base64: match[2],
  };
}

/**
 * Traitement complet d'une image pour l'article :
 * - Image principale max 800px WebP
 * - Miniature max 240px WebP
 */
export async function processArticleImage(source: File | Blob | string): Promise<ProcessedArticleImage> {
  let srcUrl = "";
  let shouldRevoke = false;

  if (typeof source !== "string") {
    srcUrl = URL.createObjectURL(source);
    shouldRevoke = true;
  } else {
    srcUrl = source;
  }

  try {
    const img = await loadImageElement(srcUrl);

    // Image principale (max 800 px)
    const fullDataUrl = resizeImageToCanvas(img, 800, 0.8, "image/webp");
    const { mime, base64: dataBase64 } = stripBase64Header(fullDataUrl);

    // Miniature (max 240 px)
    const thumbDataUrl = resizeImageToCanvas(img, 240, 0.8, "image/webp");
    const { base64: thumbBase64 } = stripBase64Header(thumbDataUrl);

    return {
      mime,
      dataBase64,
      thumbBase64,
    };
  } finally {
    if (shouldRevoke && srcUrl) {
      URL.revokeObjectURL(srcUrl);
    }
  }
}
