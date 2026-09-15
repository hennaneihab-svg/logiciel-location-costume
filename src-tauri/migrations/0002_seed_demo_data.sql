-- ============================================================================
-- MIGRATION 0002 : JEU DE DONNÉES DE DÉMONSTRATION RÉALISTE
-- 20 articles, 10 clients, 15 locations (3 derniers mois), paiements & alertes
-- ============================================================================

-- Utilisateurs initiaux
INSERT OR IGNORE INTO utilisateurs (id, nom_utilisateur, mot_de_passe_hash, nom_complet, role, est_actif, created_at, updated_at) VALUES
('usr-001', 'admin', '$2b$12$K89J2j0LkqE1G2Y7K2.9Q.a9K1FzM7j5L8o9Q1A2B3C4D5E6F7G8H', 'Jean-Philippe Directeur', 'admin', 1, '2026-06-01T08:00:00.000Z', '2026-06-01T08:00:00.000Z'),
('usr-002', 'vendeur1', '$2b$12$K89J2j0LkqE1G2Y7K2.9Q.a9K1FzM7j5L8o9Q1A2B3C4D5E6F7G8H', 'Sophie Vendeuse', 'seller', 1, '2026-06-01T08:00:00.000Z', '2026-06-01T08:00:00.000Z');

-- Fournisseurs
INSERT OR IGNORE INTO fournisseurs (id, nom, contact_nom, telephone, email, adresse, created_at) VALUES
('fourn-01', 'Maison Lanvin Cérémonie', 'M. Pierre Lanvin', '01 42 68 24 00', 'contact@lanvin-ceremonie.fr', '15 Rue du Faubourg Saint-Honoré, Paris', '2026-06-01T09:00:00.000Z'),
('fourn-02', 'Hugo Boss Tailoring', 'Mme Clara Weber', '01 53 43 00 00', 'pro@hugoboss.de', 'Boulevard Malesherbes, Paris', '2026-06-01T09:00:00.000Z'),
('fourn-03', 'Santoni Bottier', 'M. Andrea Santoni', '+39 0733 8191', 'commercial@santonishoes.it', 'Via Monte Napoleone, Milano', '2026-06-01T09:00:00.000Z'),
('fourn-04', 'Scabal Fabrics & Suits', 'M. Jacques Scabal', '+32 2 217 98 00', 'orders@scabal.com', 'Boulevard d''Anvers, Bruxelles', '2026-06-01T09:00:00.000Z');

-- Catégories
INSERT OR IGNORE INTO categories (id, nom, type, description, created_at) VALUES
('cat-01', 'Smokings Cérémonie', 'costume', 'Smokings col châle ou pointe satinés pour galas et mariages', '2026-06-01T09:00:00.000Z'),
('cat-02', 'Costumes 3 Pièces', 'costume', 'Costumes veste, gilet et pantalon en laine fine', '2026-06-01T09:00:00.000Z'),
('cat-03', 'Costumes 2 Pièces', 'costume', 'Costumes lounge modernes business chic et cérémonies de jour', '2026-06-01T09:00:00.000Z'),
('cat-04', 'Chaussures Richelieu', 'chaussure', 'Richelieus one-cut et bout droit cuir glacé', '2026-06-01T09:00:00.000Z'),
('cat-05', 'Chaussures Derbies', 'chaussure', 'Derbies élégantes patine marron ou noire', '2026-06-01T09:00:00.000Z'),
('cat-06', 'Accessoires Prestige', 'accessoire', 'Nœuds papillon en soie, boutons de manchette et lavallières', '2026-06-01T09:00:00.000Z');

