# RAPPORT D'AUDIT FONCTIONNALITÉS V2 — ATELIER PRESTIGE

**Date de l'audit :** 17 Septembre 2026 (Mis à jour post-CI & post-Packs)  
**Auteur :** Antigravity (Inspection directe de l'environnement, du code source, des tests locaux et de la CI GitHub Actions)  
**Objectif :** Photographie technique factuelle et sans complaisance du logiciel en vue de sa généralisation (costumes homme + robes femme sur le même noyau applicatif).  
**Principe directeur :** Aucune affirmation sans preuve. Code réel extrait (fichier + lignes) et logs réels exécutés (locaux et CI distante).

---

## SYNTHÈSE DES STATUTS PAR MODULE

| Module / Périmètre | Statut | Synthèse factuelle |
| :--- | :---: | :--- |
| **1. Base de données & Persistance** | ⚠️ PARTIEL | Schéma SQLite 3 complet avec migrations versionnées (0001, 0002, 0003). Tests d'intégration Rust (`db_lifecycle_test.rs`) **validés à 100% en conditions réelles sous CI GitHub Actions Windows** (reconnexion, persistance et restauration SQLite). Duality persistante : `stockStore`/`clientStore` appellent l'IPC, mais `rentalStore`/`caisseStore` n'écrivent toujours que dans `localStorage` ! |
| **2. Sauvegarde / Restauration** | ✅ VÉRIFIÉ (Algorithme & Cycle DB) / ⚠️ PARTIEL (PID OS) | Algorithme durci en Rust : `PRAGMA integrity_check` préalable sur archive temporaire, `state.pool.close().await` avant `fs::rename`, purge WAL/SHM. Cycle complet validé par test d'intégration Rust en CI (`test_backup_and_restore_cycle_with_pool_reconnect ... ok`). Capture manuelle du PID (`Get-Process` avant/après `restart_app`) non automatisée. |
| **3. CI/CD** | ✅ VÉRIFIÉ | Dépôt GitHub initialisé et lié à `https://github.com/hennaneihab-svg/location-costum.git`. **Run GitHub Actions #35238761553 validé avec succès (100% vert)** sur runner Windows : Cargo Check, Vitest (29 tests), Tests Rust DB (2 tests), Compilation release binaire Tauri (`costume-rental.exe` 15.7 Mo) et bundles d'installation (`.msi`, `.exe` NSIS). |
| **4. Modèle Article / Packs / Client** | ⚠️ PARTIEL | **Modèle hybride implémenté (Migration 0003)** : supporte articles à variantes de taille ou stock quantité simple (`mode_gestion`), tables `packs` et `pack_items`, commande transactionnelle `reserve_pack` anti-surréservation (testée avec succès en concurrence réelle). **Mensurations : simple champ texte libre (`notes`), aucune table dédiée**. |
| **5. Cycle de location** | ⚠️ PARTIEL | Création de contrat et calcul prorata temporis testés (Vitest). **Transition Réservation → Retrait physique : AUCUNE action dédiée**. **Retour (`processReturn`) : implémenté mais NON TESTÉ**. **Étape "Essayage" : INEXISTANTE**. |
| **6. Caution & Pénalités de retard** | ⚠️ PARTIEL | Caution gérée à la création et altérée lors du retour (dégâts). Pénalités de retard calculées dans le moteur d'alerte (testé). Mais **aucun prélèvement automatique ni intégration monétique réelle de caution**. |
| **7. Alertes & Rappels (dont wa.me)** | ⚠️ PARTIEL | Génération d'alertes Jour-J / J-1 / Retard testée (Vitest). Normalisation téléphone algérien et liens `wa.me` via `@tauri-apps/plugin-shell` scopé sécurisé (testé). **Comportement sous restauration : régression confirmée**, les alertes orphelines ne sont pas purgées. |
| **8. Bons PDF, Caisse, Dashboard, Rapports** | ⚠️ PARTIEL | Bon de location PDF binaire testé (pdf-lib, 2 pages). Calculs du Dashboard testés. Caisse POS et Ticket 80mm implémentés mais **NON TESTÉS**. Page "Rapports" : **PURES MAQUETTES UI SANS CODE D'EXPORT**. |
| **9. Sécurité & Administration** | ⚠️ PARTIEL | Démarrage déconnecté par défaut. Hash bcrypt (admin/vendeur). Inactivité à 0 min = désactivé (vérifié dans le code). Mais **AUCUN test automatisé d'authentification** et persistance de session basique. |

---

## 1. BASE DE DONNÉES & PERSISTANCE

### 1.1. Schéma actuel des tables SQL
**Statut :** ✅ VÉRIFIÉ (Code source et migrations)

Le schéma initial est défini dans `src-tauri/migrations/0001_initial_schema.sql` et étendu par `0003_articles_mode_gestion_et_packs.sql`, géré par `src-tauri/src/db/mod.rs` :

```sql
-- Extrait src-tauri/migrations/0001_initial_schema.sql
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('costume', 'chaussure', 'accessoire', 'autre')),
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    categorie_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    fournisseur_id TEXT REFERENCES fournisseurs(id) ON DELETE SET NULL,
    reference TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL,
    marque TEXT,
    couleur TEXT,
    description TEXT,
    prix_location_centimes INTEGER NOT NULL,
    prix_vente_centimes INTEGER,
    caution_suggeree_centimes INTEGER NOT NULL,
    frais_nettoyage_centimes INTEGER DEFAULT 0,
    image_url TEXT,
    est_actif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

Extension appliquée via `src-tauri/migrations/0003_articles_mode_gestion_et_packs.sql` :
```sql
ALTER TABLE articles ADD COLUMN mode_gestion TEXT NOT NULL DEFAULT 'variante' CHECK(mode_gestion IN ('variante', 'quantite'));
ALTER TABLE articles ADD COLUMN quantite_stock INTEGER DEFAULT NULL;
ALTER TABLE articles ADD COLUMN quantite_disponible INTEGER DEFAULT NULL;

CREATE TABLE IF NOT EXISTS packs (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    description TEXT,
    cible TEXT NOT NULL DEFAULT 'homme' CHECK(cible IN ('homme', 'femme', 'mixte')),
    prix_forfait_centimes INTEGER NOT NULL,
    caution_forfait_centimes INTEGER,
    est_actif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pack_items (
    id TEXT PRIMARY KEY,
    pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    categorie_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
    quantite INTEGER NOT NULL DEFAULT 1,
    obligatoire INTEGER NOT NULL DEFAULT 1
);
```

### 1.2. Preuve d'exécution réelle des tests de persistance et reconnexion SQLite
**Statut :** ✅ VÉRIFIÉ (Logs bruts CI GitHub Actions Run #35238761553, 17/09/2026)

Extrait verbatim du log brut de l'étape **"Run DB Lifecycle & Persistence Tests (Rust)"** :
```text
2026-09-17T15:24:27.4612657Z Running tests\db_lifecycle_test.rs (src-tauri\target\debug\deps\db_lifecycle_test-f692962febdb635b.exe)
2026-09-17T15:24:27.4723790Z running 2 tests
2026-09-17T15:24:33.1801475Z test test_persistence_across_db_reconnect ... ok
2026-09-17T15:24:33.5089920Z test test_backup_and_restore_cycle_with_pool_reconnect ... ok
2026-09-17T15:24:33.5097379Z test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.04s
```

### 1.3. Anomalie d'architecture persistante : Divergence Frontend / SQLite
**Statut :** ⚠️ ANOMALIE CONFIRMÉE (Non résolue)

- Alors que `clientStore.ts` et `stockStore.ts` utilisent `dbStorage.persistWithIpc` pour persister dans SQLite réel, `rentalStore.ts` et `caisseStore.ts` n'appellent **aucun IPC de création de contrat ni de vente directe**. Ils se contentent de :
  ```typescript
  // src/store/rentalStore.ts:555
  dbStorage.save(dbStorage.KEYS.CONTRACTS, updatedContracts);
  // src/store/caisseStore.ts:260
  dbStorage.save(dbStorage.KEYS.SALES, updatedSales);
  ```
  Leur persistance repose donc actuellement sur `localStorage` dans l'application webview, sans synchronisation avec les tables SQLite `locations` et `ventes`.

---

## 2. SAUVEGARDE & RESTAURATION

### 2.1. État réel du code Rust (`backup_database` & `restore_database`)
**Statut :** ✅ VÉRIFIÉ (Code source inspecté et testé en CI)

Extrait verbatim de `src-tauri/src/commands/mod.rs` (Lignes 831 à 895) :
```rust
    // Contrôle pré-remplacement : PRAGMA integrity_check sur fichier temporaire
    let integrity_row: (String,) = sqlx::query_as("PRAGMA integrity_check;")
        .fetch_one(&mut tmp_conn)
        .await
        .map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            AppError::DatabaseError(e)
        })?;

    if integrity_row.0.to_lowercase() != "ok" {
        let _ = fs::remove_file(&tmp_path);
        return Err(AppError::Validation(format!(
            "Échec du test d'intégrité SQLite sur l'archive de sauvegarde : {}. La base active n'a pas été modifiée.",
            integrity_row.0
        )));
    }

    // Flush WAL et fermeture du pool avant remplacement (libère les verrous de fichiers sous Windows)
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);").execute(&state.pool).await;
    state.pool.close().await;

    // Remplacement atomique de la base
    fs::rename(&tmp_path, &db_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        AppError::Internal(format!("Échec du remplacement atomique de la base SQLite : {}", e))
    })?;

    // Purge des journaux WAL et SHM obsolètes
    let _ = fs::remove_file(app_data_dir.join("costume_rental.db-wal"));
    let _ = fs::remove_file(app_data_dir.join("costume_rental.db-shm"));
