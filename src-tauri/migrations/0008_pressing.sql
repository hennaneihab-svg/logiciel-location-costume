-- Migration 0008: Module Pressing
-- Prestataires configurables, suivi des envois et photos

-- 1. Table des prestataires de pressing (ou atelier interne)
CREATE TABLE IF NOT EXISTS pressing_prestataires (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    contact_nom TEXT,
    telephone TEXT,
    adresse TEXT,
    tarif_defaut_centimes INTEGER,
    delai_defaut_jours INTEGER NOT NULL DEFAULT 3,
    actif INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. Table des envois au pressing
CREATE TABLE IF NOT EXISTS pressing_envois (
    id TEXT PRIMARY KEY,
    numero_envoi TEXT NOT NULL UNIQUE,
    variante_id TEXT NOT NULL REFERENCES variantes_stock(id) ON DELETE RESTRICT,
    prestataire_id TEXT REFERENCES pressing_prestataires(id) ON DELETE RESTRICT,
    location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
    type_traitement TEXT,
    motif TEXT,
    cout_centimes INTEGER NOT NULL DEFAULT 0,
    statut_paiement_prestataire TEXT NOT NULL DEFAULT 'a_payer' 
        CHECK (statut_paiement_prestataire IN ('a_payer', 'paye')),
    date_paiement_prestataire TEXT,
    date_envoi TEXT NOT NULL,
    date_retour_prevue TEXT NOT NULL,
    date_retour_effective TEXT,
    statut TEXT NOT NULL DEFAULT 'envoye' 
        CHECK (statut IN ('envoye', 'en_traitement', 'recu', 'probleme', 'annule')),
    notes TEXT,
    utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pressing_envois_variante ON pressing_envois(variante_id);
CREATE INDEX IF NOT EXISTS idx_pressing_envois_statut ON pressing_envois(statut);
CREATE INDEX IF NOT EXISTS idx_pressing_envois_prestataire ON pressing_envois(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_pressing_envois_dates ON pressing_envois(date_retour_prevue, statut);

-- 3. Table des photos d'envois (BLOB en base, max 800px / miniature 240px)
CREATE TABLE IF NOT EXISTS pressing_envoi_photos (
    id TEXT PRIMARY KEY,
    envoi_id TEXT NOT NULL REFERENCES pressing_envois(id) ON DELETE CASCADE,
    mime TEXT NOT NULL DEFAULT 'image/webp',
    data BLOB NOT NULL,
    thumb BLOB NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pressing_photos_envoi ON pressing_envoi_photos(envoi_id);

-- 4. Paramètre d'activation globale du module dans app_meta
INSERT OR IGNORE INTO app_meta (cle, valeur, updated_at) 
VALUES ('pressing_module_actif', '1', datetime('now'));
