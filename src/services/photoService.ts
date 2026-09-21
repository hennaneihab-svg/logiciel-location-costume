import { invoke } from "@tauri-apps/api/core";

export interface ArticlePhotoThumb {
  article_id: string;
  photo_id: string;
  mime: string;
  thumb_base64: string;
}

export interface ArticlePhotoFull {
  photo_id: string;
  article_id: string;
  mime: string;
  data_base64: string;
}

export interface SetArticlePhotoPayload {
  article_id: string;
  mime: string;
  data_base64: string;
  thumb_base64: string;
}

// Cache mémoire en session pour éviter de refaire des requêtes IPC lors du filtrage/re-render
const thumbCache = new Map<string, string>(); // article_id -> data:image/... base64 URL

export const photoService = {
  /**
   * Retourne la photo miniature en cache ou null
   */
  getCachedThumb(articleId: string): string | undefined {
    return thumbCache.get(articleId);
  },

  /**
   * Récupère par lot les miniatures des articles passés en paramètre
   */
  async getBatchThumbs(articleIds: string[]): Promise<Record<string, string>> {
    const missingIds = articleIds.filter((id) => !thumbCache.has(id));
    if (missingIds.length === 0) {
      const result: Record<string, string> = {};
      articleIds.forEach((id) => {
        const cached = thumbCache.get(id);
        if (cached) result[id] = cached;
      });
      return result;
    }

    try {
      const thumbs = await invoke<ArticlePhotoThumb[]>("get_article_photo_thumb", {
        articleIds: missingIds,
      });

      thumbs.forEach((t) => {
        const fullUrl = `data:${t.mime};base64,${t.thumb_base64}`;
        thumbCache.set(t.article_id, fullUrl);
      });
    } catch (err) {
      console.warn("IPC get_article_photo_thumb indisponible ou en mode web:", err);
    }

    const output: Record<string, string> = {};
    articleIds.forEach((id) => {
      const cached = thumbCache.get(id);
      if (cached) output[id] = cached;
    });
    return output;
  },

  /**
   * Récupère la photo haute résolution d'un article
   */
  async getFullPhoto(articleId: string): Promise<string | null> {
    try {
      const res = await invoke<ArticlePhotoFull | null>("get_article_photo_full", {
        articleId,
      });
      if (res) {
        return `data:${res.mime};base64,${res.data_base64}`;
      }
    } catch (err) {
      console.warn("IPC get_article_photo_full indisponible:", err);
    }
    return null;
  },

  /**
   * Enregistre ou remplace la photo d'un article
   */
  async setPhoto(payload: SetArticlePhotoPayload): Promise<string> {
    const thumbUrl = `data:${payload.mime};base64,${payload.thumb_base64}`;
    thumbCache.set(payload.article_id, thumbUrl);

    try {
      await invoke("set_article_photo", {
        dto: {
          article_id: payload.article_id,
          mime: payload.mime,
          data_base64: payload.data_base64,
          thumb_base64: payload.thumb_base64,
        },
      });
    } catch (err) {
      console.warn("IPC set_article_photo indisponible:", err);
    }

    return thumbUrl;
  },

  /**
   * Supprime la photo d'un article
   */
  async deletePhoto(articleId: string): Promise<boolean> {
    thumbCache.delete(articleId);
    try {
      return await invoke<boolean>("delete_article_photo", { articleId });
    } catch (err) {
      console.warn("IPC delete_article_photo indisponible:", err);
      return false;
    }
  },
};
