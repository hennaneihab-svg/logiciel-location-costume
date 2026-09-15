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

-- 5. Mise à jour des articles existants de type accessoire vers le mode 'quantite'
UPDATE articles 
SET mode_gestion = 'quantite', 
    quantite_stock = 15, 
    quantite_disponible = 15 
WHERE categorie_id = 'cat-06';

-- 6. Insertion de packs réalistes pour le fonctionnement immédiat
INSERT OR IGNORE INTO packs (id, nom, cible, prix_forfait_centimes, est_actif, created_at, updated_at) VALUES
('pack-marie-01', 'Pack Marié Prestige Cérémonie', 'homme', 28000, 1, '2026-09-17T10:00:00.000Z', '2026-09-17T10:00:00.000Z'),
('pack-cocktail-02', 'Pack Soirée Cocktail & Gala', 'homme', 22000, 1, '2026-09-17T10:00:00.000Z', '2026-09-17T10:00:00.000Z');

-- Éléments composants du Pack Marié Prestige :
-- 1 Costume (slot ouvert sur catégorie Smokings cat-01)
-- 1 Paire de chaussures (slot ouvert sur Richelieu cat-04)
-- 1 Nœud papillon en soie (article_id art-018 en mode quantité)
-- 1 Boutons de manchette (article_id art-019 en mode quantité)
INSERT OR IGNORE INTO pack_items (id, pack_id, categorie_id, article_id, quantite, obligatoire) VALUES
('pitem-001', 'pack-marie-01', 'cat-01', NULL, 1, 1),
('pitem-002', 'pack-marie-01', 'cat-04', NULL, 1, 1),
('pitem-003', 'pack-marie-01', 'cat-06', 'art-018', 1, 1),
('pitem-004', 'pack-marie-01', 'cat-06', 'art-019', 1, 1);

-- Éléments composants du Pack Cocktail & Gala :
INSERT OR IGNORE INTO pack_items (id, pack_id, categorie_id, article_id, quantite, obligatoire) VALUES
('pitem-005', 'pack-cocktail-02', 'cat-01', NULL, 1, 1),
('pitem-006', 'pack-cocktail-02', 'cat-06', 'art-018', 1, 1);
