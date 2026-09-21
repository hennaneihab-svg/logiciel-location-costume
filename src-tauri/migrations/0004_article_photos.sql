-- ============================================================================
-- MIGRATION 0004 : STOCKAGE DES PHOTOS D'ARTICLES DANS SQLITE
-- Atelier Prestige — Gestion de Location Costumes & Cérémonie
-- ============================================================================

CREATE TABLE IF NOT EXISTS article_photos (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    thumb BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_article_photos_article_id ON article_photos(article_id);
