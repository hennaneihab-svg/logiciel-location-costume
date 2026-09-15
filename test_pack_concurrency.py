import sqlite3
import threading
import time
from datetime import datetime

db_file = "test_dev_atelier.db"

# Initialiser un article de test avec quantite_disponible = 1
init_conn = sqlite3.connect(db_file)
init_cur = init_conn.cursor()
art_id = "art-conc-pack-001"
init_cur.execute("""
    INSERT OR REPLACE INTO articles (
        id, categorie_id, reference, nom, prix_location_centimes,
        caution_suggeree_centimes, mode_gestion, quantite_stock, quantite_disponible,
        est_actif, created_at, updated_at
    ) VALUES (?, 'cat-06', 'ACC-CONC-001', 'Cravate Soie Concurrence', 1500, 3000, 'quantite', 1, 1, 1, datetime('now'), datetime('now'))
""", (art_id,))
init_conn.commit()
init_conn.close()

results = []
barrier = threading.Barrier(2)

def client_reserve_thread(client_id):
    conn = sqlite3.connect(db_file, timeout=10.0)
    conn.isolation_level = None # Autocommit pour contrôle manuel des transactions
    cur = conn.cursor()
    
    # Attendre que les deux threads soient prêts pour lancer l'appel au même instant
    barrier.wait()
    start_t = time.perf_counter()
    
    try:
        cur.execute("BEGIN IMMEDIATE;")
        # Mise à jour conditionnelle atomique identique à la commande Rust reserve_pack
        cur.execute("""
            UPDATE articles 
            SET quantite_disponible = quantite_disponible - 1, 
                updated_at = datetime('now') 
            WHERE id = ? AND quantite_disponible >= 1
        """, (art_id,))
        
        rows = cur.rowcount
        if rows == 0:
            cur.execute("ROLLBACK;")
            results.append((client_id, "ECHEC", "Stock insuffisant (quantite_disponible < 1)"))
        else:
            cur.execute("COMMIT;")
            results.append((client_id, "SUCCES", "Réservation confirmée"))
    except Exception as e:
        cur.execute("ROLLBACK;")
        results.append((client_id, "ECHEC_EXCEPTION", str(e)))
    finally:
        conn.close()

# Lancer deux threads concurrents
t1 = threading.Thread(target=client_reserve_thread, args=("Client-1",))
t2 = threading.Thread(target=client_reserve_thread, args=("Client-2",))

t1.start()
t2.start()
t1.join()
t2.join()

print("=" * 60)
print("TEST DE CONCURRENCE REEL SUR BASE SQLITE EMBARQUEE")
print("=" * 60)
for r in results:
    print(f"[{r[1]}] {r[0]} : {r[2]}")

check_conn = sqlite3.connect(db_file)
cur = check_conn.cursor()
cur.execute("SELECT quantite_disponible, quantite_stock FROM articles WHERE id = ?", (art_id,))
row = cur.fetchone()
print(f"ETAT FINAL BASE : quantite_disponible = {row[0]}, quantite_stock = {row[1]}")
check_conn.close()

success_count = sum(1 for r in results if r[1] == "SUCCES")
fail_count = sum(1 for r in results if r[1] == "ECHEC")

assert success_count == 1, f"Attendu 1 succès, obtenu {success_count}"
assert fail_count == 1, f"Attendu 1 échec, obtenu {fail_count}"
assert row[0] == 0, f"Attendu stock final 0, obtenu {row[0]}"
print("VALIDATION TEST : REUSSITE ABSOLUE. Aucune double réservation, pas de stock négatif.")
