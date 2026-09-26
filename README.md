# Atelier Prestige — Gestion de Location Costumes & Chaussures d'Événement

Application Desktop complète et moderne conçue avec **Tauri 2 (Rust)** et **React 18 + TypeScript + TailwindCSS + shadcn/ui**. Développée pour la gestion haut de gamme de boutiques de cérémonie et événementiel.

---

## Architecture & Stack Technique

- **Shell Desktop** : [Tauri v2](https://v2.tauri.app/) (Rust 2021)
- **Frontend** : React 18, TypeScript (mode strict), TailwindCSS, Framer Motion
- **Composants & Design System** : Inspiration shadcn/ui, mode sombre persistant, animations unifiées (`animations.ts`)
- **Visualisations & Graphiques** : Recharts (évolution CA, répartition catégories, classements)
- **State Management** : Zustand (avec persistance de thème et état réactif multi-stores)
- **Génération & Impression PDF** : `pdf-lib` (bons de location en double exemplaire strict, reçus de caisse 80mm, rapports Z de clôture)
- **Sécurité & Authentification** : Rôles (`admin` & `vendeur`), mots de passe hachés avec `bcryptjs`
- **Sauvegarde** : Archives ZIP horodatées complètes (avec `jszip`), rotation automatique sur les 30 dernières copies
- **Recherche Universelle** : Raccourci global **Ctrl+K** / **Cmd+K** multi-entités (articles, clients, locations)
- **Tests** : Vitest + jsdom (couverture des flux critiques de réservation, calculs financiers et génération PDF)

---

## Prérequis

1. **Node.js** : version 18.x ou 20.x recommandée (`node -v`)
2. **Gestionnaire de paquets** : npm (`npm -v`)
3. **Rust & Cargo** (uniquement pour compiler le binaire natif Tauri) :
   - Installer Rust via [rustup.rs](https://rustup.rs/)
   - Sur Windows : Microsoft C++ Build Tools (Visual Studio Installer)
   - Sur macOS : Xcode Command Line Tools (`xcode-select --install`)
   - Sur Linux : `build-essential`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`

---

## Installation et Lancement Rapide

### 1. Cloner et installer les dépendances

```bash
cd "logiceil de location costume"
npm install --legacy-peer-deps
```

### 2. Lancer en mode Développement Web (Vite)

Pour tester rapidement le frontend dans votre navigateur :

```bash
npm run dev
```
L'interface est accessible par défaut sur `http://localhost:1420`.

### 3. Lancer l'Application Desktop Native (Tauri)

Pour exécuter la fenêtre native Tauri avec le backend Rust :

```bash
npm run tauri dev
```

---

## Exécution des Tests Automatisés

Le projet inclut une suite de tests unitaires et d'intégration validant les flux critiques :
- Création de location de bout en bout et vérification des disponibilités
- Agrégation des statistiques et calculs financiers du Dashboard
- Génération binaire et conformité des 2 exemplaires du bon de location PDF
- Moteur d'évaluation et de déclenchement des alertes (J-3, J-2, J-1, Jour-J, Retard)

Pour lancer la suite de tests avec Vitest :

```bash
npm run test
```

---

## Compiler l'Application pour la Production

### 1. Build du Frontend seul

```bash
npm run build
```
Vérifie le typage TypeScript (`strict: true`) et génère les assets optimisés dans `/dist`.

### 2. Générer l'Installeur Desktop (.msi / .exe sur Windows, .dmg sur macOS)

```bash
npm run tauri build
```

Les packages d'installation seront créés dans :
- **Windows** : `src-tauri/target/release/bundle/msi/` et `src-tauri/target/release/bundle/nsis/`
- **macOS** : `src-tauri/target/release/bundle/dmg/`
- **Linux** : `src-tauri/target/release/bundle/deb/` ou `appimage/`

---

## Comptes de Démonstration Intégrés

| Identifiant | Rôle | Mot de passe | Droits d'accès |
|-------------|------|--------------|----------------|
| `admin` | Administrateur | `admin123` | Accès complet, paramétrage boutique, clôtures, purge, journal d'audit |
| `vendeur` | Vendeur Boutique | `vendeur123` | Création de locations, caisse, consultation stock et clients (paramètres verrouillés) |

---

## Raccourcis Clavier Principaux

- **Ctrl + K** (ou **Cmd + K**) : Ouvre la recherche universelle instantanée
- **Esc** : Ferme la recherche ou les modals ouverts
- **Touches Haut / Bas + Entrée** : Navigation fluide dans les résultats de recherche universelle

---

## Structure du Projet

```
.
├── src/
│   ├── __tests__/             # Suites de tests Vitest (flux critiques)
│   ├── components/
│   │   ├── alerts/            # Gestion des alertes et relances
│   │   ├── auth/              # Formulaire de login et ProtectedRoute
│   │   ├── caisse/            # Caisse enregistreuse, scanner QR, clôture Z
│   │   ├── clients/           # Fiches clients, pièces d'identité, blacklist
│   │   ├── dashboard/         # KPI, graphiques Recharts, classements Top 10
│   │   ├── layout/            # Sidebar avec badges, Topbar avec Ctrl+K & thème
│   │   ├── rentals/           # Wizard création contrat, calendrier, retours
│   │   ├── search/            # Modal de recherche universelle Ctrl+K
│   │   ├── stock/             # Inventaire pièces, étiquettes QR, variantes
│   │   └── ui/                # Skeletons, ErrorState et composants de base
│   ├── lib/                   # animations.ts, formatters, utils
│   ├── pages/                 # Écrans principaux de chaque module
│   ├── services/              # Abstraction IPC, génération PDF, dashboard
│   ├── store/                 # Stores Zustand (stock, client, rental, caisse, alert, auth, settings, theme)
│   └── types/                 # Interfaces TypeScript strictes
├── src-tauri/
│   ├── icons/                 # Icônes multi-résolutions (.ico, .icns, .png)
│   ├── src/                   # Commandes Rust et logique embarquée
│   └── tauri.conf.json        # Métadonnées et packaging de l'application
├── PROJECT_CONTEXT.md         # Spécification et règles architecturales
└── package.json
```

---

## Documentation Complémentaire & Guides

- **Guide AppLocker & Redémarrage (MOD-6)** : Consulter [`docs/APPLOCKER_AND_RESTART_GUIDE.md`](docs/APPLOCKER_AND_RESTART_GUIDE.md) pour les détails sur la compatibilité AppLocker/WDAC, les contournements en environnement de développement local et le protocole de vérification PID de `restart_app`.

---

© 2026 Atelier Prestige — Tous droits réservés.
