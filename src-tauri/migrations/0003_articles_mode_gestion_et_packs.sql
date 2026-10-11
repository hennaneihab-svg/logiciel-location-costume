-- ============================================================================
-- MIGRATION 0003 : MODE DE GESTION ARTICLES (VARIANTE VS QUANTITE) & PACKS
-- Atelier Prestige — Gestion de Location Costumes & Cérémonie
-- ============================================================================

-- 1. Ajout du mode de gestion du stock à la table articles
ALTER TABLE articles ADD COLUMN mode_gestion TEXT NOT NULL DEFAULT 'variante' CHECK(mode_gestion IN ('variante', 'quantite'));
ALTER TABLE articles ADD COLUMN quantite_stock INTEGER;
ALTER TABLE articles ADD COLUMN quantite_disponible INTEGER;

-- 2. Création de la table des packs (composition de prestations/articles)
CREATE TABLE IF NOT EXISTS packs (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    cible TEXT NOT NULL CHECK(cible IN ('homme', 'femme', 'mixte')),
    prix_forfait_centimes INTEGER,
    est_actif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 3. Création de la table des éléments composants d'un pack (pack_items)
CREATE TABLE IF NOT EXISTS pack_items (
    id TEXT PRIMARY KEY,
    pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    categorie_id TEXT NOT NULL REFERENCES categories(id),
    article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
    quantite INTEGER NOT NULL DEFAULT 1,
    obligatoire INTEGER NOT NULL DEFAULT 1
);

-- 4. Index de performance et d'intégrité
CREATE INDEX IF NOT EXISTS idx_variantes_stock_statut ON variantes_stock(statut);
CREATE INDEX IF NOT EXISTS idx_articles_categorie ON articles(categorie_id);
CREATE INDEX IF NOT EXISTS idx_pack_items_pack ON pack_items(pack_id);

-- 5. Mise à jour des articles existants de type accessoire vers le mode 'quantite' (si des articles existent)
UPDATE articles 
SET mode_gestion = 'quantite', 
    quantite_stock = 15, 
    quantite_disponible = 15 
WHERE categorie_id = 'cat-06';

