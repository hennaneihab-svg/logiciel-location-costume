-- ============================================================================
-- MIGRATION 0013 : TRAÇABILITÉ PACK DANS LIGNES_LOCATION
-- Atelier Prestige — Gestion de Location Costumes & Cérémonie
-- ============================================================================
-- Ajout de la colonne pack_id (nullable) pour tracer à quelle réservation de
-- pack appartient chaque ligne. ON DELETE SET NULL préserve l'historique des
-- lignes même si le pack venait à être supprimé ultérieurement.
-- ============================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS lignes_location_v13 (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    variante_id TEXT REFERENCES variantes_stock(id) ON DELETE RESTRICT,
    article_id TEXT REFERENCES articles(id) ON DELETE RESTRICT,
    pack_id TEXT REFERENCES packs(id) ON DELETE SET NULL,
    quantite INTEGER NOT NULL DEFAULT 1,
    type_ligne TEXT NOT NULL DEFAULT 'location'
        CHECK(type_ligne IN ('location', 'accessoire_inclus', 'forfait_pressing')),
    prix_unitaire_centimes INTEGER NOT NULL,
    caution_centimes INTEGER NOT NULL DEFAULT 0,
    etat_depart TEXT,
    etat_retour TEXT,
    est_rendu INTEGER NOT NULL DEFAULT 0,
    date_retour TEXT,
    notes TEXT,
    CONSTRAINT chk_ligne_item CHECK (
        variante_id IS NOT NULL OR (article_id IS NOT NULL AND quantite >= 1)
    )
);

-- Copie intégrale des lignes existantes (pack_id reste NULL pour l'historique)
INSERT INTO lignes_location_v13 (
    id, location_id, variante_id, article_id, pack_id, quantite, type_ligne,
    prix_unitaire_centimes, caution_centimes, etat_depart, etat_retour,
    est_rendu, date_retour, notes
)
SELECT
    id, location_id, variante_id, article_id, NULL, quantite, type_ligne,
    prix_unitaire_centimes, caution_centimes, etat_depart, etat_retour,
    est_rendu, date_retour, notes
FROM lignes_location;

DROP TABLE lignes_location;

ALTER TABLE lignes_location_v13 RENAME TO lignes_location;

PRAGMA foreign_keys = ON;

-- Recréation des index sur la table reconstruite
CREATE INDEX IF NOT EXISTS idx_lignes_loc_variante ON lignes_location(variante_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_article ON lignes_location(article_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_location ON lignes_location(location_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_pack ON lignes_location(pack_id);
