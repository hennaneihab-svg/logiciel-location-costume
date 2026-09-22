-- Migration 0009 : Renommage des colonnes de totaux de sessions_caisse vers la convention du projet
-- Ancien nommage -> Nouveau nommage (centimes explicites) :
-- total_locations_centimes -> rentals_total_centimes
-- total_cautions_centimes  -> deposits_total_centimes
-- total_ventes_centimes    -> sales_total_centimes

ALTER TABLE sessions_caisse RENAME COLUMN total_locations_centimes TO rentals_total_centimes;
ALTER TABLE sessions_caisse RENAME COLUMN total_cautions_centimes TO deposits_total_centimes;
ALTER TABLE sessions_caisse RENAME COLUMN total_ventes_centimes TO sales_total_centimes;
