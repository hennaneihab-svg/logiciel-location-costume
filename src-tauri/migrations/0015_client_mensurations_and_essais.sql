-- Migration 0015: Mensurations structurées & Étape Essayage (LOT MOD-2 + MOD-3)
-- 1. Table des mensurations clients avec historique
CREATE TABLE IF NOT EXISTS client_mensurations (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tour_poitrine REAL,
    tour_taille REAL,
    tour_hanches REAL,
    longueur_bras REAL,
    longueur_jambe REAL,
    tour_cou REAL,
    pointure REAL,
    stature REAL,
    notes_mensurations TEXT,
    date_mesure TEXT NOT NULL,
    est_actuel INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_mensurations_client_actuel ON client_mensurations(client_id, est_actuel);
CREATE INDEX IF NOT EXISTS idx_client_mensurations_date ON client_mensurations(client_id, date_mesure DESC);

-- 2. Table des essais en cabine (Étape essayage)
CREATE TABLE IF NOT EXISTS essais_cabine (
    id TEXT PRIMARY KEY,
    numero_essai TEXT NOT NULL UNIQUE,
    variante_id TEXT NOT NULL REFERENCES variantes_stock(id) ON DELETE RESTRICT,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    client_nom_libre TEXT,
    date_debut TEXT NOT NULL,
    date_fin_prevue TEXT NOT NULL,
    date_fin_effective TEXT,
    statut TEXT NOT NULL DEFAULT 'en_cours' CHECK(statut IN ('en_cours', 'termine', 'annule')),
    resultat TEXT CHECK(resultat IN ('convient', 'retouche_necessaire', 'refuse')),
    pressing_envoi_id TEXT REFERENCES pressing_envois(id) ON DELETE SET NULL,
    notes TEXT,
    utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_essais_cabine_variante ON essais_cabine(variante_id);
CREATE INDEX IF NOT EXISTS idx_essais_cabine_statut ON essais_cabine(statut);
CREATE INDEX IF NOT EXISTS idx_essais_cabine_client ON essais_cabine(client_id);
CREATE INDEX IF NOT EXISTS idx_essais_cabine_dates ON essais_cabine(date_debut, date_fin_prevue);
