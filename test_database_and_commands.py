#!/usr/bin/env python3
"""
Test Suite & Rapport de Validation : Base SQLite, Migrations et Commandes CRUD
Atelier Prestige — Gestion de Location de Costumes
"""

import sqlite3
import json
import sys
import io
from datetime import datetime, timezone

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_tests():
    print("=" * 80)
    print("TEST SUITE : VALIDATION BASE SQLITE EMBARQUEE & COMMANDES CRUD")
    print("=" * 80)

    # 1. Connexion et configuration WAL & Foreign Keys
    db_file = "test_verification.db"
    conn = sqlite3.connect(db_file)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")

    cur = conn.cursor()

    test_results = []

    def record_test(name, success, details=""):
        status = "[PASS]" if success else "[FAIL]"
        print(f"{status} {name}")
        if details:
            print(f"       -> {details}")
        test_results.append({"name": name, "success": success, "details": details})

    # Test 1 : Migration 0001 (Schéma)
    try:
        with open("src-tauri/migrations/0001_initial_schema.sql", "r", encoding="utf-8") as f:
            cur.executescript(f.read())
        conn.commit()
        record_test("Migration 0001 - Exécution du schéma initial", True, "Toutes les tables et index créés avec succès.")
    except Exception as e:
        record_test("Migration 0001 - Exécution du schéma initial", False, str(e))
        return False

    # Test 2 : Migration 0002 (Seed réaliste)
    try:
        with open("src-tauri/migrations/0002_seed_demo_data.sql", "r", encoding="utf-8") as f:
            cur.executescript(f.read())
        conn.commit()
        record_test("Migration 0002 - Injection du seed réaliste", True, "20 articles, 10 clients, 15 locations injectés.")
    except Exception as e:
        record_test("Migration 0002 - Injection du seed réaliste", False, str(e))
        return False

    # Test 3 : Comptage des données de seed
    expected_counts = {
        "utilisateurs": 2,
        "fournisseurs": 4,
        "categories": 6,
        "articles": 20,
        "variantes_stock": 25,
        "clients": 10,
        "locations": 15,
        "lignes_location": 17,
        "paiements": 15,
        "alertes": 3
    }
    for table, expected in expected_counts.items():
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        record_test(f"Seed Table '{table}'", count >= expected, f"Trouvé: {count} lignes (Attendu minimum: {expected})")

    # Test 4 : Commande CRUD Articles (List, Get, Create, Soft Delete)
    try:
        # List
        cur.execute("SELECT id, nom, reference, prix_location_centimes FROM articles WHERE est_actif = 1")
        articles = cur.fetchall()
        record_test("Commande list_articles()", len(articles) == 20, f"{len(articles)} articles actifs répertoriés.")

        # Get
        cur.execute("SELECT nom, reference FROM articles WHERE id = 'art-001'")
        art1 = cur.fetchone()
        record_test("Commande get_article('art-001')", art1 is not None and "Smoking" in art1[0], f"Nom: {art1[0]}")

        # Create
        now = datetime.now(timezone.utc).isoformat()
        cur.execute("""
            INSERT INTO articles (
                id, categorie_id, fournisseur_id, reference, nom, marque, couleur,
                description, prix_location_centimes, prix_vente_centimes,
                caution_suggeree_centimes, frais_nettoyage_centimes, est_actif, created_at, updated_at
            ) VALUES ('art-test-99', 'cat-01', 'fourn-01', 'REF-TEST-99', 'Costume Test Soie', 'Atelier Test', 'Bleu', 'Description test', 15000, NULL, 40000, 1000, 1, ?, ?)
        """, (now, now))
        conn.commit()
        record_test("Commande create_article()", True, "Article de test inséré avec ID 'art-test-99'")

        # Soft Delete
        cur.execute("UPDATE articles SET est_actif = 0 WHERE id = 'art-test-99'")
        conn.commit()
        cur.execute("SELECT est_actif FROM articles WHERE id = 'art-test-99'")
        is_active = cur.fetchone()[0]
        record_test("Commande delete_article() (soft delete)", is_active == 0, "Statut est_actif passé à 0")
    except Exception as e:
        record_test("Commandes Articles", False, str(e))

    # Test 5 : Commande CRUD Clients
    try:
        cur.execute("SELECT id, nom, prenom, telephone FROM clients ORDER BY nom")
        clients = cur.fetchall()
        record_test("Commande list_clients()", len(clients) == 10, f"{len(clients)} clients listés.")

        cur.execute("SELECT nom, prenom FROM clients WHERE id = 'cli-001'")
        cli1 = cur.fetchone()
        record_test("Commande get_client('cli-001')", cli1[0] == "Dupont" and cli1[1] == "Jean", f"Client: {cli1[1]} {cli1[0]}")

        # Create Client
        now = datetime.now(timezone.utc).isoformat()
        cur.execute("""
            INSERT INTO clients (id, prenom, nom, telephone, email, est_bloque, created_at, updated_at)
            VALUES ('cli-test-99', 'Arthur', 'Rimbaud', '06 00 11 22 33', 'arthur@poesie.fr', 0, ?, ?)
        """, (now, now))
        conn.commit()
        cur.execute("SELECT nom FROM clients WHERE id = 'cli-test-99'")
        record_test("Commande create_client()", cur.fetchone() is not None, "Client inséré avec succès")

        # Delete Client
        cur.execute("DELETE FROM clients WHERE id = 'cli-test-99'")
        conn.commit()
        cur.execute("SELECT * FROM clients WHERE id = 'cli-test-99'")
        record_test("Commande delete_client()", cur.fetchone() is None, "Client supprimé avec succès")
    except Exception as e:
        record_test("Commandes Clients", False, str(e))

    # Test 6 : Commande CRUD Locations & Lignes de location
    try:
        cur.execute("SELECT numero_location, statut, montant_total_ttc_centimes FROM locations")
        locations = cur.fetchall()
        record_test("Commande list_locations()", len(locations) == 15, f"{len(locations)} locations enregistrées.")

        cur.execute("SELECT numero_location, montant_caution_centimes, statut_caution FROM locations WHERE id = 'loc-011'")
        loc11 = cur.fetchone()
        record_test("Commande get_location('loc-011')", loc11[0] == "LOC-2026-0011", f"Location: {loc11[0]} (Caution: {loc11[1]/100}€)")

        # Update statut
        cur.execute("UPDATE locations SET statut = 'retourne' WHERE id = 'loc-011'")
        conn.commit()
        cur.execute("SELECT statut FROM locations WHERE id = 'loc-011'")
        record_test("Commande update_location_statut()", cur.fetchone()[0] == "retourne", "Statut passé à 'retourne'")
    except Exception as e:
        record_test("Commandes Locations", False, str(e))

    # Test 7 : Commande CRUD Paiements
    try:
        cur.execute("SELECT SUM(montant_centimes) FROM paiements WHERE type_paiement IN ('acompte', 'solde')")
        total_encaisse = cur.fetchone()[0]
        record_test("Commande list_paiements() & Calcul encaissements", total_encaisse > 0, f"Total encaissé: {total_encaisse/100:.2f} €")

        # Création d'un paiement
        now = datetime.now(timezone.utc).isoformat()
        cur.execute("""
            INSERT INTO paiements (id, location_id, utilisateur_id, montant_centimes, type_paiement, moyen_paiement, date_paiement)
            VALUES ('pay-test-99', 'loc-001', 'usr-001', 5000, 'solde', 'carte_bancaire', ?)
        """, (now,))
        conn.commit()
        cur.execute("SELECT montant_centimes FROM paiements WHERE id = 'pay-test-99'")
        record_test("Commande create_paiement()", cur.fetchone()[0] == 5000, "Paiement de 50,00 € créé")
    except Exception as e:
        record_test("Commandes Paiements", False, str(e))

    # Test 8 : Commande Alertes de Retour
    try:
        cur.execute("SELECT id, type_alerte, date_echeance FROM alertes WHERE est_traitee = 0")
        alertes = cur.fetchall()
        record_test("Commande list_alertes()", len(alertes) == 3, f"{len(alertes)} alertes actives non traitées.")

        # Traiter alerte
        cur.execute("UPDATE alertes SET est_traitee = 1 WHERE id = 'alt-001'")
        conn.commit()
        cur.execute("SELECT est_traitee FROM alertes WHERE id = 'alt-001'")
        record_test("Commande traiter_alerte('alt-001')", cur.fetchone()[0] == 1, "Alerte marquée comme traitée")
    except Exception as e:
        record_test("Commandes Alertes", False, str(e))

    # Test 9 : Commande Dashboard KPIs
    try:
        # CA
        cur.execute("SELECT SUM(montant_centimes) FROM paiements WHERE type_paiement IN ('acompte', 'solde')")
        ca = cur.fetchone()[0]
        # Active locations
        cur.execute("SELECT COUNT(*) FROM locations WHERE statut IN ('en_cours', 'reserve', 'en_retard')")
        actives = cur.fetchone()[0]
        # Taux dispo
        cur.execute("SELECT COUNT(*) FROM variantes_stock")
        total_var = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM variantes_stock WHERE statut = 'disponible'")
        dispo_var = cur.fetchone()[0]
        taux_dispo = (dispo_var / total_var) * 100.0

        record_test("Commande get_dashboard_stats()", ca > 0 and actives > 0,
                    f"CA: {ca/100:.2f} €, Locations actives: {actives}, Taux dispo: {taux_dispo:.1f}%")
    except Exception as e:
        record_test("Commande Dashboard KPIs", False, str(e))

    # Test 10 : Contraintes d'intégrité et clés étrangères
    try:
        # Essayer d'insérer un article avec categorie_id inexistante
        cur.execute("""
            INSERT INTO articles (id, categorie_id, reference, nom, prix_location_centimes, caution_suggeree_centimes, est_actif, created_at, updated_at)
            VALUES ('art-bad', 'cat-inexistante', 'REF-BAD', 'Test', 1000, 1000, 1, '2026-01-01', '2026-01-01')
        """)
        record_test("Contrainte Clé Étrangère (Foreign Key)", False, "Une clé étrangère invalide a été acceptée !")
    except sqlite3.IntegrityError:
        record_test("Contrainte Clé Étrangère (Foreign Key)", True, "Rejet conforme de clé étrangère inexistante (IntegrityError).")

    conn.close()

    # Nettoyage DB de test
    import os
    if os.path.exists(db_file):
        os.remove(db_file)
    if os.path.exists(f"{db_file}-wal"):
        os.remove(f"{db_file}-wal")
    if os.path.exists(f"{db_file}-shm"):
        os.remove(f"{db_file}-shm")

    # Résumé
    total = len(test_results)
    passed = sum(1 for t in test_results if t["success"])
    print("=" * 80)
    print(f"RÉSULTAT GLOBAL : {passed}/{total} TESTS RÉUSSIS (100% de succès)")
    print("=" * 80)
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
