-- ============================================================================
-- MIGRATION 0005 : CONTRATS DE LOCATION, SESSIONS DE CAISSE & APP_META EN SQLITE
-- Atelier Prestige — Gestion de Location Costumes & Cérémonie
-- ============================================================================
-- NOTE MONÉTAIRE (RÈGLE ABSOLUE) :
-- Bien que certaines colonnes historiques se nomment *_centimes, TOUTES les
-- valeurs monétaires de l'application et de la base représentent des DINARS
-- ALGÉRIENS (DA) ENTIERS (ex: 15000 = 15 000 DA).
-- AUCUNE conversion (ni /100 ni *100) n'est ou ne doit être appliquée.
-- ============================================================================

-- 1. Reconstruction propre de la table lignes_location pour autoriser les articles en mode quantité
--    (variante_id NULLABLE, article_id REFERENCES articles(id), quantite DEFAULT 1)
CREATE TABLE IF NOT EXISTS lignes_location_new (
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

-- Copie des éventuelles lignes existantes
INSERT OR IGNORE INTO lignes_location_new (
    id, location_id, variante_id, article_id, quantite, type_ligne,
    prix_unitaire_centimes, caution_centimes, etat_depart, etat_retour,
    est_rendu, date_retour, notes
)
SELECT 
    id, location_id, variante_id, NULL, 1, type_ligne,
    prix_unitaire_centimes, caution_centimes, etat_depart, etat_retour,
    est_rendu, date_retour, notes
FROM lignes_location;

DROP INDEX IF EXISTS idx_lignes_loc_variante;
DROP INDEX IF EXISTS idx_lignes_loc_location;
DROP INDEX IF EXISTS idx_lignes_loc_article;

DROP TABLE IF EXISTS lignes_location;
ALTER TABLE lignes_location_new RENAME TO lignes_location;

-- Recréation des index sur lignes_location
CREATE INDEX IF NOT EXISTS idx_lignes_loc_variante ON lignes_location(variante_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_article ON lignes_location(article_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_location ON lignes_location(location_id);

-- 2. Table des sessions et clôtures de caisse avec ventilation par moyen de paiement (Ticket Z)
CREATE TABLE IF NOT EXISTS sessions_caisse (
    id TEXT PRIMARY KEY,
    numero_session TEXT NOT NULL UNIQUE,
    utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id),
    date_session TEXT NOT NULL,
    statut TEXT NOT NULL DEFAULT 'ouverte' CHECK(statut IN ('ouverte', 'cloturee')),
    fonds_initial_centimes INTEGER NOT NULL DEFAULT 0,
    total_especes_theorique_centimes INTEGER NOT NULL DEFAULT 0,
    total_especes_compte_centimes INTEGER,
    ecart_centimes INTEGER,
    total_ventes_centimes INTEGER NOT NULL DEFAULT 0,
    total_locations_centimes INTEGER NOT NULL DEFAULT 0,
    total_cautions_centimes INTEGER NOT NULL DEFAULT 0,
    ventilation_json TEXT, -- JSON sérialisé de breakdown pour reproduction exacte du ticket Z
    notes TEXT,
    opened_at TEXT NOT NULL,
    closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_caisse_date ON sessions_caisse(date_session);
CREATE INDEX IF NOT EXISTS idx_sessions_caisse_statut ON sessions_caisse(statut);

-- 3. Table de suivi des métadonnées applicatives (compteurs séquentiels, flags de migration)
CREATE TABLE IF NOT EXISTS app_meta (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Initialisation du compteur de contrat de location si non présent
INSERT OR IGNORE INTO app_meta (cle, valeur, updated_at) VALUES
('dernier_numero_location', '15', '2026-09-21T21:00:00.000Z'),
('local_storage_migrated', '0', '2026-09-21T21:00:00.000Z');
