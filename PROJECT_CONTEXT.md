# PROJECT_CONTEXT.md — Application Desktop de Gestion : Location de Costumes & Chaussures d'Événement

Ce document constitue la référence absolue et immuable du projet. Il doit être consulté et respecté à chaque étape et pour chaque nouveau module ou mission.

---

## 1. Demande Initiale & Cahier des Charges Intégral

> **Message de référence de l'utilisateur :**
>
> "Tu es un ingénieur logiciel senior. Je veux que tu construises une application desktop complète de gestion pour une boutique de location de costumes et chaussures d'événement.
>
> **STACK IMPOSÉE :**
> - Shell desktop : Tauri 2 (Rust)
> - Frontend : React 18 + TypeScript + TailwindCSS + shadcn/ui + Framer Motion
> - Graphiques : Recharts
> - Base de données : SQLite embarquée (via sqlx côté Rust), avec migrations versionnées
> - State management : Zustand
> - Génération PDF : pdf-lib (bons de vente, rapports)
> - Notifications : Tauri Notification API + toasts (sonner)
>
> **PRINCIPE DE TRAVAIL :**
> - Crée un fichier PROJECT_CONTEXT.md à la racine contenant ce message intégral, le schéma de base de données, et la liste des modules ci-dessous. Tu devras t'y référer à chaque nouvelle mission que je te donnerai.
> - Architecture propre : sépare clairement /src-tauri (backend Rust + DB) et /src (frontend React), avec une couche "services" côté frontend qui appelle les commandes Tauri (invoke) plutôt que des accès DB directs dans les composants.
> - Toutes les valeurs monétaires en centimes (entiers) en base pour éviter les erreurs d'arrondi flottant, converties à l'affichage uniquement.
> - Toutes les dates en ISO 8601 UTC en base.
> - Code commenté, typé strictement (TypeScript strict + Rust idiomatique), gestion d'erreurs explicite (pas de unwrap() en prod côté Rust).
>
> **MODULES DE L'APPLICATION (à construire dans cet ordre via des missions séparées que je te donnerai une par une) :**
> - A. Gestion du stock (costumes, chaussures, accessoires, variantes de taille)
> - B. Gestion des clients
> - C. Réservations & locations (calendrier, disponibilité, calcul de prix)
> - D. Bons de vente/location en 2 exemplaires (PDF, impression, archivage)
> - E. Système d'alertes de retour (J-3, J-2, J-1, Jour-J, retard)
> - F. Caisse / vente directe
> - G. Dashboard & statistiques (CA, taux d'occupation, classements, marges)
> - H. Rapports & exports (Excel/CSV/PDF)
> - I. Administration (utilisateurs, rôles, paramètres, sauvegarde)
> - J. Finitions UI/UX et packaging
>
> Pour CETTE mission : mets seulement en place PROJECT_CONTEXT.md, ne code rien d'autre. Confirme-moi le contenu avant de continuer."

---

## 2. Principes Fondamentaux d'Architecture & Normes

### 2.1. Règle des Montants Financiers
- **Tous les montants en base de données sont stockés sous forme d'entiers représentant des centimes** (`INTEGER` en SQLite / `i64` en Rust / `number` entier en TypeScript).
- Exemple : `150,00 €` est stocké sous la valeur `15000`.
- Aucun calcul flottant direct sur les devises. Fonctions de formatage dédiées côté frontend (`centsToEuros(cents: number): string`) et de parsing (`eurosToCents(amount: string | number): number`).

### 2.2. Règle des Dates et Heures
- Toutes les dates/horodatages sont stockés sous format standard **ISO 8601 UTC** (`TEXT` en SQLite au format `YYYY-MM-DDTHH:mm:ss.sssZ` ou `YYYY-MM-DD`).
- Affichage localisé côté client selon les paramètres de la boutique (ex: `fr-FR`).

### 2.3. Séparation Frontend / Backend (IPC Tauri 2)
```
/root
├── src-tauri/                 # Backend Rust
│   ├── src/
│   │   ├── commands/          # Handlers de commandes Tauri invoquées par l'IPC
│   │   ├── db/                # Initialisation pool sqlx, helpers de requêtes
│   │   ├── migrations/        # Fichiers SQL de migration versionnée (ex: 0001_init.sql)
│   │   ├── models/            # Structures de données Rust (DTOs, entités DB)
│   │   ├── services/          # Logique métier backend (calculs, alertes, etc.)
│   │   ├── error.rs           # Types d'erreurs applicatives personnalisées (thiserror)
│   │   └── main.rs / lib.rs   # Configuration et initialisation Tauri
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                       # Frontend React 18 + TS
│   ├── assets/                # Logos, icônes statiques
│   ├── components/            # Composants UI réutilisables (shadcn/ui, layout)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilitaires (formatters, dates, calculs)
│   ├── pages/                 # Écrans des modules (Stock, Clients, Rentals, etc.)
│   ├── services/              # Couche d'abstraction IPC (wrappers `invoke` typés)
│   ├── stores/                # State management Zustand (auth, ui, filtres)
│   ├── types/                 # Définitions TypeScript strictes (miroir des DTOs Rust)
│   ├── App.tsx
│   └── main.tsx
└── PROJECT_CONTEXT.md
```

### 2.4. Robustesse & Typage
- **TypeScript** : Mode `strict: true` activé, aucun `any` toléré sans justification documentée. Interfaces strictes pour chaque retour de commande Tauri.
- **Rust** : Zéro appel à `.unwrap()` ou `.expect()` en code de production. Utilisation d'un type d'erreur custom `AppError` avec sérialisation automatique vers l'IPC Tauri sous forme de message d'erreur clair et exploitable par le frontend.
- **Base de données** : SQLite avec activation explicite des Foreign Keys (`PRAGMA foreign_keys = ON;`) et mode `WAL` (`PRAGMA journal_mode = WAL;`) pour des performances et une concurrence de lecture/écriture optimales.

---

## 3. Schéma Relationnel de la Base de Données (SQLite)

Le schéma ci-dessous est conçu pour répondre à tous les modules (stock avec variantes, clients, locations, contrats/bons, alertes, ventes directes, audit et administration).

```sql
-- PRAGMAS DE CONFIGURATION
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-------------------------------------------------------------------------------
-- 1. UTILISATEURS, RÔLES & SESSIONS
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- UUID v4
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,              -- Argon2id / bcrypt
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'seller')),
    is_active INTEGER NOT NULL DEFAULT 1,     -- 0 = Inactif, 1 = Actif
    created_at TEXT NOT NULL,                 -- ISO 8601 UTC
    updated_at TEXT NOT NULL                  -- ISO 8601 UTC
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 2. ARTICLES, CATÉGORIES & VARIANTES DE STOCK
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('costume', 'chaussure', 'accessoire', 'autre')),
    description TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,                       -- Modèle parent (ex: "Costume Smoking Noir 3 pièces")
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    reference TEXT NOT NULL UNIQUE,           -- Code de référence modèle
    name TEXT NOT NULL,
    brand TEXT,
    color TEXT,
    description TEXT,
    rental_price_cents INTEGER NOT NULL,      -- Prix de location de référence par défaut
    sale_price_cents INTEGER,                 -- Prix de vente directe si éligible (optionnel)
    deposit_price_cents INTEGER NOT NULL,     -- Caution suggérée en centimes
    cleaning_fee_cents INTEGER DEFAULT 0,     -- Frais d'entretien/pressing standard
    image_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_variants (
    id TEXT PRIMARY KEY,                       -- Exemplaire ou déclinaison physique
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    barcode TEXT NOT NULL UNIQUE,             -- Code-barre ou numéro d'identification unique étiquette
    size TEXT NOT NULL,                       -- Ex: "48", "50", "52", "42" (pointure), "L", "XL"
    sub_size TEXT,                            -- Ex: "Court", "Standard", "Long", "Drop 6", "Drop 8"
    condition_state TEXT NOT NULL DEFAULT 'excellent' 
        CHECK(condition_state IN ('neuf', 'excellent', 'bon', 'usage', 'endommage', 'au_rebut')),
    status TEXT NOT NULL DEFAULT 'disponible' 
        CHECK(status IN ('disponible', 'reserve', 'en_location', 'au_pressing', 'en_retouche', 'indisponible', 'vendu')),
    times_rented INTEGER NOT NULL DEFAULT 0,  -- Compteur d'usure / nombre total de locations
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 3. CLIENTS
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    alternative_phone TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    identity_card_number TEXT,                -- N° CNI, Passeport ou Permis pour garantie
    notes TEXT,                               -- Mensurations particulières, préférences
    is_blacklisted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 4. LOCATIONS, RÉSERVATIONS & VENTES (CONTRATS)
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY,
    contract_number TEXT NOT NULL UNIQUE,     -- Ex: "LOC-2026-0001" ou "VTE-2026-0001"
    contract_type TEXT NOT NULL CHECK(contract_type IN ('location', 'vente_directe')),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    status TEXT NOT NULL DEFAULT 'brouillon' 
        CHECK(status IN ('brouillon', 'reserve', 'en_cours', 'retourne', 'en_retard', 'litige', 'annule')),
    
    -- Planning de l'événement et de mise à disposition
    event_date TEXT,                          -- Date de l'événement
    pickup_date_scheduled TEXT NOT NULL,      -- Date/heure prévue de retrait
    pickup_date_actual TEXT,                  -- Date/heure effective de retrait
    return_date_scheduled TEXT NOT NULL,      -- Date/heure prévue de retour
    return_date_actual TEXT,                  -- Date/heure effective de retour
    
    -- Valeurs financières (en centimes)
    total_rental_cents INTEGER NOT NULL DEFAULT 0,
    cleaning_fee_cents INTEGER NOT NULL DEFAULT 0,
    late_fee_cents INTEGER NOT NULL DEFAULT 0,
    damage_fee_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_amount_cents INTEGER NOT NULL DEFAULT 0,   -- Total TTC final facturé
    
    -- Caution
    deposit_amount_cents INTEGER NOT NULL DEFAULT 0,
    deposit_status TEXT NOT NULL DEFAULT 'non_recue' 
        CHECK(deposit_status IN ('non_recue', 'encaissee', 'empreinte_cb', 'cheque_retenu', 'restituee', 'conservee_partiellement', 'conservee_totalement')),
    deposit_notes TEXT,
    
    notes TEXT,
    pdf_path TEXT,                            -- Chemin local vers l'archive du bon généré
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_items (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    variant_id TEXT NOT NULL REFERENCES item_variants(id) ON DELETE RESTRICT,
    item_type TEXT NOT NULL CHECK(item_type IN ('location', 'vente')),
    unit_price_cents INTEGER NOT NULL,        -- Prix appliqué au moment du contrat
    deposit_cents INTEGER NOT NULL DEFAULT 0,
    pickup_condition TEXT,                    -- État constaté au départ
    return_condition TEXT,                    -- État constaté au retour
    is_returned INTEGER NOT NULL DEFAULT 0,   -- 0 = Non rendu, 1 = Rendu
    return_date TEXT,
    notes TEXT
);

-------------------------------------------------------------------------------
-- 5. RÈGLEMENTS & CAISSE
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_cents INTEGER NOT NULL,            -- Montant versé en centimes
    payment_type TEXT NOT NULL CHECK(payment_type IN ('acompte', 'solde', 'caution', 'frais_retard', 'degradation', 'remboursement')),
    payment_method TEXT NOT NULL CHECK(payment_method IN ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre')),
    transaction_reference TEXT,               -- N° chèque ou référence TPE
    notes TEXT,
    created_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 6. SYSTÈME D'ALERTES & NOTIFICATIONS DE RETOUR
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_alerts (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('j_minus_3', 'j_minus_2', 'j_minus_1', 'jour_j', 'retard')),
    due_date TEXT NOT NULL,                   -- Date de déclenchement calculée
    is_triggered INTEGER NOT NULL DEFAULT 0,  -- 0 = en attente, 1 = notifié
    triggered_at TEXT,
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 7. AUDIT LOGS & HISTORIQUE
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,                     -- Ex: 'CREATE_CONTRACT', 'UPDATE_STOCK', 'RETURN_ITEM'
    entity_table TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,                             -- Diff JSON ou description
    created_at TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- INDEX DE PERFORMANCE
-------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_item_variants_article ON item_variants(article_id);
CREATE INDEX IF NOT EXISTS idx_item_variants_barcode ON item_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_item_variants_status ON item_variants(status);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts(pickup_date_scheduled, return_date_scheduled);
CREATE INDEX IF NOT EXISTS idx_contract_items_variant ON contract_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_return_alerts_due ON return_alerts(due_date, is_triggered);
```

---

## 4. Découpage et Feuille de Route des Modules

Chaque module ci-dessous fera l'objet d'une mission spécifique ordonnée :

### Module A — Gestion du Stock
- Modèles d'articles hiérarchiques : Catégories (Costumes 2/3 pièces, Chaussures Richelieu/Derbies, Cravates, Boutons de manchette, etc.).
- Gestion unitaire des déclinaisons physiques (variantes de tailles/pointures/drops, états d'usure, codes-barres).
- États de cycle de vie d'une pièce : `disponible`, `réservé`, `en location`, `au_pressing`, `en_retouche`, `indisponible`, `vendu`.
- Interface d'inventaire réactive avec recherche rapide, filtres par statut/taille, création/modification par formulaires contrôlés.

### Module B — Gestion des Clients
- Annuaire client : fiche détaillée (contact, pièce d'identité, mensurations habituelles, préférences).
- Historique complet des locations et achats passés par client.
- Détection des impayés, pénalités passées ou statuts sensibles (blacklist/litiges).
- Recherche instantanée (nom, téléphone, n° de pièce).

### Module C — Réservations & Locations
- Calendrier interactif et vue planning des réservations.
- Moteur de disponibilité : vérification en temps réel des conflits de dates pour chaque variante d'article avec marge de sécurité (temps de pressing/retouche).
- Calculateur de devis et contrat : tarif de base, remises, options d'entretien/nettoyage, montant de la caution obligatoire.
- Workflow : Devis / Réservation -> Retrait / Départ -> Retour / Contrôle d'état.

### Module D — Bons de Vente / Location en 2 Exemplaires (PDF)
- Générateur de contrat/bon officiel via `pdf-lib` :
  - Exemplaire 1 : "Exemplaire Client"
  - Exemplaire 2 : "Exemplaire Boutique"
- Mentions obligatoires : coordonnées boutique et client, descriptif des articles loués (codes-barres, tailles, états de départ), dates précises de mise à disposition et retour, montant total, acomptes, caution détaillée, conditions générales de location (CGL) et zones d'émargement / signature.
- Prévisualisation intégrée et impression directe / sauvegarde archivée.

### Module E — Système d'Alertes de Retour
- Moteur d'évaluation planifiée des échéances (J-3, J-2, J-1, Jour-J, Retard avéré).
- Déclenchement de notifications via la `Tauri Notification API` sur l'OS et bandeau / badge d'alerte dans l'application avec toasts (`sonner`).
- Gestion des pénalités automatiques de retard configurables (taux forfaitaire ou journalier).

### Module F — Caisse & Vente Directe
- Encaissement multi-moyens : Espèces, Carte Bancaire (TPE), Chèques, Virements.
- Gestion des acomptes à la réservation et solde au retrait.
- Enregistrement sécurisé des cautions (empreinte, chèque de garantie non encaissé, espèces).
- Module de vente directe pour articles consommables ou neufs (chemises, nœuds papillon, chaussettes, cirage, etc.).

### Module G — Dashboard & Statistiques
- Tableaux de bord synthétiques interactifs (`Recharts` & KPIs) :
  - Chiffre d'affaires global et périodique (journalier, hebdomadaire, mensuel).
  - Taux de rotation et d'occupation du parc de costumes et chaussures.
  - Articles les plus rentables / les plus demandés.
  - Suivi des cautions en cours et retards de restitution.

### Module H — Rapports & Exports
- Génération de rapports comptables et d'activité périodiques (PDF synthétiques, exports tableurs CSV/Excel).
- Registre des mouvements de caisse et récapitulatif de TVA.
- Export d'inventaire complet pour valorisation de stock et bilan.

### Module I — Administration & Sécurité
- Gestion multi-utilisateurs avec rôles (`admin`, `manager`, `seller`).
- Paramètres de la boutique (nom, SIRET, adresse, conditions générales, taux TVA, forfaits retard/pressing).
- Système de sauvegarde manuelle et automatique de la base SQLite (export/import de snapshot `.db`).
- Journal d'audit (`audit_logs`) pour la traçabilité des opérations sensibles.

### Module J — Finitions UI/UX & Packaging
- Thème sur mesure moderne et élégant dédié au secteur événementiel haut de gamme (palette sombre ou claire raffinée avec TailwindCSS et Framer Motion).
- Raccourcis clavier pour caisse et inventaire (scan code-barre).
- Optimisation du binaire de production Tauri v2 pour Windows (NSIS installer / MSI).

---

## 5. Règles de Déploiement et d'Exécution des Tâches
1. **Validation par étapes** : Chaque module A à J est développé et testé de manière autonome avant d'aborder le suivant.
2. **Pas de code prématuré** : Ne coder que le périmètre défini par la mission active demandée par l'utilisateur.
3. **Immutabilité des règles financières et temporelles** : Aucun calcul sur des flottants d'argent, aucune date sans UTC ISO 8601.