-- 20 Articles Réalistes
INSERT OR IGNORE INTO articles (id, categorie_id, fournisseur_id, reference, nom, marque, couleur, description, prix_location_centimes, prix_vente_centimes, caution_suggeree_centimes, frais_nettoyage_centimes, est_actif, created_at, updated_at) VALUES
('art-001', 'cat-01', 'fourn-01', 'SMK-NOIR-01', 'Smoking Col Châle Soie Noir', 'Lanvin', 'Noir Intense', 'Smoking d''apparat en laine vierge Super 130s avec revers châle en satin de soie', 18000, 89000, 45000, 1500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-002', 'cat-01', 'fourn-01', 'SMK-BLEU-02', 'Smoking Midnight Blue Col Pointe', 'Lanvin', 'Bleu Nuit', 'Smoking de cocktail coupe ajustée avec revers pointe contrastés noir satin', 19000, 95000, 50000, 1500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-003', 'cat-01', 'fourn-04', 'SMK-BLNC-03', 'Veste Smoking Blanc Cassé Gatsby', 'Scabal', 'Ivoire / Blanc cassé', 'Veste smoking d''été croisée en faille de soie avec pantalon noir assorti', 21000, 110000, 60000, 2000, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-004', 'cat-01', 'fourn-02', 'SMK-VERT-04', 'Smoking Velours Vert Émeraude', 'Hugo Boss', 'Vert Émeraude', 'Smoking tendance d''hiver en velours de coton rasé avec col châle noir', 19500, 98000, 50000, 2000, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-005', 'cat-02', 'fourn-02', 'CST-3P-ROYAL', 'Costume 3 Pièces Bleu Royal Cérémonie', 'Hugo Boss', 'Bleu Royal', 'Costume complet avec gilet croisé 6 boutons et doublure nacrée', 15000, 75000, 40000, 1200, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-006', 'cat-02', 'fourn-04', 'CST-3P-GRIS', 'Costume 3 Pièces Prince de Galles', 'Scabal', 'Gris Perle', 'Laine fine d''été motif discret avec revers cran ouvert et gilet passepoilé', 16500, 82000, 42000, 1200, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-007', 'cat-02', 'fourn-01', 'CST-3P-BORDO', 'Costume 3 Pièces Bordeaux Impérial', 'Lanvin', 'Bordeaux Lie-de-vin', 'Teinte festive pour marié audacieux, tombé impeccable et gilet contrasté', 17000, 85000, 45000, 1200, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-008', 'cat-02', 'fourn-02', 'CST-3P-VERT', 'Costume 3 Pièces Vert Forêt Tissé', 'Hugo Boss', 'Vert Sapin', 'Tissu peigné sergé, gilet coordonné, coupe cintrée contemporaine', 16000, 79000, 40000, 1200, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-009', 'cat-03', 'fourn-02', 'CST-2P-ANTHR', 'Costume 2 Pièces Anthracite Slim', 'Hugo Boss', 'Gris Anthracite', 'Costume moderne passe-partout pour invités et témoins', 12000, 59000, 30000, 1000, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-010', 'cat-03', 'fourn-04', 'CST-2P-BEIGE', 'Costume 2 Pièces Lin & Soie Sable', 'Scabal', 'Beige Sable', 'Idéal cérémonies champêtres ou en bord de mer, thermorégulant', 14000, 69000, 35000, 1500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-011', 'cat-03', 'fourn-01', 'CST-2P-NAVY', 'Costume 2 Pièces Navy Coupe Classique', 'Lanvin', 'Bleu Marine', 'Élégance intemporelle pour tout type d''événement formel', 13000, 64000, 32000, 1000, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-012', 'cat-03', 'fourn-02', 'CST-2P-CARRO', 'Costume 2 Pièces Carrelé Vintage', 'Hugo Boss', 'Brun Noisette', 'Motif carreaux fins style gentleman champêtre', 13500, 67000, 34000, 1000, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-013', 'cat-04', 'fourn-03', 'CHS-RCH-GLAC', 'Richelieu Bout Droit Cuir Glacé Noir', 'Santoni', 'Noir Miroir', 'Cousu Goodyear, semelle cuir avec patin injecté, brillance exceptionnelle', 6000, 48000, 18000, 500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-014', 'cat-04', 'fourn-03', 'CHS-RCH-ONEC', 'Richelieu One-Cut Cuir Cognac Patiné', 'Santoni', 'Cognac Marron', 'Réalisé dans une seule pièce de cuir sans couture latérale, patine main', 6500, 52000, 20000, 500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-015', 'cat-04', 'fourn-03', 'CHS-RCH-VERN', 'Richelieu Vernis Noir Opéra', 'Santoni', 'Noir Verni', 'Soulier de smoking par excellence, cuir vernis italien grand luxe', 7000, 56000, 22000, 500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-016', 'cat-05', 'fourn-03', 'CHS-DRB-BRUN', 'Derbies Cuir Lisse Ébène', 'Santoni', 'Brun Ébène', 'Confortable pour pied fort, élégance sobre et raffinée', 5500, 44000, 16000, 500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-017', 'cat-05', 'fourn-03', 'CHS-DRB-DBLB', 'Derbies Double Boucle Bordeaux', 'Santoni', 'Bordeaux Patiné', 'Boucles palladium, ligne très sartoriale', 6500, 53000, 20000, 500, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-018', 'cat-06', 'fourn-01', 'ACC-NDP-SOIE', 'Nœud Papillon Satin Soie Noir à Nouer', 'Lanvin', 'Noir Satin', 'Nœud traditionnel ajustable en pure soie', 2500, 9500, 5000, 0, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-019', 'cat-06', 'fourn-01', 'ACC-BTM-NCRR', 'Boutons de Manchette Nacre & Argent', 'Lanvin', 'Nacre Argentée', 'Monture en argent 925 et insert de nacre naturelle', 3000, 15000, 8000, 0, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('art-020', 'cat-06', 'fourn-04', 'ACC-CRT-CEIN', 'Ceinture Smoking Cuir & Ceinture Satin', 'Scabal', 'Noir', 'Set complet ceinture de smoking plissée et bretelles d''apparat', 3500, 18000, 10000, 0, 1, '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z');

-- Déclinaisons physiques / Variantes de stock pour ces articles
INSERT OR IGNORE INTO variantes_stock (id, article_id, code_barre, taille, sous_taille, etat_usure, statut, nb_locations, notes, created_at, updated_at) VALUES
('var-001', 'art-001', 'BAR-SMK-001-48', '48', 'Drop 7', 'excellent', 'disponible', 4, 'Parfait état, nettoyé pressing', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-002', 'art-001', 'BAR-SMK-001-50', '50', 'Drop 7', 'excellent', 'en_location', 6, 'En cours de location contrat LOC-2026-0001', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-003', 'art-001', 'BAR-SMK-001-52', '52', 'Drop 8', 'neuf', 'disponible', 1, 'Entré récemment', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-004', 'art-002', 'BAR-SMK-002-50', '50', 'Standard', 'bon', 'disponible', 8, 'Retouche ourlet faite', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-005', 'art-002', 'BAR-SMK-002-52', '52', 'Standard', 'excellent', 'reserve', 3, 'Réservé pour week-end prochain', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-006', 'art-003', 'BAR-SMK-003-48', '48', 'Court', 'excellent', 'disponible', 2, 'Veste et pantalon ok', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-007', 'art-004', 'BAR-SMK-004-50', '50', 'Standard', 'excellent', 'au_pressing', 5, 'En pressing retour prévu jeudi', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-008', 'art-005', 'BAR-CST-005-50', '50', 'Drop 7', 'excellent', 'en_location', 7, 'Contrat LOC-2026-0002', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-009', 'art-005', 'BAR-CST-005-52', '52', 'Drop 7', 'excellent', 'disponible', 4, 'Avec gilet coordonné', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-010', 'art-006', 'BAR-CST-006-48', '48', 'Standard', 'bon', 'disponible', 5, 'Rien à signaler', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-011', 'art-007', 'BAR-CST-007-52', '52', 'Drop 8', 'excellent', 'disponible', 2, 'Très bon état', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-012', 'art-008', 'BAR-CST-008-50', '50', 'Standard', 'excellent', 'disponible', 3, 'Nettoyé', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-013', 'art-009', 'BAR-CST-009-48', '48', 'Slim', 'usage', 'en_retouche', 9, 'Bouton à recoudre', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-014', 'art-010', 'BAR-CST-010-50', '50', 'Standard', 'excellent', 'disponible', 4, 'Sable lin', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-015', 'art-011', 'BAR-CST-011-52', '52', 'Classique', 'excellent', 'disponible', 6, 'Prêt à l''emploi', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-016', 'art-012', 'BAR-CST-012-50', '50', 'Standard', 'bon', 'disponible', 3, 'Costume tweed carreaux', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-017', 'art-013', 'BAR-CHS-013-42', '42', 'Bout droit', 'excellent', 'disponible', 5, 'Cirées et glacées', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-018', 'art-013', 'BAR-CHS-013-43', '43', 'Bout droit', 'bon', 'en_location', 8, 'Contrat LOC-2026-0003', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-019', 'art-014', 'BAR-CHS-014-43', '43', 'One cut', 'excellent', 'disponible', 4, 'Patine Cognac sublime', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-020', 'art-015', 'BAR-CHS-015-42', '42', 'Vernis', 'excellent', 'disponible', 3, 'Chaussures opéra vernies', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-021', 'art-016', 'BAR-CHS-016-44', '44', 'Largeur E', 'bon', 'disponible', 4, 'Très confortables', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-022', 'art-017', 'BAR-CHS-017-43', '43', 'Double boucle', 'excellent', 'disponible', 2, 'Cuir bordeaux patiné', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-023', 'art-018', 'BAR-ACC-018-U', 'TU', 'Ajustable', 'excellent', 'disponible', 12, 'Nœud papillon noir', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-024', 'art-019', 'BAR-ACC-019-U', 'TU', 'Standard', 'excellent', 'disponible', 10, 'Boutons nacre', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z'),
('var-025', 'art-020', 'BAR-ACC-020-U', 'TU', 'Standard', 'excellent', 'disponible', 7, 'Ceinture smoking satinée', '2026-06-01T10:00:00.000Z', '2026-06-01T10:00:00.000Z');

-- 10 Clients Réalistes
INSERT OR IGNORE INTO clients (id, prenom, nom, email, telephone, telephone_secondaire, adresse, ville, code_postal, numero_cni, notes, est_bloque, created_at, updated_at) VALUES
('cli-001', 'Jean', 'Dupont', 'jean.dupont@gmail.com', '06 12 34 56 78', '01 45 67 89 10', '14 Rue de la Paix', 'Paris', '75002', 'CNI-FR-220975102934', 'Client fidèle, taille veste 50 / pantalon 42, aime les coupes ajustées', 0, '2026-06-10T14:00:00.000Z', '2026-06-10T14:00:00.000Z'),
('cli-002', 'Alexandre', 'Mercier', 'alex.mercier@orange.fr', '07 98 76 54 32', NULL, '8 Avenue des États-Unis', 'Versailles', '78000', 'PASS-FR-19AB89201', 'Mariage prévu le 18/09, préfère le bleu nuit', 0, '2026-06-15T11:00:00.000Z', '2026-06-15T11:00:00.000Z'),
('cli-003', 'Maxime', 'Laroche', 'max.laroche@outlook.com', '06 55 44 33 22', '06 77 88 99 00', '25 Boulevard Victor Hugo', 'Neuilly-sur-Seine', '92200', 'PERM-FR-8409124401', 'Témoin de mariage, taille 48 slim', 0, '2026-06-20T16:00:00.000Z', '2026-06-20T16:00:00.000Z'),
('cli-004', 'Thomas', 'Martin', 'thomas.martin@sfr.fr', '06 99 88 77 66', NULL, '3 Rue de la République', 'Lyon', '69002', 'CNI-FR-210469281923', 'Événement gala annuel entreprise', 0, '2026-07-01T10:00:00.000Z', '2026-07-01T10:00:00.000Z'),
('cli-005', 'Lucas', 'Bernard', 'lucas.bernard@free.fr', '07 11 33 55 77', NULL, '12 Allée des Tilleuls', 'Boulogne-Billancourt', '92100', 'CNI-FR-230192847102', 'Pointure 43, attention cou-de-pied fort', 0, '2026-07-05T09:30:00.000Z', '2026-07-05T09:30:00.000Z'),
('cli-006', 'Marc', 'Lefebvre', 'marc.lefebvre@wanadoo.fr', '06 44 22 11 00', NULL, '45 Rue Nationale', 'Lille', '59000', 'CNI-FR-180959281723', 'Retardataire régulier, exiger caution bancaire forte', 0, '2026-07-12T15:20:00.000Z', '2026-07-12T15:20:00.000Z'),
('cli-007', 'Guillaume', 'Dubois', 'g.dubois@entreprise.com', '06 33 11 22 44', '01 40 20 30 40', '18 Rue du Commerce', 'Nantes', '44000', 'PASS-FR-22XY99182', 'Costume lin pour mariage estival', 0, '2026-07-18T14:45:00.000Z', '2026-07-18T14:45:00.000Z'),
('cli-008', 'Antoine', 'Moreau', 'antoine.moreau@icloud.com', '07 88 66 44 22', NULL, '5 Boulevard Gambetta', 'Bordeaux', '33000', 'CNI-FR-200333918273', 'Location smoking black tie', 0, '2026-08-01T16:10:00.000Z', '2026-08-01T16:10:00.000Z'),
('cli-009', 'Julien', 'Roux', 'julien.roux@gmail.com', '06 77 55 33 11', NULL, '9 Place Bellecour', 'Lyon', '69002', 'PERM-FR-7708691029', 'Costume bordeaux 3P pour fiançailles', 0, '2026-08-10T11:30:00.000Z', '2026-08-10T11:30:00.000Z'),
('cli-010', 'Nicolas', 'Fournier', 'nicolas.fournier@protonmail.com', '06 00 22 44 66', NULL, '77 Rue de Rennes', 'Paris', '75006', 'CNI-FR-240575192837', 'Client VIP festival de Cannes', 0, '2026-08-15T18:00:00.000Z', '2026-08-15T18:00:00.000Z');

-- 15 Locations sur les 3 derniers mois (Juin, Juillet, Août, Septembre 2026)
INSERT OR IGNORE INTO locations (id, numero_location, client_id, utilisateur_id, statut, date_evenement, date_retrait_prevue, date_retrait_effective, date_retour_prevue, date_retour_effective, montant_total_ht_centimes, tva_taux, montant_total_ttc_centimes, frais_nettoyage_centimes, frais_retard_centimes, montant_caution_centimes, statut_caution, notes_caution, notes, created_at, updated_at) VALUES
-- 1. Juin (Terminée)
('loc-001', 'LOC-2026-0001', 'cli-001', 'usr-001', 'retourne', '2026-06-20', '2026-06-18T10:00:00.000Z', '2026-06-18T10:30:00.000Z', '2026-06-22T18:00:00.000Z', '2026-06-22T17:30:00.000Z', 15000, 20.0, 18000, 1500, 0, 45000, 'restituee', 'Chèque caution rendu au client sans dommage', 'Mariage frère, tout rendu impeccable', '2026-06-10T14:30:00.000Z', '2026-06-22T17:30:00.000Z'),
-- 2. Juin (Terminée)
('loc-002', 'LOC-2026-0002', 'cli-003', 'usr-001', 'retourne', '2026-06-27', '2026-06-25T14:00:00.000Z', '2026-06-25T14:15:00.000Z', '2026-06-29T18:00:00.000Z', '2026-06-29T16:45:00.000Z', 12500, 20.0, 15000, 1200, 0, 40000, 'restituee', 'Empreinte CB libérée', 'Témoin mariage', '2026-06-20T16:30:00.000Z', '2026-06-29T16:45:00.000Z'),
-- 3. Juillet (Terminée)
('loc-003', 'LOC-2026-0003', 'cli-004', 'usr-002', 'retourne', '2026-07-04', '2026-07-02T09:00:00.000Z', '2026-07-02T09:10:00.000Z', '2026-07-06T18:00:00.000Z', '2026-07-06T17:00:00.000Z', 17500, 20.0, 21000, 2000, 0, 60000, 'restituee', 'Caution espèces rendue', 'Smoking Gatsby', '2026-07-01T10:15:00.000Z', '2026-07-06T17:00:00.000Z'),
-- 4. Juillet (Terminée)
('loc-004', 'LOC-2026-0004', 'cli-005', 'usr-001', 'retourne', '2026-07-11', '2026-07-09T15:00:00.000Z', '2026-07-09T15:30:00.000Z', '2026-07-13T18:00:00.000Z', '2026-07-13T18:30:00.000Z', 11667, 20.0, 14000, 1500, 0, 35000, 'restituee', 'Chèque restitué', 'Costume lin sable', '2026-07-05T10:00:00.000Z', '2026-07-13T18:30:00.000Z'),
-- 5. Juillet (Terminée)
('loc-005', 'LOC-2026-0005', 'cli-007', 'usr-002', 'retourne', '2026-07-25', '2026-07-23T10:00:00.000Z', '2026-07-23T10:20:00.000Z', '2026-07-27T18:00:00.000Z', '2026-07-27T17:15:00.000Z', 13750, 20.0, 16500, 1200, 0, 42000, 'restituee', 'Empreinte libérée', 'Costume Prince de Galles', '2026-07-18T15:00:00.000Z', '2026-07-27T17:15:00.000Z'),
-- 6. Août (Terminée)
('loc-006', 'LOC-2026-0006', 'cli-008', 'usr-001', 'retourne', '2026-08-08', '2026-08-06T14:00:00.000Z', '2026-08-06T14:40:00.000Z', '2026-08-10T18:00:00.000Z', '2026-08-10T16:00:00.000Z', 19583, 20.0, 23500, 1500, 0, 60000, 'restituee', 'Chèque restitué', 'Smoking + Richelieu One-Cut', '2026-08-01T16:30:00.000Z', '2026-08-10T16:00:00.000Z'),
-- 7. Août (Terminée)
('loc-007', 'LOC-2026-0007', 'cli-009', 'usr-002', 'retourne', '2026-08-15', '2026-08-13T11:00:00.000Z', '2026-08-13T11:15:00.000Z', '2026-08-17T18:00:00.000Z', '2026-08-17T17:40:00.000Z', 14167, 20.0, 17000, 1200, 0, 45000, 'restituee', 'Empreinte CB libérée', 'Costume Bordeaux 3P', '2026-08-10T11:45:00.000Z', '2026-08-17T17:40:00.000Z'),
-- 8. Août (Terminée)
('loc-008', 'LOC-2026-0008', 'cli-010', 'usr-001', 'retourne', '2026-08-22', '2026-08-20T17:00:00.000Z', '2026-08-20T17:25:00.000Z', '2026-08-24T18:00:00.000Z', '2026-08-24T18:10:00.000Z', 20833, 20.0, 25000, 2000, 0, 65000, 'restituee', 'Empreinte CB libérée', 'Smoking Midnight Blue + Chaussures Vernies', '2026-08-15T18:30:00.000Z', '2026-08-24T18:10:00.000Z'),
-- 9. Août (Terminée)
('loc-009', 'LOC-2026-0009', 'cli-002', 'usr-002', 'retourne', '2026-08-29', '2026-08-27T10:00:00.000Z', '2026-08-27T10:15:00.000Z', '2026-08-31T18:00:00.000Z', '2026-08-31T16:50:00.000Z', 10000, 20.0, 12000, 1000, 0, 30000, 'restituee', 'Caution espèces rendue', 'Costume Anthracite 2P', '2026-08-20T09:00:00.000Z', '2026-08-31T16:50:00.000Z'),
-- 10. Septembre (Terminée)
('loc-010', 'LOC-2026-0010', 'cli-004', 'usr-001', 'retourne', '2026-09-05', '2026-09-03T14:00:00.000Z', '2026-09-03T14:10:00.000Z', '2026-09-07T18:00:00.000Z', '2026-09-07T17:30:00.000Z', 15833, 20.0, 19000, 1500, 0, 50000, 'restituee', 'Chèque rendu', 'Smoking Midnight Blue', '2026-08-28T14:00:00.000Z', '2026-09-07T17:30:00.000Z'),
-- 11. Septembre (En Retard - Alerte activée !)
('loc-011', 'LOC-2026-0011', 'cli-006', 'usr-001', 'en_retard', '2026-09-10', '2026-09-08T11:00:00.000Z', '2026-09-08T11:30:00.000Z', '2026-09-12T18:00:00.000Z', NULL, 15000, 19.0, 18000, 1500, 4000, 45000, 'cheque_retenu', 'Chèque de 45 000 DA retenu en coffre', 'Non restitué le 12/09 ! +4 000 DA pénalité de retard appliquée', '2026-09-01T15:00:00.000Z', '2026-09-14T09:00:00.000Z'),
-- 12. Septembre (En cours - Retour attendu aujourd'hui 14/09 !)
('loc-012', 'LOC-2026-0012', 'cli-005', 'usr-002', 'en_cours', '2026-09-12', '2026-09-11T16:00:00.000Z', '2026-09-11T16:30:00.000Z', '2026-09-14T19:00:00.000Z', NULL, 5000, 19.0, 6000, 500, 0, 18000, 'empreinte_cb', 'Empreinte CB active', 'Retour prévu ce soir avant fermeture', '2026-09-05T11:00:00.000Z', '2026-09-11T16:30:00.000Z'),
-- 13. Septembre (En cours - Retour demain 15/09 - J-1 !)
('loc-013', 'LOC-2026-0013', 'cli-001', 'usr-001', 'en_cours', '2026-09-13', '2026-09-11T14:00:00.000Z', '2026-09-11T14:20:00.000Z', '2026-09-15T18:00:00.000Z', NULL, 12500, 19.0, 15000, 1200, 0, 40000, 'cheque_retenu', 'Chèque en coffre', 'Costume 3P Bleu Royal', '2026-09-06T10:00:00.000Z', '2026-09-11T14:20:00.000Z'),
-- 14. Septembre (Réservé - Retrait dans 2 jours)
('loc-014', 'LOC-2026-0014', 'cli-002', 'usr-001', 'reserve', '2026-09-19', '2026-09-17T10:00:00.000Z', NULL, '2026-09-21T18:00:00.000Z', NULL, 19583, 19.0, 23500, 1500, 0, 60000, 'empreinte_cb', 'Empreinte CB à valider au départ', 'Mariage civil et religieux', '2026-09-08T15:00:00.000Z', '2026-09-08T15:00:00.000Z'),
-- 15. Septembre (Réservé - Retrait dans 5 jours)
('loc-015', 'LOC-2026-0015', 'cli-003', 'usr-002', 'reserve', '2026-09-21', '2026-09-19T14:00:00.000Z', NULL, '2026-09-23T18:00:00.000Z', NULL, 16250, 19.0, 19500, 2000, 0, 50000, 'non_recue', 'Acompte déjà versé', 'Smoking velours vert émeraude', '2026-09-10T16:00:00.000Z', '2026-09-10T16:00:00.000Z');

-- Lignes de location associées
INSERT OR IGNORE INTO lignes_location (id, location_id, variante_id, type_ligne, prix_unitaire_centimes, caution_centimes, etat_depart, etat_retour, est_rendu, date_retour) VALUES
('lig-001', 'loc-001', 'var-001', 'location', 18000, 45000, 'excellent', 'excellent', 1, '2026-06-22T17:30:00.000Z'),
('lig-002', 'loc-002', 'var-008', 'location', 15000, 40000, 'excellent', 'excellent', 1, '2026-06-29T16:45:00.000Z'),
('lig-003', 'loc-003', 'var-006', 'location', 21000, 60000, 'excellent', 'excellent', 1, '2026-07-06T17:00:00.000Z'),
('lig-004', 'loc-004', 'var-014', 'location', 14000, 35000, 'excellent', 'excellent', 1, '2026-07-13T18:30:00.000Z'),
('lig-005', 'loc-005', 'var-010', 'location', 16500, 42000, 'bon', 'bon', 1, '2026-07-27T17:15:00.000Z'),
('lig-006', 'loc-006', 'var-001', 'location', 18000, 45000, 'excellent', 'excellent', 1, '2026-08-10T16:00:00.000Z'),
('lig-007', 'loc-006', 'var-019', 'location', 5500, 15000, 'excellent', 'excellent', 1, '2026-08-10T16:00:00.000Z'),
('lig-008', 'loc-007', 'var-011', 'location', 17000, 45000, 'excellent', 'excellent', 1, '2026-08-17T17:40:00.000Z'),
('lig-009', 'loc-008', 'var-004', 'location', 19000, 50000, 'excellent', 'excellent', 1, '2026-08-24T18:10:00.000Z'),
('lig-010', 'loc-008', 'var-020', 'location', 6000, 15000, 'excellent', 'excellent', 1, '2026-08-24T18:10:00.000Z'),
('lig-011', 'loc-009', 'var-013', 'location', 12000, 30000, 'bon', 'bon', 1, '2026-08-31T16:50:00.000Z'),
('lig-012', 'loc-010', 'var-004', 'location', 19000, 50000, 'excellent', 'excellent', 1, '2026-09-07T17:30:00.000Z'),
('lig-013', 'loc-011', 'var-002', 'location', 18000, 45000, 'excellent', NULL, 0, NULL),
('lig-014', 'loc-012', 'var-018', 'location', 6000, 18000, 'excellent', NULL, 0, NULL),
('lig-015', 'loc-013', 'var-008', 'location', 15000, 40000, 'excellent', NULL, 0, NULL),
('lig-016', 'loc-014', 'var-005', 'location', 19000, 50000, 'excellent', NULL, 0, NULL),
('lig-017', 'loc-015', 'var-007', 'location', 19500, 50000, 'excellent', NULL, 0, NULL);

-- Paiements Réalistes (acomptes, soldes, cautions)
INSERT OR IGNORE INTO paiements (id, location_id, vente_id, utilisateur_id, montant_centimes, type_paiement, moyen_paiement, reference_transaction, notes, date_paiement) VALUES
('pay-001', 'loc-001', NULL, 'usr-001', 18000, 'solde', 'carte_bancaire', 'CB-20260618-9128', 'Paiement intégral', '2026-06-18T10:30:00.000Z'),
('pay-002', 'loc-002', NULL, 'usr-001', 15000, 'solde', 'carte_bancaire', 'CB-20260625-3341', 'Paiement TPE', '2026-06-25T14:15:00.000Z'),
('pay-003', 'loc-003', NULL, 'usr-002', 21000, 'solde', 'especes', 'ESP-20260702', 'Espèces comptoir', '2026-07-02T09:10:00.000Z'),
('pay-004', 'loc-004', NULL, 'usr-001', 14000, 'solde', 'carte_bancaire', 'CB-20260709-1823', 'CB sans contact', '2026-07-09T15:30:00.000Z'),
('pay-005', 'loc-005', NULL, 'usr-002', 16500, 'solde', 'virement', 'VIR-FR-76192837', 'Virement bancaire reçu', '2026-07-23T10:20:00.000Z'),
('pay-006', 'loc-006', NULL, 'usr-001', 23500, 'solde', 'carte_bancaire', 'CB-20260806-0019', 'Règlement total', '2026-08-06T14:40:00.000Z'),
('pay-007', 'loc-007', NULL, 'usr-002', 17000, 'solde', 'carte_bancaire', 'CB-20260813-9941', 'CB terminal 1', '2026-08-13T11:15:00.000Z'),
('pay-008', 'loc-008', NULL, 'usr-001', 25000, 'solde', 'carte_bancaire', 'CB-20260820-8812', 'Paiement retrait', '2026-08-20T17:25:00.000Z'),
('pay-009', 'loc-009', NULL, 'usr-002', 12000, 'solde', 'especes', 'ESP-20260827', 'Espèces', '2026-08-27T10:15:00.000Z'),
('pay-010', 'loc-010', NULL, 'usr-001', 19000, 'solde', 'carte_bancaire', 'CB-20260903-7711', 'TPE 2', '2026-09-03T14:10:00.000Z'),
('pay-011', 'loc-011', NULL, 'usr-001', 18000, 'solde', 'carte_bancaire', 'CB-20260908-1290', 'Location payée, reste pénalités retard', '2026-09-08T11:30:00.000Z'),
('pay-012', 'loc-012', NULL, 'usr-002', 6000, 'solde', 'carte_bancaire', 'CB-20260911-3481', 'Payé au retrait', '2026-09-11T16:30:00.000Z'),
('pay-013', 'loc-013', NULL, 'usr-001', 15000, 'solde', 'carte_bancaire', 'CB-20260911-4490', 'Payé', '2026-09-11T14:20:00.000Z'),
('pay-014', 'loc-014', NULL, 'usr-001', 5000, 'acompte', 'carte_bancaire', 'CB-20260908-5512', 'Acompte réservation (solde dû : 18 500 DA)', '2026-09-08T15:00:00.000Z'),
('pay-015', 'loc-015', NULL, 'usr-002', 5000, 'acompte', 'carte_bancaire', 'CB-20260910-6623', 'Acompte réservation (solde dû : 14 500 DA)', '2026-09-10T16:00:00.000Z');

-- Alertes de retour actives
INSERT OR IGNORE INTO alertes (id, location_id, client_id, type_alerte, date_echeance, est_declenchee, date_declenchement, est_traitee, created_at) VALUES
('alt-001', 'loc-011', 'cli-006', 'retard', '2026-09-12T18:00:00.000Z', 1, '2026-09-13T09:00:00.000Z', 0, '2026-09-08T11:30:00.000Z'),
('alt-002', 'loc-012', 'cli-005', 'jour_j', '2026-09-14T19:00:00.000Z', 1, '2026-09-14T08:00:00.000Z', 0, '2026-09-11T16:30:00.000Z'),
('alt-003', 'loc-013', 'cli-001', 'j_minus_1', '2026-09-15T18:00:00.000Z', 1, '2026-09-14T08:00:00.000Z', 0, '2026-09-11T14:20:00.000Z');