```

Le cycle complet de sauvegarde, checkpointing WAL, remplacement atomique et réouverture de pool a été exécuté et validé par le test Rust `test_backup_and_restore_cycle_with_pool_reconnect` (statut `ok` en 6.04s en CI).

### 2.2. Test de changement de PID (`restart_app`)
**Statut :** ⚠️ THÉORIQUE / NON VALIDÉ EN PROCESSUS AUTONOME

- La commande `restart_app` invoque `app.restart()` de Tauri v2.
- Localement, l'AppLocker bloque le binaire dev (`os error 4551`).
- La capture de deux PIDs distincts avant/après appel IPC n'a pas fait l'objet d'un script d'automatisation dédié en CI.

---

## 3. CI/CD & PIPELINE DE VALIDATION

### 3.1. Dépôt distant et exécution CI
**Statut :** ✅ VÉRIFIÉ (Exécution réelle sous GitHub Actions)

- **Dépôt distant :** [hennaneihab-svg/location-costum](https://github.com/hennaneihab-svg/location-costum)
- **Workflow :** `.github/workflows/build-and-verify.yml`
- **Run validé :** [Run #35238761553](https://github.com/hennaneihab-svg/location-costum/actions/runs/35238761553) sur commit `b92cf9e`
- **Résultat global du run :** `SUCCESS` (Toutes les étapes au vert)

### 3.2. Détail des étapes exécutées

```text
Job: Build Tauri & Verify DB Lifecycle (Windows) — Durée totale: 26m 21s

 1. Set up job                                  ✅ success (15s)
 2. Checkout repository                         ✅ success (3s)
 3. Setup Node.js                               ✅ success (3s)
 4. Setup Rust Stable Toolchain                 ✅ success (12s)
 5. Cache Rust dependencies                     ✅ success (1s)
 6. Install npm dependencies                    ✅ success (28s)
 7. Run Frontend Tests (Vitest)                 ✅ success (7s) — 29 tests passés
 8. Build Frontend (TypeScript & Vite)          ✅ success (6s) — dist généré
 9. Cargo Check (src-tauri)                     ✅ success (5m 41s)
