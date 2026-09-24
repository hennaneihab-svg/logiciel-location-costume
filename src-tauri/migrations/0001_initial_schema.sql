-- ============================================================================
-- MIGRATION 0001 : SCHEMA INITIAL DE LA BASE DE DONNEES SQLITE EMBARQUEE
-- Atelier Prestige : Logiciel de gestion location de costumes & chaussures
-- Conforme a PROJECT_CONTEXT.md
-- ============================================================================

PRAGMA foreign_keys = ON;

-------------------------------------------------------------------------------
-- 1. UTILISATEURS & RÔLES
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
    id TEXT PRIMARY KEY,
    nom_utilisateur TEXT NOT NULL UNIQUE,
    mot_de_passe_hash TEXT NOT NULL,
    nom_complet TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'seller', 'vendeur')),
    est_actif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 2. FOURNISSEURS
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fournisseurs (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL UNIQUE,
    contact_nom TEXT,
    telephone TEXT,
    email TEXT,
    adresse TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 3. CATÉGORIES
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('costume', 'chaussure', 'accessoire', 'autre')),
    description TEXT,
    created_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 4. ARTICLES (Modèles génériques de costumes, chaussures, accessoires)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    categorie_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    fournisseur_id TEXT REFERENCES fournisseurs(id) ON DELETE SET NULL,
    reference TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL,
    marque TEXT,
    couleur TEXT,
    description TEXT,
    prix_location_centimes INTEGER NOT NULL,          -- Montant en centimes
    prix_vente_centimes INTEGER,                     -- Montant en centimes si disponible à la vente
    caution_suggeree_centimes INTEGER NOT NULL,       -- Montant en centimes
    frais_nettoyage_centimes INTEGER DEFAULT 0,       -- Forfait pressing inclus ou option
    image_url TEXT,
    est_actif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 5. VARIANTES DE STOCK (Pièces physiques individualisées avec code-barre)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS variantes_stock (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    code_barre TEXT NOT NULL UNIQUE,
    taille TEXT NOT NULL,
    sous_taille TEXT,                                -- Longueur, Drop ou largeur
    etat_usure TEXT NOT NULL DEFAULT 'excellent' 
        CHECK(etat_usure IN ('neuf', 'excellent', 'bon', 'usage', 'endommage', 'au_rebut')),
    statut TEXT NOT NULL DEFAULT 'disponible' 
        CHECK(statut IN ('disponible', 'reserve', 'en_location', 'au_pressing', 'en_retouche', 'indisponible', 'vendu')),
    nb_locations INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 6. MOUVEMENTS DE STOCK & TRAÇABILITÉ
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mouvements_stock (
    id TEXT PRIMARY KEY,
    variante_id TEXT NOT NULL REFERENCES variantes_stock(id) ON DELETE CASCADE,
    utilisateur_id TEXT REFERENCES utilisateurs(id) ON DELETE SET NULL,
    type_mouvement TEXT NOT NULL 
        CHECK(type_mouvement IN ('entree_stock', 'depart_location', 'retour_location', 'envoi_pressing', 'retour_pressing', 'retouche', 'mise_au_rebut', 'ajustement_manuel')),
    motif TEXT,
    details TEXT,
    date_mouvement TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 7. CLIENTS
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    email TEXT,
    telephone TEXT NOT NULL,
    telephone_secondaire TEXT,
    adresse TEXT,
    ville TEXT,
    code_postal TEXT,
    numero_cni TEXT,                                 -- Pièce de garantie (CNI, Passeport)
    notes TEXT,                                      -- Mensurations, préférences
    est_bloque INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 8. LOCATIONS (Contrats de location événementielle)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    numero_location TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    statut TEXT NOT NULL DEFAULT 'brouillon' 
        CHECK(statut IN ('brouillon', 'reserve', 'en_cours', 'retourne', 'en_retard', 'litige', 'annule')),
    date_evenement TEXT,
    date_retrait_prevue TEXT NOT NULL,
    date_retrait_effective TEXT,
    date_retour_prevue TEXT NOT NULL,
    date_retour_effective TEXT,
    montant_total_ht_centimes INTEGER NOT NULL DEFAULT 0,
    tva_taux REAL NOT NULL DEFAULT 20.0,
    montant_total_ttc_centimes INTEGER NOT NULL DEFAULT 0,
    frais_nettoyage_centimes INTEGER NOT NULL DEFAULT 0,
    frais_retard_centimes INTEGER NOT NULL DEFAULT 0,
    frais_degradation_centimes INTEGER NOT NULL DEFAULT 0,
    remise_centimes INTEGER NOT NULL DEFAULT 0,
    montant_caution_centimes INTEGER NOT NULL DEFAULT 0,
    statut_caution TEXT NOT NULL DEFAULT 'non_recue' 
        CHECK(statut_caution IN ('non_recue', 'encaissee', 'empreinte_cb', 'cheque_retenu', 'restituee', 'conservee_partiellement', 'conservee_totalement')),
    notes_caution TEXT,
    notes TEXT,
    chemin_pdf TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    utilisateur_retrait_id TEXT REFERENCES utilisateurs(id) ON DELETE SET NULL
);

-------------------------------------------------------------------------------
-- 9. LIGNES DE LOCATION
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lignes_location (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    variante_id TEXT NOT NULL REFERENCES variantes_stock(id) ON DELETE RESTRICT,
    type_ligne TEXT NOT NULL DEFAULT 'location' 
        CHECK(type_ligne IN ('location', 'accessoire_inclus', 'forfait_pressing')),
    prix_unitaire_centimes INTEGER NOT NULL,
    caution_centimes INTEGER NOT NULL DEFAULT 0,
    etat_depart TEXT,
    etat_retour TEXT,
    est_rendu INTEGER NOT NULL DEFAULT 0,
    date_retour TEXT,
    notes TEXT
);

-------------------------------------------------------------------------------
-- 10. VENTES DIRECTES (Articles neufs, accessoires, chemises vendues)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventes (
    id TEXT PRIMARY KEY,
    numero_vente TEXT NOT NULL UNIQUE,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    montant_total_centimes INTEGER NOT NULL,
    moyen_paiement TEXT NOT NULL 
        CHECK(moyen_paiement IN ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre')),
    statut TEXT NOT NULL DEFAULT 'completee' 
        CHECK(statut IN ('completee', 'remboursee', 'annulee')),
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lignes_vente (
    id TEXT PRIMARY KEY,
    vente_id TEXT NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
    variante_id TEXT REFERENCES variantes_stock(id) ON DELETE SET NULL,
    quantite INTEGER NOT NULL DEFAULT 1,
    prix_unitaire_centimes INTEGER NOT NULL,
    total_centimes INTEGER NOT NULL
);

-------------------------------------------------------------------------------
-- 11. PAIEMENTS & ENCAISSEMENTS
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paiements (
    id TEXT PRIMARY KEY,
    location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
    vente_id TEXT REFERENCES ventes(id) ON DELETE CASCADE,
    utilisateur_id TEXT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
    montant_centimes INTEGER NOT NULL,
    type_paiement TEXT NOT NULL 
        CHECK(type_paiement IN ('acompte', 'solde', 'caution', 'frais_retard', 'degradation', 'vente_directe', 'remboursement')),
    moyen_paiement TEXT NOT NULL 
        CHECK(moyen_paiement IN ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre')),
    reference_transaction TEXT,
    notes TEXT,
    date_paiement TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 12. ALERTES DE RETOUR & RELANCES
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alertes (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type_alerte TEXT NOT NULL 
        CHECK(type_alerte IN ('j_minus_3', 'j_minus_2', 'j_minus_1', 'jour_j', 'retard')),
    date_echeance TEXT NOT NULL,
    est_declenchee INTEGER NOT NULL DEFAULT 0,
    date_declenchement TEXT,
    est_traitee INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 13. INDEX DE RECHERCHE ET PERFORMANCES
-------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_articles_categorie ON articles(categorie_id);
CREATE INDEX IF NOT EXISTS idx_articles_fournisseur ON articles(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_articles_ref ON articles(reference);

CREATE INDEX IF NOT EXISTS idx_variantes_article ON variantes_stock(article_id);
CREATE INDEX IF NOT EXISTS idx_variantes_code_barre ON variantes_stock(code_barre);
CREATE INDEX IF NOT EXISTS idx_variantes_statut ON variantes_stock(statut);

CREATE INDEX IF NOT EXISTS idx_clients_nom ON clients(nom, prenom);
CREATE INDEX IF NOT EXISTS idx_clients_tel ON clients(telephone);

CREATE INDEX IF NOT EXISTS idx_locations_client ON locations(client_id);
CREATE INDEX IF NOT EXISTS idx_locations_statut ON locations(statut);
CREATE INDEX IF NOT EXISTS idx_locations_dates ON locations(date_retrait_prevue, date_retour_prevue);

CREATE INDEX IF NOT EXISTS idx_lignes_loc_variante ON lignes_location(variante_id);
CREATE INDEX IF NOT EXISTS idx_lignes_loc_location ON lignes_location(location_id);

CREATE INDEX IF NOT EXISTS idx_paiements_location ON paiements(location_id);
CREATE INDEX IF NOT EXISTS idx_paiements_vente ON paiements(vente_id);

CREATE INDEX IF NOT EXISTS idx_alertes_echeance ON alertes(date_echeance, est_declenchee);
CREATE INDEX IF NOT EXISTS idx_mouvements_variante ON mouvements_stock(variante_id);
