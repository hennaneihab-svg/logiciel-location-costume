-- Migration 0014: Suivi et validation du retrait physique (LOT MOD-4)
-- Ajout de l'utilisateur qui a validé la remise des pièces et indexation de la date réelle de retrait

ALTER TABLE locations ADD COLUMN utilisateur_retrait_id TEXT REFERENCES utilisateurs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_locations_date_retrait_effective ON locations(date_retrait_effective);
