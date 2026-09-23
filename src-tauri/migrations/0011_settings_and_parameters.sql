-- ============================================================================
-- MIGRATION 0011 : TABLE PARAMETRES & REGLAGES DE L'ETABLISSEMENT
-- Atelier Prestige : Sauvegarde native des paramètres en base SQLite
-- ============================================================================

CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Insertion des réglages par défaut de l'établissement si inexistants
INSERT OR IGNORE INTO parametres (cle, valeur, updated_at) VALUES
('boutique', '{"name":"Atelier Prestige — Cérémonie & Événements","slogan":"Costumes d''Exception, Smokings Cérémonie & Chaussures de Luxe","address":"12 Boulevard Mohamed V","postal_code":"16000","city":"Alger","phone":"021 63 45 78","email":"contact@atelierprestige.dz","siret":"001916010023456","rcs":"16/00-0987654B19","website":"www.atelierprestige.dz","logo_url":"https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=200&auto=format&fit=crop&q=80","legal_notice":"TVA algérienne à 19% applicable selon la législation fiscale en vigueur."}', '2026-09-23T12:00:00.000Z'),
('numerotation', '{"rental_prefix":"LOC","sale_prefix":"VTE","quote_prefix":"DEV","year_format":"YYYY","padding_digits":4}', '2026-09-23T12:00:00.000Z'),
('fiscalite', '{"default_vat_rate":0.19,"currency":"DZD","currency_symbol":"DA"}', '2026-09-23T12:00:00.000Z'),
('backups', '[]', '2026-09-23T12:00:00.000Z'),
('audit_logs', '[]', '2026-09-23T12:00:00.000Z');
