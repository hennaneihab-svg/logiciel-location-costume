import sqlite3
import json

db_file = "test_dev_atelier.db"
conn = sqlite3.connect(db_file)
conn.execute("PRAGMA foreign_keys = ON;")
conn.execute("PRAGMA journal_mode = WAL;")
cur = conn.cursor()

# 1. Vérifier si migrations 1 et 2 sont appliquées, sinon les appliquer
cur.execute("CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, nom TEXT NOT NULL, appliquee_le TEXT NOT NULL);")
conn.commit()

cur.execute("SELECT version FROM _migrations WHERE version = 1")
if not cur.fetchone():
    with open("src-tauri/migrations/0001_initial_schema.sql", "r", encoding="utf-8") as f:
        cur.executescript(f.read())
    cur.execute("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (1, '0001_initial_schema', datetime('now'))")
    conn.commit()
    print("Migration 1 appliquee.")

cur.execute("SELECT version FROM _migrations WHERE version = 2")
if not cur.fetchone():
    with open("src-tauri/migrations/0002_seed_demo_data.sql", "r", encoding="utf-8") as f:
        cur.executescript(f.read())
    cur.execute("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (2, '0002_seed_demo_data', datetime('now'))")
    conn.commit()
    print("Migration 2 appliquee.")

# 2. Appliquer la Migration 3 sur la base existante
print("\n--- APPLICATION MIGRATION 0003 SUR BASE EXISTANTE ---")
with open("src-tauri/migrations/0003_articles_mode_gestion_et_packs.sql", "r", encoding="utf-8") as f:
    sql_script = f.read()

cur.executescript(sql_script)
cur.execute("INSERT OR REPLACE INTO _migrations (version, nom, appliquee_le) VALUES (3, '0003_articles_mode_gestion_et_packs', datetime('now'))")
conn.commit()
print("Migration 3 appliquee avec succes !")

# 3. Afficher le schéma réel de PRAGMA table_info
print("\n--- PRAGMA table_info(articles) ---")
cur.execute("PRAGMA table_info(articles);")
cols_articles = cur.fetchall()
for col in cols_articles:
    print(f"cid: {col[0]}, name: {col[1]}, type: {col[2]}, notnull: {col[3]}, dflt_value: {col[4]}, pk: {col[5]}")

print("\n--- PRAGMA table_info(packs) ---")
cur.execute("PRAGMA table_info(packs);")
cols_packs = cur.fetchall()
for col in cols_packs:
    print(f"cid: {col[0]}, name: {col[1]}, type: {col[2]}, notnull: {col[3]}, dflt_value: {col[4]}, pk: {col[5]}")

print("\n--- PRAGMA table_info(pack_items) ---")
cur.execute("PRAGMA table_info(pack_items);")
cols_pack_items = cur.fetchall()
for col in cols_pack_items:
    print(f"cid: {col[0]}, name: {col[1]}, type: {col[2]}, notnull: {col[3]}, dflt_value: {col[4]}, pk: {col[5]}")

# 4. Vérifier les données injectées
print("\n--- CONTENU DE LA TABLE PACKS ---")
cur.execute("SELECT id, nom, cible, prix_forfait_centimes, est_actif FROM packs;")
for r in cur.fetchall():
    print(r)

print("\n--- CONTENU DE LA TABLE PACK_ITEMS ---")
cur.execute("SELECT id, pack_id, categorie_id, article_id, quantite, obligatoire FROM pack_items;")
for r in cur.fetchall():
    print(r)

print("\n--- VERIFICATION ARTICLES MODE QUANTITE (cat-06) ---")
cur.execute("SELECT id, nom, mode_gestion, quantite_stock, quantite_disponible FROM articles WHERE categorie_id = 'cat-06';")
for r in cur.fetchall():
    print(r)

conn.close()
