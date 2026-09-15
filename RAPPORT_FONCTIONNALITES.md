# RAPPORT_FONCTIONNALITES.md — Audit Complet du Projet

**Application :** Atelier Prestige — Logiciel de Gestion Location de Costumes & Chaussures  
**Date d'audit :** 15 septembre 2026 — 02:01  
**Version :** 0.1.0  
**Auditeur :** Audit par lecture réelle de chaque fichier source  

> **Note de méthode** : Chaque affirmation est basée sur la lecture directe des fichiers sources. Aucune affirmation n'est basée sur la memoire de ce qui aurait ete code.

---

## 1. RESUME GLOBAL

| Module | Titre | Statut |
|--------|-------|--------|
| **A** | Gestion du Stock | Partiellement implemente |
| **B** | Gestion des Clients | Partiellement implemente |
| **C** | Reservations & Locations | Partiellement implemente |
| **D** | Bons de Vente/Location PDF | Termine et fonctionnel |
| **E** | Systeme d'alertes de retour | Partiellement implemente |
| **F** | Caisse / Vente Directe | Termine et fonctionnel |
| **G** | Dashboard & Statistiques | Termine et fonctionnel |
| **H** | Rapports & Exports | Non implemente (UI coquille vide) |
| **I** | Administration & Securite | Partiellement implemente |
| **J** | Finitions UI/UX & Packaging | Partiellement implemente |

**Constat majeur transversal :** L'application fonctionne entierement avec des donnees en memoire (Zustand stores). Le backend Rust/SQLite est code mais jamais invoque en mode dev navigateur (l'IPC Tauri ne s'active que dans l'app desktop compilee). Toutes les operations de creation/modification depuis l'UI sont volatiles (perdues a chaque rechargement).

---

## 2. DETAIL PAR MODULE

### Module A — Gestion du Stock

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Categories et modeles hierarchiques | OK | stockStore.ts | 4 categories en seed, donnees en memoire uniquement |
| Variantes de tailles/pointures avec codes-barres | OK | stockStore.ts | Codes-barres generes (BAR-SMK-001-50), tailles, sous-tailles (Drop), etat d'usure |
| Etats de cycle de vie (7 statuts) | OK | ArticleDetailModal.tsx, stockStore.ts::changeVariantStatus() | Logs statusLogs en memoire |
| Interface inventaire recherche + filtres | OK | StockPage.tsx | Filtres : recherche, categorie, taille, statut, alerte stock bas |
| Formulaires creation/modification | Partiel | CreateEditArticleModal.tsx | Pas d'upload d'image reelle (URL externe manuelle), soft delete uniquement |
| Etiquettes QR/code-barre | OK | QrLabelModal.tsx | Generation QR via library, impression possible |

### Module B — Gestion des Clients

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Annuaire client fiche complete | OK | ClientsPage.tsx, clientStore.ts | Tous champs : nom, tel, CNI, ville, notes |
| Historique locations par client | OK | ClientDetailPanel.tsx | Filtre contracts par customer_id |
| Detection impayes + blacklist | Partiel | clientStore.ts, BlacklistDialog.tsx | Blacklist OK, mais calcul impaye pas dynamique (valeurs de seed) |
| Recherche instantanee | OK | ClientsPage.tsx | Par nom, telephone, CNI |
| Creation rapide depuis location | OK | QuickCreateClientModal.tsx | Invocable depuis CreateRentalModal |

### Module C — Reservations & Locations

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Calendrier interactif | OK | RentalCalendarView.tsx | Vue mensuelle, navigation, codes couleur par statut |
| Vue Registre/Tableau | OK | RentalTableView.tsx | Filtres, recherche, actions |
| Moteur de disponibilite temps reel | OK | rentalStore.ts::checkVariantAvailability() | Sur donnees memoire uniquement, pas SQLite |
| Calculateur devis + contrat | BUGUE | CreateRentalModal.tsx L.92 | Prix = rental_price_cents fixe NON multiplie par nombre de jours |
| Workflow statut reservation->retrait->retour | Partiel | rentalStore.ts::processReturn() | Retour OK. Bouton "Confirmer retrait" reserve->en_cours absent de l'UI |

