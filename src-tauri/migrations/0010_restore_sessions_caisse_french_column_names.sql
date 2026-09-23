-- Migration 0010 : Rétablissement des noms de colonnes français d'origine pour sessions_caisse
-- Rétablissement des noms conformes à la convention générale du projet (colonnes SQLite en français avec suffixe _centimes) :
-- rentals_total_centimes   -> total_locations_centimes
-- deposits_total_centimes  -> total_cautions_centimes
-- sales_total_centimes     -> total_ventes_centimes

ALTER TABLE sessions_caisse RENAME COLUMN rentals_total_centimes TO total_locations_centimes;
ALTER TABLE sessions_caisse RENAME COLUMN deposits_total_centimes TO total_cautions_centimes;
ALTER TABLE sessions_caisse RENAME COLUMN sales_total_centimes TO total_ventes_centimes;