10. Run DB Lifecycle & Persistence Tests (Rust) ✅ success (3m 56s) — 2/2 tests passés
11. Build Tauri Binary & Bundle                 ✅ success (11m 1s)
12. Verify Compiled Executable Exists           ✅ success (3s) — 15 736 320 octets
13. Upload Application Artifacts                ✅ success (8s) — Artifact ID: 10505117951
```

**Preuve d'existence du binaire compilé (`Verify Compiled Executable Exists`) :**
```text
2026-09-17T15:35:58.5213476Z SUCCESS: src-tauri\target\release\costume-rental.exe found! Size: 15736320 bytes
```

**Bundles d'installation générés et archivés :**
- `Atelier Prestige_1.0.0_x64-setup.exe` (NSIS)
- `Atelier Prestige_1.0.0_x64_en-US.msi` (MSI Windows Installer)
- `costume-rental.exe` (Binaire portable 15.7 Mo)

---

## 4. MODÈLE DE DONNÉES ARTICLE, PACKS, CLIENT & LOCATION

### 4.1. Modèle d'Articles Unifié (Variante vs Quantité)
**Statut :** ✅ VÉRIFIÉ (Migration 0003 + Rust Models)

Les articles supportent désormais deux modes de gestion :
- `variante` : Suivi unitaire par taille, code-barres et état d'usure via `variantes_stock`.
- `quantite` : Suivi par quantité globale (`quantite_stock`, `quantite_disponible`) pour les accessoires (cravates, nœuds, ceintures, bijoux).

### 4.2. Packs & Bundles de Location
**Statut :** ✅ VÉRIFIÉ (Backend IPC + Concurrence SQLite + Frontend Zustand)

- **Structure :** Tables `packs` et `pack_items`.
- **Réservation transactionnelle atomique (`reserve_pack`) :**
  Commande Rust dans `src-tauri/src/commands/mod.rs` (lignes 920-1070) exécutée sous transaction SQLite `BEGIN IMMEDIATE` :
  ```rust
  // Décrémentation conditionnelle atomique anti-surréservation
  let update_res = sqlx::query(
      "UPDATE articles 
       SET quantite_disponible = quantite_disponible - ?, updated_at = ? 
       WHERE id = ? AND quantite_disponible >= ?"
  )
  .bind(item.quantite)
  .bind(&now)
  .bind(&choice.article_id)
  .bind(item.quantite)
  .execute(&mut *tx)
  .await?;
  ```
- **Preuve de résistance à la concurrence :**
  Test d'accès concurrent réel multi-threads exécuté sur SQLite avec `PRAGMA foreign_keys=ON` :
  ```text
  [SUCCES] Client-1 : Réservation confirmée
  [ECHEC] Client-2 : Stock insuffisant (quantite_disponible < 1)
  ETAT FINAL BASE : quantite_disponible = 0, quantite_stock = 1
  VALIDATION TEST : REUSSITE ABSOLUE. Aucune double réservation, pas de stock négatif.
  ```

### 4.3. Mensurations et caractéristiques physiques
**Statut :** ⚠️ PARTIEL (Non structuré)

- Les mensurations clients restent cantonnées à une chaîne de caractères libre (`notes TEXT` dans la table `clients`).
- **Manque pour extension Robe Femme :** Aucun champ structuré pour tour de poitrine, sous-poitrine, tour de taille, tour de hanches, hauteur sous talon, ni historique des retouches.

---

## 5. CYCLE DE LOCATION

### 5.1. Matrice des transitions d'état
**Statut :** ⚠️ PARTIEL

```
[Brouillon] ──> [Réservé] ──> [En cours (Retrait)] ──> [Retourné]
                    │                  │                   │
                    └──> [Annulé]      └──> [En retard]    └──> [Litige]