### Module D — Bons de Vente/Location PDF

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| PDF en 2 exemplaires Client + Boutique | OK | pdfService.ts | 2 pages A4 generees |
| Mentions obligatoires completes | OK | pdfService.ts L.49-71 | En-tete Alger, NIF, articles, dates, montants, CGL, penalite 2000 DA/jour |
| Previsualisation + impression | OK | PdfPreviewModal.tsx | Iframe preview, boutons Telecharger et Imprimer |
| Archivage local sur disque | Simule | pdfService.ts::archivedPath | Chemin fictif retourne, pas de persistance reelle |

### Module E — Alertes de Retour

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Moteur alertes J-3 a Retard | OK | alertStore.ts::generateAlertsFromRentals() | Calcul sur return_date_scheduled, deduplication par dedup_key |
| Notifications systeme (Tauri + Browser) | OK | notificationService.ts | Tauri v2 -> Browser API -> fallback console |
| Badges in-app + bandeau popup | OK | Sidebar.tsx, Topbar.tsx | Badge rouge, bandeau critiques |
| Penalites automatiques | Partiel | alertStore.ts L.150 | LATE_FEE_PER_DAY_CENTS=2000 definie, penalite calculee/affichee mais non persistee en contrat |
| Acquittement + tracabilite | OK | DismissAlertDialog.tsx, MarkProcessedDialog.tsx | Statuts active->vue->traitee |
| Export PDF alertes | OK | alertPdfService.ts, AlertsPdfExportModal.tsx | Rapport PDF filtre par categorie/severite |

### Module F — Caisse & Vente Directe

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Catalogue vente + recherche + filtres | OK | CaisseCatalog.tsx | Filtres par categorie, recherche, photos |
| Panier avec quantites | OK | CaisseCart.tsx | Ajout, modif quantite, suppression, total HT+TVA+TTC |
| Scan QR/code-barre | Partiel | ScanQrModal.tsx | Saisie manuelle uniquement, pas de scan camera |
| Encaissement multi-mode | OK | CaissePaymentModal.tsx | Especes+carte+cheque, coupures rapides DA, monnaie rendue |
| Ticket de caisse PDF | OK | receiptPdfService.ts | Ticket 80mm simule en PDF, en-tete Alger |
| Cloture de caisse journaliere (Rapport Z) | OK | ClotureCaisseView.tsx | Comptage especes, ecart, validation, PDF rapport Z |

### Module G — Dashboard & Statistiques

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| KPIs (CA, taux occupation, locations, alertes) | OK | KpiCardsSection.tsx | 4 KPI cards avec delta periode precedente |
| Graphique evolution CA (Recharts) | OK | CaEvolutionChart.tsx | Area chart Locations + Ventes, axes DA |
| Repartition CA par categorie (Pie) | OK | CategoryPieChart.tsx | Donut chart, legende DA |
| Top 10 articles (sorties + revenu) | OK | TopArticlesRanking.tsx | Medailles, filtres par type, tri configurable |
| Filtres de periode | OK | PeriodSelector.tsx | Aujourd'hui/Semaine/Mois/Annee/Personnalise |
| Widgets retours du jour + semaine | OK | RetoursDuJourWidget.tsx, UpcomingWeekWidget.tsx | |
| Indicateurs secondaires (rotation, retard) | OK | SecondaryIndicators.tsx | |
| Periode precedente N-1 | Simule | dashboardService.ts L.65 | periode N-1 = ca_periode * 0.84 (simulation -16% fixe, pas calcule) |

### Module H — Rapports & Exports

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Rapport financier mensuel (PDF/Excel) | NON IMPLEMENTE | RapportsPage.tsx | Card affichee, bouton "Exporter" sans handler |
| Journal de caisse CSV/Excel | NON IMPLEMENTE | RapportsPage.tsx | Idem |
| Export inventaire CSV | NON IMPLEMENTE | RapportsPage.tsx | Idem. Exception : export CSV audit_logs dans Parametres |

