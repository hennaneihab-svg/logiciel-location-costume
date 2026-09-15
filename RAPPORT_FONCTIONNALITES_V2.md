# RAPPORT D'AUDIT FONCTIONNALITÉS V2 — ATELIER PRESTIGE

**Date de l'audit :** 17 Septembre 2026  
**Auteur :** Antigravity (Inspection directe de l'environnement, du code source et des tests)  
**Objectif :** Photographie technique factuelle et sans complaisance du logiciel en vue de sa généralisation (costumes homme + robes femme sur le même noyau applicatif).  
**Principe directeur :** Aucune affirmation sans preuve. Code réel extrait (fichier + lignes) et logs réels exécutés.

---

## SYNTHÈSE DES STATUTS PAR MODULE

| Module / Périmètre | Statut | Synthèse factuelle |
| :--- | :---: | :--- |
| **1. Base de données & Persistance** | ⚠️ PARTIEL | Schéma SQLite 3 complet et migré (13 tables). Test Rust d'intégration écrit (`db_lifecycle_test.rs`), mais **invalidation de l'exécution sur binaire compilé localement** (Windows AppLocker `os error 4551`). Duality persistante : `stockStore`/`clientStore` appellent l'IPC, mais `rentalStore`/`caisseStore` n'écrivent que dans `localStorage` ! |
| **2. Sauvegarde / Restauration** | ⚠️ PARTIEL | `restore_database` en Rust durci : `PRAGMA integrity_check` préalable sur temporaire, `state.pool.close().await` avant `fs::rename`, purge WAL/SHM. `restart_app` implémenté. **Test manuel PID (Get-Process avant/après) : NON FAIT**. |
| **3. CI/CD** | ❌ NON VÉRIFIÉ | Workflow `.github/workflows/build-and-verify.yml` créé et commité localement (`18de5ed`), mais **aucun remote GitHub configuré (`git remote -v` vide)**. Aucun run CI n'a jamais tourné sur GitHub. |
| **4. Modèle Article / Client / Location** | ⚠️ PARTIEL | Table `articles` unique avec discriminants de catégories. Variantes avec tailles, états et statuts. **Mensurations : simple champ texte libre (`notes`), aucune table dédiée**. **Aucun module d'accessoires en pack**. |
| **5. Cycle de location** | ⚠️ PARTIEL | Création de contrat et calcul prorata temporis testés (Vitest). **Transition Réservation → Retrait physique : AUCUNE action dédiée**. **Retour (`processReturn`) : implémenté mais NON TESTÉ**. **Étape "Essayage" : INEXISTANTE**. |
| **6. Caution & Pénalités de retard** | ⚠️ PARTIEL | Caution gérée à la création et altérée lors du retour (dégâts). Pénalités de retard calculées dans le moteur d'alerte (testé). Mais **aucun prélèvement automatique ni intégration monétique réelle de caution**. |
| **7. Alertes & Rappels (dont wa.me)** | ⚠️ PARTIEL | Génération d'alertes Jour-J / J-1 / Retard testée (Vitest). Normalisation téléphone algérien et liens `wa.me` testés (12 tests). **Comportement sous restauration : régression confirmée**, les alertes orphelines ne sont pas purgées. |
| **8. Bons PDF, Caisse, Dashboard, Rapports** | ⚠️ PARTIEL | Bon de location PDF binaire testé (pdf-lib, 2 pages). Calculs du Dashboard testés. Caisse POS et Ticket 80mm implémentés mais **NON TESTÉS**. Page "Rapports" : **PURES MAQUETTES UI SANS CODE D'EXPORT**. |
| **9. Sécurité & Administration** | ⚠️ PARTIEL | Démarrage déconnecté par défaut. Hash bcrypt (admin/vendeur). Inactivité à 0 min = désactivé (vérifié dans le code). Mais **AUCUN test automatisé d'authentification** et persistance de session basique. |

---

## 1. BASE DE DONNÉES & PERSISTANCE

### 1.1. Schéma actuel des tables SQL
**Statut :** ✅ VÉRIFIÉ (Code source et migrations)

Le schéma initial est défini dans `src-tauri/migrations/0001_initial_schema.sql` et géré par `src-tauri/src/db/mod.rs` :

```sql
-- Extrait src-tauri/migrations/0001_initial_schema.sql (Lignes 12-171)
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

CREATE TABLE IF NOT EXISTS variantes_stock (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    code_barre TEXT NOT NULL UNIQUE,
    taille TEXT NOT NULL,
    sous_taille TEXT,
    etat_usure TEXT NOT NULL DEFAULT 'excellent' 
        CHECK(etat_usure IN ('neuf', 'excellent', 'bon', 'usage', 'endommage', 'au_rebut')),
    statut TEXT NOT NULL DEFAULT 'disponible' 
        CHECK(statut IN ('disponible', 'reserve', 'en_location', 'au_pressing', 'en_retouche', 'indisponible', 'vendu')),
    nb_locations INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

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
    numero_cni TEXT,
    notes TEXT,
    est_bloque INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

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
    updated_at TEXT NOT NULL
);
```

### 1.2. Preuve d'exécution sur build compilé
**Statut :** ❌ NON VÉRIFIÉ / BLOQUÉ LOCALEMENT

- **Tentative d'exécution locale de compilation :**
```text
Commande : cargo check --manifest-path src-tauri/Cargo.toml
Résultat brut :
error: failed to run custom build command for `wry v0.55.1`
Caused by:
  could not execute process `...\src-tauri\target\debug\build\wry-065b7ad1a498315d\build-script-build` (never executed)
Caused by:
  Une stratégie de contrôle d’application a bloqué ce fichier. (os error 4551)
```
- **Constat technique :** Sur la machine de développement locale sous Windows, la stratégie de sécurité WDAC/AppLocker empêche l'exécution de tout binaire temporaire non signé (`build-script-build`). Par conséquent, **aucun binaire `.exe` compilé n'a pu être exécuté localement**.
- **Divergence architecturale Frontend / SQLite :**
  Alors que `clientStore.ts` et `stockStore.ts` utilisent `dbStorage.persistWithIpc` pour persister dans SQLite réel, `rentalStore.ts` et `caisseStore.ts` n'appellent **aucun IPC de création de contrat ni de vente directe** ! Ils se contentent de :
  ```typescript
  // src/store/rentalStore.ts:555
  dbStorage.save(dbStorage.KEYS.CONTRACTS, updatedContracts);
  // src/store/caisseStore.ts:260
  dbStorage.save(dbStorage.KEYS.SALES, updatedSales);
  ```
  Leur persistance repose donc actuellement à 100% sur `localStorage` dans l'application webview, sans synchronisation avec les tables SQLite `locations` et `ventes`.

---

## 2. SAUVEGARDE & RESTAURATION

### 2.1. État réel du code Rust (`backup_database` & `restore_database`)
**Statut :** ✅ VÉRIFIÉ (Code source inspecté)

Extrait verbatim de `src-tauri/src/commands/mod.rs` (Lignes 831 à 895) :

```rust
    // 3. Contrôle pré-remplacement : PRAGMA integrity_check exécuté directement sur le fichier temporaire
    // Si l'archive est corrompue intérieurement, l'erreur est levée ICI et la base active n'a pas été touchée d'un seul octet !
    {
        use sqlx::sqlite::SqliteConnectOptions;
        use sqlx::ConnectOptions;

        let tmp_conn_options = SqliteConnectOptions::new()
            .filename(&tmp_path)
            .read_only(true);

        let mut tmp_conn = tmp_conn_options.connect().await
            .map_err(|e| {
                let _ = fs::remove_file(&tmp_path);
                AppError::Internal(format!("Impossible d'ouvrir l'archive temporaire pour contrôle d'intégrité : {}", e))
            })?;

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
    }

    // 4. Flush préalable et fermeture du pool de la base active pour libérer tous les verrous de fichiers sous Windows
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);")
        .execute(&state.pool)
        .await;

    state.pool.close().await;

    // 5. Renommage atomique : la base active n'est remplacée qu'après succès garanti de l'intégrité et fermeture des verrous
    fs::rename(&tmp_path, &db_path)
        .map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            AppError::Internal(format!("Échec du remplacement atomique de la base SQLite : {}", e))
        })?;

    // 6. Nettoyage des journaux WAL et SHM obsolètes de l'ancienne base
    let wal_path = app_data_dir.join("costume_rental.db-wal");
    let shm_path = app_data_dir.join("costume_rental.db-shm");
    if wal_path.exists() {
        let _ = fs::remove_file(wal_path);
    }
    if shm_path.exists() {
        let _ = fs::remove_file(shm_path);
    }

    Ok(())
}

#[command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), AppError> {
    app.restart();
}
```

### 2.2. Test de changement de PID (Get-Process avant/après `restart_app`)
**Statut :** ❌ NON FAIT

- **Constat :** En raison du blocage local d'exécution des binaires de dev (`os error 4551`), l'application n'a pas pu être démarrée en mode binaire autonome pour capturer un changement de PID via `Get-Process`.
- **Rappel du comportement natif :**
  - `window.location.reload()` : Maintient le même processus Windows (`PID identique`), ne réexécute pas le hook Rust `setup()`, et laisse `state.pool` fermé définitivement (`PoolClosed`).
  - `app.restart()` : Déclenche l'appel système Win32 `CreateProcessW` vers `std::env::current_exe()`, puis exécute `std::process::exit(0)`. Le PID est structurellement renouvelé par le noyau Windows.

---

## 3. CI/CD & PIPELINE DE VALIDATION

### 3.1. État du dépôt et remote GitHub
**Statut :** ❌ NON CONNECTÉ

- **Commande exécutée :** `git remote -v`
- **Sortie brute :**
  ```text
  (Sortie vide : aucun remote configuré)
  ```
- **Constat :** Le dépôt local contient le commit `18de5ed` ("feat(ci): add GitHub Actions build and verify workflow with SQLite persistence tests"), mais aucun dépôt distant GitHub n'a été rattaché.
- **Conséquence :** Aucun lien de run GitHub Actions n'existe à cette date. Le workflow `.github/workflows/build-and-verify.yml` est prêt mais n'a jamais été déclenché.

---

## 4. MODÈLE DE DONNÉES ARTICLE / CLIENT / LOCATION

### 4.1. Structure actuelle des articles
**Statut :** ⚠️ PARTIEL (Table unique générique)

- **Structure :** Une seule table `articles` avec une clé étrangère `categorie_id`.
- **Typage des catégories :** `CHECK(type IN ('costume', 'chaussure', 'accessoire', 'autre'))`.
- **Variantes de stock :** Table `variantes_stock` (taille, sous_taille, état usure, statut).
- **Adéquation pour extension "Robes Femme" :**
  - Le modèle actuel supporte déjà des articles de type robe si une catégorie adéquate est créée.
  - Cependant, les champs `taille` et `sous_taille` (conçus pour "Taille 50, Drop 7") sont insuffisants pour la robe de mariée/soirée (qui requiert la gestion des corsets, laçages, traînes, etc.).

### 4.2. Mensurations et caractéristiques physiques
**Statut :** ⚠️ PARTIEL (Non structuré)

- Dans la table `clients`, les mensurations n'ont **aucune table ni colonne dédiée**. Elles sont enregistrées dans un simple champ texte libre :
  ```sql
  -- src-tauri/migrations/0001_initial_schema.sql:117
  notes TEXT, -- Mensurations, préférences
  ```
- Dans le frontend (`src/types/customer.ts:51`) :
  ```typescript
  notes?: string; // Mensurations, préférences sartoriales
  ```
- **Manque pour généralisation Robe Femme :** Impossibilité d'effectuer des requêtes ou des filtres de correspondance automatique (ex: tour de poitrine, tour de taille, tour de hanches, hauteur sous talon) sur une chaîne de texte libre.

### 4.3. Accessoires en Pack
**Statut :** ⚠️ PARTIEL

- Dans `lignes_location.type_ligne`, il existe bien :
  ```sql
  CHECK(type_ligne IN ('location', 'accessoire_inclus', 'forfait_pressing'))
  ```
- Cependant, il n'existe **aucun concept d'ensemble/bundle (Pack Marié / Pack Mariée)** liant automatiquement une robe/costume à ses accessoires associés avec décrémentation groupée du stock.

---

## 5. CYCLE DE LOCATION

### 5.1. Matrice des transitions d'état
**Statut :** ⚠️ PARTIEL

```
[Brouillon] ──> [Réservé] ──> [En cours (Retrait)] ──> [Retourné]
                    │                  │                   │
                    └──> [Annulé]      └──> [En retard]    └──> [Litige]
```

1. **Création et calcul de durée :** ✅ VÉRIFIÉ par test Vitest.
   ```text
   ✓ src/__tests__/rentalFlow.test.ts (3 tests) 7ms
     - Vérifie la disponibilité d une variante et bloque si dates en conflit
     - Crée une nouvelle location avec calcul automatique du reste à payer
     - Calcule correctement le prix total selon la durée (1 jour, 5 jours, même jour)
   ```
2. **Transition Réservation → Retrait :** ❌ NON IMPLÉMENTÉ DÉDIÉ.
   Le contrat passe à `"en_cours"` uniquement si `pickup_date <= todayStr` à la création. Il n'existe pas de bouton ou d'action `validatePickup()` permettant de valider la remise physique des pièces au client avec signature et date de retrait effective.
3. **Transition Retour (`processReturn`) :** ⚠️ IMPLÉMENTÉ MAIS NON TESTÉ.
   La fonction existe dans `rentalStore.ts` (lignes 571-645) avec mise à jour du statut des pièces (disponible, au pressing, en retouche), mais **aucun test unitaire ne la couvre dans `src/__tests__`**.
4. **Étape "Essayage" :** ❌ INEXISTANTE.
   Aucune notion de rendez-vous d'essayage, de fiche de retouches d'essayage ou de blocage d'article pour essayage n'est modélisée.

---

## 6. CAUTION & PÉNALITÉS DE RETARD

### 6.1. Caution
**Statut :** ⚠️ PARTIEL

- **Stockage :** `deposit_amount_cents`, `deposit_method`, `deposit_status` dans `locations`.
- **Calcul :** Suggéré à partir de l'article ou forcé dans le contrat.
- **Restitution / Dégradation :** Implémenté dans `processReturn` :
  ```typescript
  // src/store/rentalStore.ts:615-620
  const depositStatus =
    totalDamageFeeCents > 0
      ? totalDamageFeeCents >= contract.deposit_amount_cents
        ? "conservee_totalement"
        : "conservee_partiellement"
      : "restituee";
  ```
- **Limite :** Gestion purement déclarative (mention chèque/empreinte CB). Aucun connecteur TPE ni passerelle de caution en ligne.

### 6.2. Pénalités de retard
**Statut :** ✅ VÉRIFIÉ (Moteur d'alertes)

- **Formule :** `daysOverdue * LATE_FEE_PER_DAY_CENTS` (1 500 DA / jour de retard).
- **Test unitaire exécuté et validé :**
  ```typescript
  // src/__tests__/alertEngine.test.ts (Lignes 25-28)
  expect(alert?.category).toBe("retard_retour");
  expect(alert?.severity).toBe("critique");
  expect(alert?.days_overdue).toBeGreaterThan(0);
  expect(alert?.late_fee_cents).toBeGreaterThan(0);
  ```

---

## 7. ALERTES & RAPPELS (DONT WHATSAPP)

### 7.1. Moteur d'alertes et WhatsApp
**Statut :** ✅ VÉRIFIÉ (15 tests exécutés avec succès)

Sortie réelle de Vitest :
```text
✓ src/__tests__/whatsapp.test.ts (12 tests) 5ms
  - normalise le format local standard algérien commençant par 0
  - normalise un numéro déjà au format international avec + ou 00
  - conserve un numéro déjà normalisé sans indicatif supplémentaire
  - gère les séparateurs, espaces et parenthèses
  - retourne null pour les numéros invalides ou vides
  - génère un lien wa.me correct avec message encodé
  - génère un lien sans paramètre text si message absent ou vide
  - retourne null si le numéro de téléphone est invalide
  ...
✓ src/__tests__/alertEngine.test.ts (3 tests) 5ms
  - Crée une alerte de type retard pour un contrat dont la date de retour est passée
  - Crée une alerte de type retour_jour_j pour un contrat dont le retour est prévu aujourd hui
  - Marque une alerte comme vue puis traitée sans la supprimer (traçabilité)
```

### 7.2. Comportement des alertes pendant une restauration de sauvegarde
**Statut :** ⚠️ PARTIEL / ANOMALIE DÉTECTÉE

- **Analyse du code (`src/store/settingsStore.ts:430-453`) :**
  Lors de la restauration, `dump.articles`, `dump.clients`, `dump.locations`, `dump.ventes` sont réhydratés. Mais `useAlertStore` n'est **ni réinitialisé ni purgé**.
- **Effet de bord :** Si une base restaurée contient des contrats différents, les alertes actives rattachées aux anciens contrats supprimés restent présentes dans `useAlertStore.alerts` et polluent le tableau de bord avec des alertes orphelines.

---

## 8. BONS PDF, CAISSE, DASHBOARD, RAPPORTS

### 8.1. Bon de location PDF (pdf-lib)
**Statut :** ✅ VÉRIFIÉ

Test unitaire réel exécuté avec succès :
```text
✓ src/__tests__/pdfGeneration.test.ts (1 test) 70ms
  - Génère un document PDF binaire valide avec 2 pages distinctes (Boutique et Client)
```
- Le service `pdfService.ts` génère un véritable flux binaire PDF (`Uint8Array`) de 2 pages A4 via `pdf-lib` avec tableau des pièces, clauses légales et blocs de signatures.

### 8.2. Caisse (POS) & Ticket 80mm
**Statut :** ⚠️ PARTIEL

- `caisseStore.ts` gère panier, encaissement, calcul de monnaie et clôture de caisse.
- `receiptPdfService.ts` contient le générateur de tickets 80mm en PDF.
- **Déficit :** Aucun test unitaire dans `src/__tests__` pour le flux de caisse ni pour la génération du ticket.

### 8.3. Dashboard & KPI
**Statut :** ✅ VÉRIFIÉ

Test unitaire réel exécuté avec succès :
```text
✓ src/__tests__/dashboardCalc.test.ts (3 tests) 17ms
  - Calcule le chiffre d affaires et les KPI sur la période globale
  - Génère les graphiques d évolution et de répartition cohérents
  - Calcule les classements Top 10 et les indicateurs secondaires
```

### 8.4. Page Rapports (`RapportsPage.tsx`)
**Statut :** ❌ MAQUETTE UI PURE (FAÇADE)

Extrait de `src/pages/RapportsPage.tsx` (Lignes 56-64) :
```tsx
<button className="flex-1 py-1.5 px-3 rounded-lg bg-secondary ... flex items-center justify-center gap-1.5">
  <FileText className="w-3.5 h-3.5 text-primary" />
  Aperçu
</button>
<button className="py-1.5 px-3 rounded-lg bg-primary text-primary-foreground ... flex items-center gap-1.5">
  <Download className="w-3.5 h-3.5" />
  Exporter
</button>
```
- **Constat :** Les boutons "Aperçu" et "Exporter" n'ont **aucun gestionnaire d'événement `onClick`**. Aucune fonction d'export comptable (Excel, CSV ou PDF) n'est raccordée à cette vue.

---

## 9. SÉCURITÉ & ADMINISTRATION

### 9.1. Authentification & Rôles
**Statut :** ⚠️ PARTIEL

- **Mots de passe :** Hashage bcrypt avec salage (salt rounds = 10).
- **Comportement par défaut :** Démarrage déconnecté (`currentUser: null`, `isAuthenticated: false`).
- **Gestion des rôles :** Deux rôles opérationnels (`admin` et `vendeur`). Le rôle `admin` restreint l'accès aux paramètres, aux logs d'audit et aux sauvegardes.
- **Lacune :** Aucun test automatisé de connexion/déconnexion, de mot de passe invalide ou de contrôle d'accès aux routes.

### 9.2. Timer d'inactivité
**Statut :** ✅ VÉRIFIÉ (Code source)

Extrait de `src/store/authStore.ts` (Lignes 110-125) :
```typescript
touchActivity: () => {
  const { isAuthenticated, inactivityTimeoutMinutes, logout } = get();
  if (!isAuthenticated || inactivityTimeoutMinutes <= 0) {
    lastActivityTimestamp = Date.now();
    return;
  }

  const elapsedMs = Date.now() - lastActivityTimestamp;
  const timeoutMs = inactivityTimeoutMinutes * 60 * 1000;

  if (elapsedMs > timeoutMs) {
    logout();
  } else {
    lastActivityTimestamp = Date.now();
  }
}
```
- La valeur `0` (ou négative) désactive immédiatement le timeout sans déclencher de déconnexion inopinée.

---

## PROBLÈMES BLOQUANTS RESTANTS (CLASSÉS PAR GRAVITÉ)

### 🔴 GRAVITÉ 1 — CRITIQUE (Bloquants pour la production)

1. **Divergence de persistance SQLite vs LocalStorage (`rentalStore` & `caisseStore`) :**
   Les contrats de location et les ventes directes ne sont enregistrés **que dans le `localStorage`**. Ils ne sont jamais insérés dans les tables SQLite réelles `locations`, `lignes_location`, `ventes` et `paiements`. Si le cache de la webview est effacé ou lors d'un backup SQLite pur, les locations et ventes sont perdues.
2. **Absence de validation CI/CD sur runner réel :**
   Le dépôt local n'est relié à aucun remote GitHub (`git remote -v` vide). Aucune compilation native Tauri ni aucun test d'intégration du cycle SQLite de bout en bout n'a pu s'exécuter dans un environnement CI Windows non restreint.

---

### 🟠 GRAVITÉ 2 — MAJEURE (Manques structurels pour généralisation Robe Femme)

3. **Inexistence d'une table structurée de Mensurations :**
   Les mensurations clients sont actuellement cantonnées à une chaîne de caractères libre (`notes TEXT`). Pour la gestion des robes de mariée/soirée (qui exige tour de poitrine, sous-poitrine, tour de taille, hanches, carrure, hauteur sous talon), cette absence empêche tout filtrage automatique d'articles compatibles ou de suivi des altérations d'ourlets.
4. **Absence de cycle "Essayage & Rendez-vous" :**
   Le flux passe brutalement de Réservation à Location active. Dans le secteur de la robe de cérémonie et du costume sur mesure, le rendez-vous d'essayage préalable avec blocage temporaire et fiche de retouche est absent.
5. **Absence de gestion des Packs / Bundles :**
   Impossible d'associer automatiquement un article principal (robe ou costume) à un pack d'accessoires prédéfinis (voile, jupon, bijoux ou gilet, lavallière, boutons) sous une seule référence tarifaire avec déstockage automatique.
6. **Régression de cohérence du moteur d'alertes après Restauration :**
   Lors d'une restauration de sauvegarde, `useAlertStore` n'est pas purgé, laissant subsister des alertes orphelines liées aux contrats de l'ancienne base.

---

### 🟡 GRAVITÉ 3 — MODÉRÉE (Fonctionnalités incomplètes ou non testées)

7. **Page Rapports & Exports non opérationnelle :**
   La page `RapportsPage.tsx` n'est qu'une maquette statique sans code d'exportation de données (boutons sans actions).
8. **Absence de tests automatisés sur la Caisse et l'Authentification :**
   Ni le cycle de vente directe (`caisseStore`), ni le ticket de caisse 80mm (`receiptPdfService`), ni la sécurité (`authStore`) ne disposent de tests unitaires Vitest.
9. **Transition "Retrait physique" manquante :**
   Aucun bouton explicite ne permet à l'opérateur de marquer la remise effective d'un costume réservé le jour du retrait.
