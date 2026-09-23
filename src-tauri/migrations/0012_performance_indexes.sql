-- Migration 0012 : Index de performance SQLite sur tables critiques
-- Atelier Prestige — Gestion de Location Costumes & Cérémonie

-- 1. Index sur paiements pour clôture de caisse et réconciliations journalières
CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);

-- 2. Index composites sur locations pour accélération des filtres de statut et retards
CREATE INDEX IF NOT EXISTS idx_locations_statut_retour ON locations(statut, date_retour_prevue);
CREATE INDEX IF NOT EXISTS idx_locations_date_retrait ON locations(date_retrait_prevue);

-- 3. Index sur les ventes directes comptoir
CREATE INDEX IF NOT EXISTS idx_ventes_date ON ventes(created_at);
CREATE INDEX IF NOT EXISTS idx_ventes_client ON ventes(client_id);
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON ventes(statut);

-- 4. Index sur les lignes de vente comptoir
CREATE INDEX IF NOT EXISTS idx_lignes_vente_vente ON lignes_vente(vente_id);
CREATE INDEX IF NOT EXISTS idx_lignes_vente_article ON lignes_vente(article_id);
CREATE INDEX IF NOT EXISTS idx_lignes_vente_variante ON lignes_vente(variante_id);

-- 5. Index sur l'historique des mouvements de stock
CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements_stock(date_mouvement);
CREATE INDEX IF NOT EXISTS idx_mouvements_type ON mouvements_stock(type_mouvement);

-- 6. Index composite sur sessions_caisse pour sélection de la session active/date
CREATE INDEX IF NOT EXISTS idx_sessions_caisse_statut_date ON sessions_caisse(statut, date_session);