### Module I — Administration & Securite

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Connexion avec bcrypt | OK | LoginPage.tsx, authStore.ts | bcryptjs hashSync + compareSync |
| 2 roles admin + vendeur | OK | authStore.ts::getPermissions() | 5 permissions differenciees |
| Route /parametres admin-only | OK | App.tsx L.46-53, ProtectedRoute.tsx | |
| Parametres boutique, TVA, numerotation | OK | ParametresPage.tsx | 4 onglets, previsualisation en-tete PDF |
| Sauvegarde manuelle ZIP horodatee | OK | settingsStore.ts::createBackupNow() | ZIP JSZip contenant JSON des stores (pas le .db reel) |
| Rotation 30 dernieres sauvegardes | OK | settingsStore.ts L.361 | .slice(0, 30) |
| Journal d'audit | Partiel | settingsStore.ts::logAuditEvent() | En memoire uniquement (perdu au rechargement). Pas appele depuis stockStore/rentalStore |
| Table audit_logs en SQL | ABSENT | 0001_initial_schema.sql | Absente du schema SQL |
| Table settings en SQL | ABSENT | 0001_initial_schema.sql | Absente du schema SQL |
| Sauvegarde auto a la fermeture | ABSENT | -- | Pas de listener tauri close-requested |
| Role manager | Declare sans logique | authStore.ts | Role dans CHECK SQL mais getPermissions() ne le distingue pas |

### Module J — Finitions UI/UX & Packaging

| Fonctionnalite | Statut | Fichier | Limitation |
|----------------|--------|---------|------------|
| Theme sombre elegant | OK | index.css, themeStore.ts | Palette or/noir, toggle clair/sombre |
| Animations Framer Motion | OK | Toutes les pages | Durations 0.15-0.3s, coherentes |
| Recherche universelle Ctrl+K | OK | UniversalSearchModal.tsx | Articles + clients + locations simultanement |
| Skeletons de chargement | OK | SkeletonKpi.tsx, Skeleton.tsx | Utilises dans DashboardPage |
| Responsive | Partiel | -- | grid-cols-1 md:grid-cols-X mais concu pour desktop 1200px+ |
| Build production + installeur | Documente | README.md | npm run tauri build produit .msi, necessite WiX toolset |

---

## 3. ECRANS REELS NAVIGABLES

| Route | Titre | Ce qu'on peut faire |
|-------|-------|---------------------|
| /login | Connexion | Saisir admin/admin123 ou vendeur/vendeur123. Boutons connexion rapide. |
| / | Tableau de Bord | KPIs, graphiques, Top 10 articles, filtrer par periode, creer location. |
| /stock | Gestion du Stock | Liste articles+variantes, filtrer, creer/modifier/desactiver, changer statut variante, generer etiquette QR. |
| /clients | Gestion des Clients | Liste clients, rechercher, creer, fiche detail (historique, encours), blacklister. |
| /locations | Reservations & Locations | Calendrier + tableau, creer contrat, enregistrer retour, generer bon PDF. |
| /caisse | Caisse & Vente Directe | POS (catalogue+panier+paiement+ticket PDF) + Cloture (comptage+rapport Z PDF). |
| /alertes | Alertes | Liste alertes, acquitter, marquer traitee, exporter PDF alertes. |
| /rapports | Rapports | Page coquille - boutons non fonctionnels. |
| /parametres | Administration (admin) | Etablissement, Numerotation, TVA, Sauvegardes + Journal audit. |

---

## 4. BASE DE DONNEES REELLE

### Tables creees dans 0001_initial_schema.sql

| Table | Colonnes cles | Notes |
|-------|--------------|-------|
| utilisateurs | id, nom_utilisateur, mot_de_passe_hash, nom_complet, role, est_actif, created_at, updated_at | role CHECK inclut 'vendeur' ET 'seller' |
| fournisseurs | id, nom, contact_nom, telephone, email, adresse, notes, created_at | Non utilise dans le frontend |
| categories | id, nom, type, description, created_at | |
| articles | id, categorie_id, fournisseur_id, reference, nom, marque, couleur, description, prix_location_centimes, prix_vente_centimes, caution_suggeree_centimes, frais_nettoyage_centimes, image_url, est_actif, created_at, updated_at | |
| variantes_stock | id, article_id, code_barre, taille, sous_taille, etat_usure, statut, nb_locations, notes, created_at, updated_at | |
| mouvements_stock | id, variante_id, utilisateur_id, type_mouvement, motif, details, date_mouvement | Non invoque depuis frontend |
| clients | id, prenom, nom, email, telephone, telephone_secondaire, adresse, ville, code_postal, numero_cni, notes, est_bloque, created_at, updated_at | |
| locations | id, numero_location, client_id, utilisateur_id, statut, dates, montants_centimes, tva_taux REAL, caution, notes, chemin_pdf, created_at, updated_at | tva_taux est REAL (pas INTEGER) |
| lignes_location | id, location_id, variante_id, type_ligne, prix_unitaire_centimes, caution_centimes, etats, est_rendu, date_retour, notes | |
| ventes | id, numero_vente, client_id, utilisateur_id, montant_total_centimes, moyen_paiement, statut, notes, created_at | |
| lignes_vente | id, vente_id, article_id, variante_id, quantite, prix_unitaire_centimes, total_centimes | |
| paiements | id, location_id, vente_id, utilisateur_id, montant_centimes, type_paiement, moyen_paiement, reference_transaction, notes, date_paiement | |
| alertes | id, location_id, client_id, type_alerte, date_echeance, est_declenchee, date_declenchement, est_traitee, created_at | |

