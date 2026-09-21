-- ============================================================================
-- MIGRATION 0006 : CLÉS ÉTRANGÈRES ON DELETE RESTRICT SUR LIGNES_LOCATION & VENTILATION CAISSE
-- Atelier Prestige — Gestion de Location Costumes & Cérémonie
-- ============================================================================

-- 1. Reconstruction de la table lignes_location avec ON DELETE RESTRICT
--    sur variante_id ET article_id pour préserver l'historique strict des contrats.
CREATE TABLE IF NOT EXISTS lignes_location_v6 (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    variante_id TEXT REFERENCES variantes_stock(id) ON DELETE RESTRICT,
    article_id TEXT REFERENCES articles(id) ON DELETE RESTRICT,
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

-- Copie intégrale des lignes existantes
INSERT INTO lignes_location_v6 (
    id, location_id, variante_id, article_id, quantite, type_ligne,
    prix_unitaire_centimes, caution_centimes, etat_depart, etat_retour,
    est_rendu, date_retour, notes
)
SELECT 
    id, location_id, variante_id, article_id, quantite, type_ligne,
    prix_unitaire_centimes, caution_centimes, etat_depart, etat_retour,
    est_rendu, date_retour, notes
FROM lignes_location;

DROP TABLE lignes_location;

ALTER TABLE lignes_location_v6 RENAME TO lignes_location;

-- Recréation des index sur la table reconstruite
CREATE INDEX IF NOT EXISTS idx_lignes_loc_variante ON lignes_location(variante_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_article ON lignes_location(article_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_location ON lignes_location(location_id);

-- 2. Colonnes dédiées de ventilation par moyen de paiement pour les sessions de caisse (Ticket Z)
ALTER TABLE sessions_caisse ADD COLUMN total_especes_centimes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions_caisse ADD COLUMN total_carte_centimes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions_caisse ADD COLUMN total_cheque_centimes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions_caisse ADD COLUMN total_virement_centimes INTEGER NOT NULL DEFAULT 0;
