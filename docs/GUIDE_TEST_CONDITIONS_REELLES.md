# Guide de Test en Conditions Réelles — Atelier Prestige

> **Version de l'application :** 2.0 (Tauri 2 + SQLite)  
> **Audience :** Testeur fonctionnel, responsable boutique, gérant  
> **Durée estimée de la campagne :** 1 à 2 semaines d'utilisation continue  
> **Devise officielle :** Dinar Algérien (DA, montants entiers)  
> **Cadre fiscal :** TVA 19%, calculs tronqués à l'entier  

---

## Sommaire

1. [Instructions générales & Mode d'emploi](#1-instructions-générales--mode-demploi)
2. [Points d'attention critiques (Historique des correctifs)](#2-points-dattention-critiques-historique-des-correctifs)
3. [Scénario 1 — Une Journée Complète en Boutique](#scénario-1--une-journée-complète-en-boutique)
4. [Scénario 2 — Cycle de Vie Intégral d'une Pièce Haute Couture](#scénario-2--cycle-de-vie-intégral-dune-pièce-haute-couture)
5. [Scénario 3 — Matrice de Disponibilité & Reprogrammation Dynamique](#scénario-3--matrice-de-disponibilité--reprogrammation-dynamique)
6. [Scénario 4 — Gestion Clientèle & Mensurations Structurées](#scénario-4--gestion-clientèle--mensurations-structurées)
7. [Scénario 5 — Contrôle Financier & Export des Rapports](#scénario-5--contrôle-financier--export-des-rapports)
8. [Scénario 6 — Résilience : Sauvegarde, Restauration & Redémarrage](#scénario-6--résilience--sauvegarde-restauration--redémarrage)
9. [Scénario 7 — Épreuves de Robustesse & Cas Limites](#scénario-7--épreuves-de-robustesse--cas-limites)
10. [Tableau de Synthèse des Anomalies Rencontrées](#10-tableau-de-synthèse-des-anomalies-rencontrées)

---

## 1. Instructions générales & Mode d'emploi

### Pré-requis
* L'application Atelier Prestige installée et lancée sur un PC sous Windows.
* Imprimante thermique de caisse (ou imprimante PDF par défaut) configurée.
* Scanner de code-barres / douchette USB (optionnel mais recommandé).

### Démarche pour chaque étape
1. Exécutez l'action décrite dans la colonne **Action du testeur**.
2. Comparez le comportement de l'écran avec le **Résultat attendu**.
3. Cochez la case `[ ] Conforme` ou `[ ] Bug rencontré`.
4. Si un bug apparaît, notez un descriptif concis immédiatement et reportez-le dans le [Tableau de Synthèse](#10-tableau-de-synthèse-des-anomalies-rencontrées).

---

## 2. Points d'attention critiques (Historique des correctifs)

Ces points ont fait l'objet de correctifs majeurs lors des audits techniques. Portez-y une vigilance accrue :

* **Distinction visuelle des statuts :** 
  * `Réservé` (contrat signé, mais costume encore physiquement en magasin) arbore un badge pétrole/ardoise distinct.
  * `En cours` (costume physiquement retiré par le client) arbore un badge bleu vif.
  * `Litige` a sa teinte d'alerte propre et ne doit **jamais** être confondu avec le statut jaune/orange du `Pressing`.
* **Cohérence Caisse Théorique vs Réelle :** Le montant théorique en caisse doit correspondre au centime/dinar près aux encaissements effectifs enregistrés dans la session courante.
* **Exports Rapports vs Affichage :** Tout filtre de date appliqué sur l'écran Rapports doit exporter des fichiers PDF/CSV dont les totaux sont **strictement identiques** aux chiffres affichés à l'écran (zéro recalcul divergent).
* **Bloquage du retrait sans caution :** Un contrat ne peut **jamais** passer en `Retiré / En cours` si la caution n'est ni payée ni enregistrée avec son type de garantie.
* **Pont Retouche -> Pressing :** Une clôture d'essayage cabine nécessitant une retouche doit créer l'envoi pressing automatiquement, sans forcer le vendeur à ressaisir la pièce manuellement.

---

## Scénario 1 — Une Journée Complète en Boutique

> **Objectif :** Valider l'intégralité des flux financiers et contractuels d'une journée type : de l'ouverture du tiroir-caisse jusqu'au Z de clôture.

### 1.1 Ouverture de session de caisse
* **Action :** Se connecter avec le compte Vendeur ou Gérant. Aller dans le menu `Caisse` -> onglet `Clôture / Session`. Si aucune session n'est ouverte, renseigner le fond de caisse initial (ex. `10 000 DA`) et valider.
* **Résultat attendu :** 
  * Le bandeau supérieur affiche la session active avec le nom de l'utilisateur, l'heure d'ouverture et le fond de caisse.
  * Le statut passe au vert `Session ouverte`.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 1.2 Création d'un contrat de location avec Pack
* **Action :** Aller dans `Locations` -> cliquer sur `Nouvelle Location`.
  * Sélectionner un client existant ou en créer un rapidement.
  * Choisir un Pack complet (ex. *Pack Cérémonie Prestige* avec costume + chemise + nœud papillon).
  * Renseigner la date de départ (ex. dans 3 jours) et date de retour (ex. dans 6 jours).
  * Vérifier que la caution recommandée s'affiche automatiquement.
* **Résultat attendu :** 
  * Tous les articles du pack sont réservés simultanément.
  * Le prix total calculé applique bien le forfait pack.
  * Le contrat est créé avec le statut `reserve` (badge pétrole distinct).
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 1.3 Encaissement d'un acompte
* **Action :** Sur la fiche de la location nouvellement créée, cliquer sur `Enregistrer un paiement`.
  * Sélectionner le type `Acompte / Solde`.
  * Saisir un montant partiel (ex. `5 000 DA` sur un total de `15 000 DA`).
  * Mode de règlement : `Espèces`.
  * Valider.
* **Résultat attendu :**
  * Le restant dû du contrat passe immédiatement à `10 000 DA`.
  * Une ligne d'encaissement apparaît dans l'historique financier du contrat.
  * Dans le menu `Caisse`, le tiroir théorique espèces a augmenté de `5 000 DA`.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 1.4 Tentative de retrait physique SANS caution (Test négatif bloquant)
* **Action :** Dans la table des locations, ouvrir le modal de gestion du contrat. Cliquer sur le bouton `Confirmer le Retrait Physique` sans avoir versé de caution.
* **Résultat attendu :** 
  * Le système **refuse** l'action.
  * Une alerte claire s'affiche : *"Impossible de confirmer le retrait : la caution n'a pas été enregistrée."*
  * Le statut du contrat reste impérativement à `reserve`.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 1.5 Enregistrement de la caution et confirmation du retrait
* **Action :** 
  * Cliquer sur `Enregistrer un paiement` -> Type : `Caution`.
  * Saisir le montant de la caution (ex. `20 000 DA`), mode : `Chèque` ou `Espèces`.
  * Valider.
  * Cliquer à nouveau sur `Confirmer le Retrait Physique`.
* **Résultat attendu :**
  * Le retrait est validé.
  * Le badge de statut bascule immédiatement de `reserve` (pétrole) à `en_cours` (bleu vif).
  * La date et l'heure du retrait effectif sont horodatées.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 1.6 Paiement du solde restant
* **Action :** Enregistrer le règlement des `10 000 DA` restants par `Carte Bancaire`.
* **Résultat attendu :**
  * Le restant dû tombe à `0 DA`.
  * Le contrat indique `Intégralement payé`.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 1.7 Paiement hors session de caisse (Test de résilience financière)
* **Action :** 
  * Aller dans `Caisse` et fermer temporairement la session.
  * Aller dans `Locations`, choisir un autre contrat et enregistrer un paiement de `2 000 DA`.
* **Résultat attendu :**
  * Le paiement est accepté dans SQLite pour ne pas bloquer un client au comptoir.
  * Un toast d'avertissement jaune explicite informe le vendeur : *"Paiement enregistré hors session de caisse : il sera réconcilié lors de la prochaine clôture."*
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 1.8 Clôture de caisse avec écart volontaire, puis sans écart
* **Action :** 
  * Rouvrir la session de caisse.
  * Cliquer sur `Clôturer la Caisse`.
  * **Test A (Écart volontaire) :** Saisir un montant réel en espèces inférieur de `500 DA` au montant théorique calculé. Observer l'affichage.
  * **Test B (Sans écart) :** Rectifier le montant réel pour qu'il égale exactement le théorique.
  * Valider la clôture définitive et lancer l'impression du Ticket Z.
* **Résultat attendu :**
  * En Test A : un badge rouge `Écart de caisse : -500 DA` s'affiche avec invite à justifier.
  * En Test B : le statut passe à `Conforme (0 DA d'écart)`.
  * Le Ticket Z imprimé/généré détaille : fond initial, ventilation Espèces / CB / Chèque, total des encaissements et écart final.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

---

## Scénario 2 — Cycle de Vie Intégral d'une Pièce Haute Couture

> **Objectif :** Suivre une variante de costume unique à travers toutes les étapes physiques de la vie en boutique : cabine d'essayage, retouche/pressing, location, retour, et contrôle dans la Matrice.

### 2.1 Enregistrement d'un passage en cabine d'essayage
* **Action :** 
  * Ouvrir le modal d'un client. Aller sur l'onglet `Essayages Cabine`.
  * Enregistrer un nouvel essai pour le costume `Smocking Noir Satin - T48`.
  * Choisir la date/heure courante.
* **Résultat attendu :**
  * L'essayage est enregistré avec le statut `en_cours`.
  * Dans la `Matrice de Disponibilité`, la pièce apparaît occupée par un créneau d'essayage violet/ambre.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 2.2 Clôture de l'essayage avec issue « Retouche Nécessaire »
* **Action :** 
  * Cliquer sur `Clôturer l'essai`.
  * Sélectionner l'issue : `Retouche nécessaire`.
  * Renseigner la consigne : *"Ourlet pantalon -2cm, resserrer taille veste"*.
  * Valider.
* **Résultat attendu :**
  * L'essayage est archivé comme terminé.
  * **Vérification clé :** Le module `Pressing & Retouches` a automatiquement créé une fiche d'envoi pour cette pièce avec le motif `retouche_necessaire` et les notes associées, sans double saisie.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 2.3 Traitement au Pressing / Atelier de retouche
* **Action :** 
  * Aller dans le module `Pressing`.
  * Retrouver la pièce envoyée. Cliquer sur `Réceptionner du pressing/retouche`.
  * Indiquer l'état : `Parfait état, retouche effectuée`.
* **Résultat attendu :**
  * L'envoi pressing passe au statut `recu`.
  * La pièce redevient disponible en stock (`disponible`).
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 2.4 Retour de location avec litige ou dégradation
* **Action :** 
  * Associer cette pièce à un contrat de location, confirmer son retrait, puis cliquer sur `Enregistrer le retour`.
  * Cocher `Dégradation constatée` (ex. accroc sur manche droite).
  * Appliquer des frais de dégradation de `3 000 DA` déduits de la caution.
  * Valider.
* **Résultat attendu :**
  * Le statut du contrat passe à `litige` (couleur d'alerte spécifique, nettement distincte de la couleur orange du pressing).
  * La caution est remboursée amputée des `3 000 DA`.
  * La pièce est automatiquement marquée `en_reparation` ou `indisponible` dans le stock.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

---

## Scénario 3 — Matrice de Disponibilité & Reprogrammation Dynamique

> **Objectif :** Tester la détection visuelle des conflits temporels, la gestion des tampons de nettoyage (pressing) et la reprogrammation par glisser-déposer (Drag & Drop).

### 3.1 Affichage et vérification du tampon pressing automatique
* **Action :** 
  * Ouvrir la `Matrice de Disponibilité` (vue planning chronologique).
  * Localiser une réservation se terminant un dimanche.
* **Résultat attendu :**
  * Le bloc de location bleu/pétrole est immédiatement suivi d'une zone hachurée ou colorée représentant le **tampon pressing** obligatoire (ex. 2 jours).
  * Le survol de la souris sur le tampon affiche une infobulle : *"Tampon pressing obligatoire - Restitution & Nettoyage"*.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 3.2 Glisser-déposer valide (Reprogrammation autorisée)
* **Action :** 
  * Cliquer sur un bloc de réservation et le faire glisser vers une semaine ultérieure complètement libre.
  * Relâcher la souris.
* **Résultat attendu :**
  * Un modal de confirmation demande validation du décalage des dates de location.
  * Après confirmation, le bloc et son tampon pressing se positionnent aux nouvelles dates.
  * La fiche du contrat de location reflète immédiatement les nouvelles dates.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 3.3 Glisser-déposer en collision directe (Test de blocage)
* **Action :** 
  * Tenter de glisser une réservation sur une période où la même pièce est déjà réservée par un autre client.
* **Résultat attendu :**
  * Le curseur ou la zone cible indique visuellement une interdiction (rouge / non autorisé).
  * Au relâchement, l'action est **rejetée**.
  * Un message d'erreur clair apparaît : *"Conflit de réservation : la variante est déjà réservée sur cet intervalle."*
  * Le bloc retourne instantanément à sa place d'origine.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 3.4 Glisser-déposer sur un tampon pressing (Test de violation tampon)
* **Action :** 
  * Tenter de positionner le début d'une réservation exactement sur le lendemain du retour d'un autre client (pendant les 48h de pressing).
* **Résultat attendu :**
  * L'action est refusée : *"La pièce est en cours de nettoyage/retouche durant cette période."*
  * Zéro chevauchement autorisé.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

---

## Scénario 4 — Gestion Clientèle & Mensurations Structurées

> **Objectif :** Vérifier que les mensurations ne sont plus un texte libre perdu dans des notes, mais des champs typés permettant recherche et conservation d'historique.

### 4.1 Fiche client et saisie des mensurations initiales
* **Action :** 
  * Créer une nouvelle cliente : `Mme Amina B.`, tél : `0550123456`.
  * Dans la section `Mensurations & Morphologie`, renseigner :
    * Tour de poitrine : `92 cm`
    * Tour de taille : `74 cm`
    * Tour de hanches : `98 cm`
    * Hauteur totale : `168 cm`
    * Longueur manche : `58 cm`
    * Pointure : `38`
  * Valider.
* **Résultat attendu :**
  * La fiche client est enregistrée.
  * Les mensurations s'affichent sous forme de tags/champs structurés dans le profil client.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 4.2 Évolution morphologique et historique d'audit
* **Action :** 
  * 6 mois plus tard (ou simulation d'ajustement) : ouvrir la fiche de `Mme Amina B.`.
  * Modifier le tour de taille : passer de `74 cm` à `71 cm`.
  * Cliquer sur `Enregistrer les mensurations`.
  * Cliquer sur `Voir l'historique des mensurations`.
* **Résultat attendu :**
  * La valeur active affiche bien `71 cm`.
  * Le panneau historique affiche l'ancienne valeur `74 cm` horodatée avec la mention de la date de modification.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 4.3 Recherche et filtrage transversal par mensurations
* **Action :** 
  * Aller sur la liste générale des Clients (`Clients`).
  * Utiliser le filtre avancé : chercher tous les clients dont le `Tour de taille` est compris entre `70 cm` et `75 cm`.
* **Résultat attendu :**
  * `Mme Amina B.` sort immédiatement dans les résultats.
  * Les clientes hors de cette fourchette sont masquées.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

---

## Scénario 5 — Contrôle Financier & Export des Rapports

> **Objectif :** Garantir une rigueur comptable absolue et l'alignement total entre l'écran interactif et les fichiers exportés (PDF / CSV).

### 5.1 Filtrage temporel et calculs en direct
* **Action :** 
  * Aller dans le menu `Rapports`.
  * Tester successivement les 3 filtres : `Aujourd'hui`, `Ce mois-ci`, `Période personnalisée` (du 1er au 15 du mois).
* **Résultat attendu :**
  * Les 4 indicateurs clés (Chiffre d'Affaires Encaissé, Cautions Détenues, Nombre de Locations, Valeur Stock) s'actualisent instantanément.
  * Le tableau des transactions liste uniquement les mouvements de la période choisie.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 5.2 Export PDF et comparaison rigoureuse avec l'écran
* **Action :** 
  * Tout en gardant le filtre `Période personnalisée` actif, cliquer sur `Exporter PDF`.
  * Ouvrir le document PDF généré.
  * Comparer point par point le CA total, la TVA collectée (19%) et le nombre de contrats avec les données affichées à l'écran.
* **Résultat attendu :**
  * **Zéro divergence :** Les montants au dinar près sur le PDF sont strictement égaux à l'écran.
  * Le document PDF porte l'en-tête de la boutique, la date d'extraction et la période filtrée.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 5.3 Export CSV et vérification des colonnes
* **Action :** 
  * Cliquer sur `Exporter CSV (Journal de Caisse)`.
  * Ouvrir le fichier dans Excel ou LibreOffice.
* **Résultat attendu :**
  * L'encodage (UTF-8) préserve les accents français.
  * Le séparateur décimal et les séparateurs de colonnes sont propres.
  * La somme de la colonne `Montant` dans Excel correspond au CA affiché dans l'application.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

---

## Scénario 6 — Résilience : Sauvegarde, Restauration & Redémarrage

> **Objectif :** Valider la sécurité des données de la boutique en cas de panne matérielle ou de fausse manipulation.

### 6.1 Création d'une sauvegarde SQLite
* **Action :** 
  * Aller dans `Paramètres` -> `Sauvegardes & Données`.
  * Cliquer sur `Créer une sauvegarde immédiate`.
  * Choisir un dossier de destination.
* **Résultat attendu :**
  * Un fichier compressé ou `.db` horodaté (ex. `backup_atelier_prestige_2026-09-26.sqlite`) est créé.
  * Un message confirme le succès avec la taille du fichier.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 6.2 Altération volontaire de test
* **Action :** 
  * Modifier le nom d'un client en `"CLIENT TEST SUPPRESSION"`.
  * Supprimer un article de test dans le catalogue.
  * Vérifier que la modification est visible à l'écran.
* **Résultat attendu :**
  * Les données modifiées sont effectives.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 6.3 Restauration et purge des alertes fantômes
* **Action :** 
  * Revenir dans `Paramètres` -> `Sauvegardes & Données`.
  * Cliquer sur `Restaurer une sauvegarde`.
  * Sélectionner le fichier créé en 6.1.
  * Valider l'avertissement irréversible.
* **Résultat attendu :**
  * L'application restaure la base SQLite.
  * Les modifications de l'étape 6.2 ont disparu : le client retrouve son nom d'origine, l'article supprimé est réapparu.
  * **Vérification cruciale :** Le centre de notifications/alertes ne contient **aucune alerte orpheline ou fantôme** liée aux éléments de l'état altéré.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 6.4 Redémarrage intégré de l'application (restart_app)
* **Action :** 
  * Après la restauration (ou via le bouton dédié dans les paramètres), déclencher le redémarrage automatique de l'application.
* **Résultat attendu :**
  * La fenêtre se ferme proprement.
  * Une nouvelle instance de l'application s'ouvre sans intervention manuelle en moins de 3 secondes.
  * L'utilisateur se retrouve sur l'écran d'accueil avec les données stables.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

---

## Scénario 7 — Épreuves de Robustesse & Cas Limites

> **Objectif :** Pousser le logiciel dans ses retranchements pour s'assurer qu'aucun clic compulsif ou aléa électrique ne corrompe la base.

### 7.1 Double-clic frénétique sur les boutons de validation (Anti-rebond)
* **Action :** 
  * Sur un écran d'encaissement de paiement ou de création de contrat, cliquer 4 ou 5 fois très rapidement sur le bouton `Valider`.
* **Résultat attendu :**
  * Le bouton se désactive dès le premier clic (`isSubmitting: true` avec spinner).
  * **Une seule et unique écriture** est effectuée en base. Zéro paiement en double, zéro contrat dupliqué.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 7.2 Fermeture brutale de l'application (Kill process)
* **Action :** 
  * Ouvrir le modal de clôture de caisse ou de retour de location.
  * Tuer brutalement le processus (via le Gestionnaire des tâches Windows `Fin de tâche` ou `Alt + F4`).
  * Relancer l'application.
* **Résultat attendu :**
  * L'application redémarre sans écran blanc ni corruption.
  * La base SQLite (grâce au mode WAL et aux transactions ACID) est intègre : l'opération incomplète a été proprement annulée (rollback).
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

### 7.3 Tentative de double réservation concurrente
* **Action :** 
  * Si possible sur deux postes en réseau (ou en tentant deux réservations très rapprochées sur la même pièce) : réserver la pièce `P-001` pour le weekend du 15 au 18 octobre.
  * Tenter immédiatement de la réserver pour un second client sur le même weekend.
* **Résultat attendu :**
  * La première transaction réussit.
  * La seconde transaction est fermement rejetée par la contrainte d'exclusion SQLite avec un message explicite d'indisponibilité.
* [ ] Conforme &nbsp;&nbsp;&nbsp;&nbsp; [ ] Bug rencontré : __________________________________

---

## 10. Tableau de Synthèse des Anomalies Rencontrées

*Ce tableau doit être complété au fur et à mesure des tests. Chaque ligne pourra servir de point d'entrée pour un lot de maintenance.*

| N° | Scénario / Étape | Gravité (*Critique / Majeur / Modéré / Mineur*) | Description du problème observé | Comportement attendu | Capture / Réf |
|---|---|---|---|---|---|
| *Ex* | *1.4 Retrait* | *Majeur* | *Le toast d'erreur n'affiche pas la raison du refus.* | *Indiquer que la caution est manquante.* | *IMG_001.png* |
| **1** | | | | | |
| **2** | | | | | |
| **3** | | | | | |
| **4** | | | | | |
| **5** | | | | | |
| **6** | | | | | |
| **7** | | | | | |
| **8** | | | | | |

---

### Grille d'évaluation de la gravité
* **Critique :** Crash application, blocage total d'un encaissement, perte ou corruption de données.
* **Majeur :** Fonctionnalité métier bloquée sans contournement (ex. impossible d'imprimer un contrat).
* **Modéré :** Dysfonctionnement avec solution de contournement (ex. affichage visuel décalé mais données exactes).
* **Mineur :** Coquille textuelle, micro-défaut d'alignement cosmétique.