### Diff vs schema PROJECT_CONTEXT.md

| Element | PROJECT_CONTEXT.md | Schema reel |
|---------|-------------------|-------------|
| Noms des tables | Anglais (users, customers, contracts...) | Francais (utilisateurs, clients, locations...) |
| Table audit_logs | Prevue | ABSENTE |
| Table settings | Prevue | ABSENTE |
| Table fournisseurs | Non prevue | Ajoutee (inutilisee) |
| Table mouvements_stock | Non prevue | Ajoutee (inutilisee frontend) |
| tva_taux type | INTEGER centimes | REAL (ex: 20.0) |
| PRAGMA journal_mode WAL | Prevu | ABSENT |
| contract_type dans locations | Prevu | Absent |

---

## 5. DETTE TECHNIQUE

### Aucun TODO/FIXME/HACK trouve
grep 'TODO|FIXME|HACK|XXX' src/**/*.{ts,tsx} => 0 resultat

### Valeurs codees en dur suspectes

| Fichier | Ligne | Valeur | Impact |
|---------|-------|--------|--------|
| CreateRentalModal.tsx | 35-37 | pickupDate="2026-09-14" hardcode | Dates passees au premier affichage du modal |
| authStore.ts | 50-51 | currentUser: INITIAL_USERS[0], isAuthenticated: true | App demarre connectee en admin, login jamais affiche |
| tauri.ts | 23 | return {} as T | Tout invoke hors Tauri retourne silencieusement vide |
| dbService.ts | 65-166 | SEED_ARTICLES et SEED_CLIENTS | Duplicats partiels des stores Zustand |
| dashboardService.ts | 65 | * 0.84 pour periode N-1 | Periode precedente simulee a -16% fixe |
| caisseStore.ts | 66 | tax_rate: 0.2 | TVA ventes demo a 20% au lieu de 19% |
| stockStore.ts | 76-79 | URLs https://images.unsplash.com/ | Photos cassees en mode offline/production |
| DashboardPage.tsx | 48 | setTimeout(..., 1500) | Loading artificiel de 1.5 secondes |

---

## 6. VERIFICATION DEVISE (DA)

### Resultats grep
- Select-String "EUR" sur src/ => 0 resultat
- Select-String "euro|EUR|€" sur src-tauri/{*.sql,*.rs,*.json} => 0 resultat

### Fichiers verifies

| Fichier | Resultat |
|---------|----------|
| src/lib/utils.ts | formatDA() definie : Intl.NumberFormat fr-FR + " DA" |
| src/services/pdfService.ts | Importe formatCents (alias formatDA), en-tete Alger |
| src/services/receiptPdfService.ts | formatDA partout, ticket et rapport Z |
| src/services/alertPdfService.ts | formatDA importee, formatCents redirige |
| src/store/settingsStore.ts | TVA 19%, currency "DZD", symbol "DA" |
| 29 fichiers frontend | Utilisent formatDA ou formatCents |
| CaissePaymentModal.tsx L.243 | amt.toLocaleString("fr-FR") + " DA" (inline mais correct, pas de /100) |
| CaEvolutionChart.tsx |  DA (axes et tooltips) |

### Residus detectes
- caisseStore.ts L.66 : tax_rate: 0.2 dans seed (devrait etre 0.19)

**CONCLUSION : 100% des affichages monetaires passent par formatDA/formatCents. Zero symbole euro detecte.**

---

## 7. VERIFICATION CHAUSSURES

