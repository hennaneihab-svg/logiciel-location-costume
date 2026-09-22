-- ============================================================================
-- MIGRATION 0007 : NUMÉROTATION ANNUELLE PAR ANNÉE CIVILE (LOC-AAAA-NNNN & VTE-AAAA-NNNN)
-- ============================================================================
-- 1. Transférer dernier_numero_location vers dernier_numero_location_2026
--    Valeur = MAX(valeur actuelle de dernier_numero_location, plus grand numéro 2026 dans locations, 15)
INSERT OR REPLACE INTO app_meta (cle, valeur, updated_at)
SELECT 
    'dernier_numero_location_2026',
    CAST(MAX(
        COALESCE((SELECT CAST(valeur AS INTEGER) FROM app_meta WHERE cle = 'dernier_numero_location'), 15),
        COALESCE((SELECT MAX(CAST(SUBSTR(numero_location, 10) AS INTEGER)) FROM locations WHERE numero_location LIKE 'LOC-2026-%'), 0),
        15
    ) AS TEXT),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- 2. Transférer dernier_numero_vente vers dernier_numero_vente_2026
--    Valeur = MAX(valeur actuelle de dernier_numero_vente, plus grand numéro 2026 dans ventes, 40)
INSERT OR REPLACE INTO app_meta (cle, valeur, updated_at)
SELECT 
    'dernier_numero_vente_2026',
    CAST(MAX(
        COALESCE((SELECT CAST(valeur AS INTEGER) FROM app_meta WHERE cle = 'dernier_numero_vente'), 40),
        COALESCE((SELECT MAX(CAST(SUBSTR(numero_vente, 10) AS INTEGER)) FROM ventes WHERE numero_vente LIKE 'VTE-2026-%'), 0),
        40
    ) AS TEXT),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- 3. Retirer les anciennes clés globales désormais obsolètes
DELETE FROM app_meta WHERE cle IN ('dernier_numero_location', 'dernier_numero_vente');