```

1. **Création et calcul de durée :** ✅ VÉRIFIÉ par test Vitest (`rentalFlow.test.ts`).
2. **Transition Réservation → Retrait :** ❌ NON IMPLÉMENTÉ DÉDIÉ (le passage à "en_cours" repose sur une comparaison de date automatique sans bouton de confirmation de remise physique).
3. **Transition Retour (`processReturn`) :** ⚠️ IMPLÉMENTÉ MAIS NON TESTÉ UNITAIREMENT.
4. **Étape "Essayage" :** ❌ INEXISTANTE.

---

## 6. CAUTION & PÉNALITÉS DE RETARD

### 6.1. Caution
**Statut :** ⚠️ PARTIEL

- `deposit_amount_cents`, `deposit_method`, `deposit_status` dans `locations`.
- Gestion déclarative (chèque/espèces/empreinte). Aucun prélèvement bancaire automatique.

### 6.2. Pénalités de retard
**Statut :** ✅ VÉRIFIÉ (Moteur d'alertes)

- Formule : `daysOverdue * LATE_FEE_PER_DAY_CENTS` (1 500 DA / jour).
- Validé par tests Vitest (`alertEngine.test.ts`).

---

## 7. ALERTES & RAPPELS (DONT WHATSAPP)

### 7.1. Moteur d'alertes et WhatsApp
**Statut :** ✅ VÉRIFIÉ (15 tests unitaires)

- Plugin Tauri Shell sécurisé : `tauri-plugin-shell = "2"` configuré avec scope restrictif regex `^https://wa\.me/.+`.
- Module frontend `src/lib/whatsapp.ts` utilisant l'API native `open()` du plugin shell sous Tauri.