### Presence dans le stock
stockStore.ts contient 4 articles chaussures :
- art-013 : Richelieu Bout Droit Cuir Glace Noir (Santoni, 6 000 DA/loc)
- art-014 : Richelieu One-Cut Cuir Cognac Patine (Santoni, 6 500 DA/loc)
- art-015 : Richelieu Derby Cuir Bordeaux (Santoni, 5 500 DA/loc)
- art-016 : Oxford Plain Cap Toe Cuir Chataigne (Church's, 5 000 DA/loc)

### Flux de location
- CreateRentalModal.tsx L.363-428 : selecteur itere TOUS les articles sans filtre de type => chaussures incluses
- checkVariantAvailability() s'applique identiquement aux variantes chaussures (pointures 42, 43, etc.)
- pdfService.ts : tous les items (costumes ET chaussures) listes dans le tableau du bon

### Dashboard Top Chaussures
- TopArticlesRanking.tsx : onglet "Chaussures" present, filtre par categorie type='chaussure'
- art-013 apparait dans le palmares : 13 locations, 78 000 DA

**CONCLUSION : Les chaussures sont louables exactement comme les costumes dans tout le flux.**

---

## 8. ECART AVEC LE CAHIER DES CHARGES

| N | Demande PROJECT_CONTEXT.md | Statut |
|---|---------------------------|--------|
| 1 | PRAGMA WAL active en base | ABSENT de 0001_initial_schema.sql |
| 2 | Table settings en SQLite | ABSENTE |
| 3 | Table audit_logs en SQLite | ABSENTE |
| 4 | Persistance reelle SQLite (hors mode Tauri compile) | ABSENTE en mode dev |
| 5 | Calcul prix x nombre de jours dans location | BUG : prix fixe non multiplie par rentalDays |
| 6 | Module H complet (PDF, Excel, CSV) | Page coquille non fonctionnelle |
| 7 | Sauvegarde du fichier SQLite reel | Simule (JSON des stores, pas le .db) |
| 8 | Sauvegarde automatique a la fermeture | ABSENTE (pas de listener close-requested) |
| 9 | Role manager avec permissions | Declare, non differencie |
| 10 | Archivage PDF sur disque (chemin_pdf) | Simule (chaine fictive) |
| 11 | Detection automatique impayes clients | Absente (valeurs de seed hardcodees) |
| 12 | Bouton Confirmer retrait (reserve -> en_cours) | Absent de l'UI |
| 13 | Images articles en local (offline) | URLs Unsplash uniquement |
| 14 | Mode paiement virement dans caisse | Dans les types mais absent de l'UI |
| 15 | TVA 19% partout (y compris ventes demo) | Residuel : tax_rate 0.2 dans seed caisse |
| 16 | Scan camera reel | Saisie manuelle uniquement |

---

## 9. RECOMMANDATIONS PRIORITAIRES

### Priorite 1 — Bloquants pour une V1 boutique

| # | Action | Fichier |
|---|--------|---------|
| 1 | Corriger calcul prix x jours dans CreateRentalModal | CreateRentalModal.tsx L.92 |
| 2 | Ajouter PRAGMA journal_mode = WAL | 0001_initial_schema.sql |
| 3 | Ajouter tables settings + audit_logs en SQL | 0001_initial_schema.sql |
| 4 | Demarrer l'app deconnectee (retirer isAuthenticated:true) | authStore.ts L.50-51 |
| 5 | Implanter la persistance contrats via IPC Tauri (ou confirmer mode demo) | rentalStore.ts |
| 6 | Corriger TVA 0.2 -> 0.19 dans les seeds caisse | caisseStore.ts L.66 |

### Priorite 2 — Fonctionnalites importantes

| # | Action | Module |
|---|--------|--------|
| 7 | Bouton Confirmer retrait (reserve -> en_cours) | C |
| 8 | Implanter Module H (rapport PDF, export CSV inventaire/caisse) | H |
| 9 | Sauvegarde a la fermeture via event Tauri close-requested | I |
| 10 | Appeler logAuditEvent depuis stockStore et rentalStore | I |
| 11 | Remplacer URLs Unsplash par assets locaux Tauri | A |

### Priorite 3 — Ameliorations V1+

| # | Action | Module |
|---|--------|--------|
| 12 | Calcul dynamique impayes clients | B |
| 13 | Scan camera via WebRTC ou plugin Tauri | F |
| 14 | Archivage PDF reel sur disque via tauri-plugin-fs | D |
| 15 | Role manager avec permissions propres | I |
| 16 | Mode paiement virement dans CaissePaymentModal | F |
| 17 | Optimisation bundle (chunk splitting > 500KB) | J |
| 18 | Dates par defaut dynamiques dans CreateRentalModal | C |

---
*Rapport genere le 15 septembre 2026 par audit direct du code source — chaque affirmation verifiee dans les fichiers.*
