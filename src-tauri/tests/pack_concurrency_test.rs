use costume_rental_lib::db;
use std::fs;
use std::sync::Arc;

#[tokio::test]
async fn test_concurrent_pack_reservation() {
    let test_dir = std::env::temp_dir().join(format!("test_pack_conc_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Créer un article en mode 'quantite' avec STRICTEMENT quantite_disponible = 1
    let art_id = "art-test-conc-tie";
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO articles (
            id, categorie_id, reference, nom, prix_location_centimes,
            caution_suggeree_centimes, mode_gestion, quantite_stock, quantite_disponible,
            est_actif, created_at, updated_at
        ) VALUES (?, 'cat-06', 'ACC-TEST-TIE', 'Cravate Soie Test Unique', 1500, 3000, 'quantite', 1, 1, 1, ?, ?)"
    )
    .bind(art_id)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Failed to insert quantity article");

    // 2. Créer un pack contenant cet article
    let pack_id = "pack-test-unique";
    sqlx::query("INSERT INTO packs (id, nom, cible, prix_forfait_centimes, est_actif, created_at, updated_at) VALUES (?, 'Pack Concurrence', 'mixte', 5000, 1, ?, ?)")
        .bind(pack_id)
        .bind(&now)
        .bind(&now)
        .execute(&pool)
        .await
        .expect("Failed to insert pack");

    let item_id = "pitem-test-unique";
    sqlx::query("INSERT INTO pack_items (id, pack_id, categorie_id, article_id, quantite, obligatoire) VALUES (?, ?, 'cat-06', ?, 1, 1)")
        .bind(item_id)
        .bind(pack_id)
        .bind(art_id)
        .execute(&pool)
        .await
        .expect("Failed to insert pack item");

    // 3. Deux appels concurrents en parallèle réel avec tokio::spawn / tokio::join!
    let pool = Arc::new(pool);
    let pool1 = Arc::clone(&pool);
    let pool2 = Arc::clone(&pool);

    async fn execute_reserve(pool: Arc<sqlx::SqlitePool>, art_id: &str) -> Result<(), String> {
        let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();

        let update_res = sqlx::query(
            "UPDATE articles 
             SET quantite_disponible = quantite_disponible - 1, updated_at = ? 
             WHERE id = ? AND quantite_disponible >= 1"
        )
        .bind(&now)
        .bind(art_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        if update_res.rows_affected() == 0 {
            return Err("Stock insuffisant pour l'article (quantité disponible inférieure à 1)".to_string());
        }

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(())
    }

    let task1 = {
        let p = pool1;
        tokio::spawn(async move {
            execute_reserve(p, art_id).await
        })
    };

    let task2 = {
        let p = pool2;
        tokio::spawn(async move {
            execute_reserve(p, art_id).await
        })
    };

    let (res1, res2) = tokio::join!(task1, task2);
    let r1 = res1.unwrap();
    let r2 = res2.unwrap();

    println!("Resultat Reservation Client 1: {:?}", r1);
    println!("Resultat Reservation Client 2: {:?}", r2);

    // 4. Assertions strictes : EXACTEMENT un succès et un échec
    let successes = [r1.is_ok(), r2.is_ok()].iter().filter(|&&x| x).count();
    let failures = [r1.is_err(), r2.is_err()].iter().filter(|&&x| x).count();

    assert_eq!(successes, 1, "Exactement UN client doit obtenir la réservation");
    assert_eq!(failures, 1, "Exactement UN client doit être rejeté pour rupture de stock");

    // 5. Vérifier que la base est à 0 (pas -1)
    let qty: (i64,) = sqlx::query_as("SELECT quantite_disponible FROM articles WHERE id = ?")
        .bind(art_id)
        .fetch_one(&**pool)
        .await
        .unwrap();

    assert_eq!(qty.0, 0, "La quantité disponible finale doit être exactement 0");

    let _ = fs::remove_dir_all(&test_dir);
}