### 7.2. Comportement des alertes après Restauration
**Statut :** ⚠️ ANOMALIE CONFIRMÉE

- `useAlertStore` n'est pas purgé lors de la réhydratation après restauration de base, causant la persistance d'alertes orphelines.

---

## 8. BONS PDF, CAISSE, DASHBOARD, RAPPORTS

### 8.1. Bon de location PDF (pdf-lib)
**Statut :** ✅ VÉRIFIÉ (`pdfGeneration.test.ts`, génération binaire 2 pages).

### 8.2. Caisse (POS) & Ticket 80mm
**Statut :** ⚠️ IMPLÉMENTÉ MAIS NON TESTÉ (`caisseStore.ts` & `receiptPdfService.ts`).

### 8.3. Dashboard & KPI
**Statut :** ✅ VÉRIFIÉ (`dashboardCalc.test.ts`, calculs CA et classements).

### 8.4. Page Rapports (`RapportsPage.tsx`)
**Statut :** ❌ MAQUETTE UI SANS CODE D'EXPORT (Boutons sans handlers `onClick`).

---

## 9. SÉCURITÉ & ADMINISTRATION

### 9.1. Authentification & Rôles
**Statut :** ⚠️ PARTIEL (Hash bcrypt en place, démarrage déconnecté, mais aucun test unitaire).

### 9.2. Timer d'inactivité
**Statut :** ✅ VÉRIFIÉ (`touchActivity` dans `authStore.ts`, valeur `0` = désactivé).

---

## PROBLÈMES BLOQUANTS RESTANTS (CLASSÉS PAR GRAVITÉ)

### 🔴 GRAVITÉ 1 — CRITIQUE (Bloquant pour la production)

1. **Divergence de persistance SQLite vs LocalStorage (`rentalStore` & `caisseStore`) :**  
   Les contrats de location et les ventes de caisse sont écrits exclusivement dans le `localStorage` du navigateur. Ils ne sont jamais persistés dans les tables SQLite `locations`, `lignes_location`, `ventes` et `paiements`.  
   *Note : Le CI/CD qui était le 2nd point bloquant de Gravité 1 est désormais **entièrement résolu et validé**.*

---

### 🟠 GRAVITÉ 2 — MAJEURE (Manques pour la généralisation Robe Femme)

2. **Inexistence d'une table structurée de Mensurations :**  
   Texte libre `notes` insuffisant pour modéliser le profil morphologique féminin (tour de poitrine, taille, hanches, carrure, hauteur talons).
3. **Absence du flux "Rendez-vous & Essayage" :**  
   Aucun statut d'essayage, ni fiche de retouches préalable à la location.
4. **Régression de cohérence du moteur d'alertes après Restauration :**  
   `useAlertStore` non réinitialisé lors de l'import/restauration de base.

---

### 🟡 GRAVITÉ 3 — MODÉRÉE (Fonctionnalités incomplètes ou non testées)

5. **Page Rapports & Exports non opérationnelle :**  
   `RapportsPage.tsx` reste une maquette sans export CSV/Excel/PDF.
6. **Absence de tests automatisés sur la Caisse et l'Authentification :**  
   `caisseStore`, `receiptPdfService` et `authStore` non couverts par Vitest.
7. **Transition "Retrait physique" manquante :**  
   Absence d'action explicite pour valider la remise physique des pièces avec horodatage.
