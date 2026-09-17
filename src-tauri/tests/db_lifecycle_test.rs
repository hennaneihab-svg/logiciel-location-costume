use costume_rental_lib::db;
use std::fs;

#[tokio::test]
async fn test_persistence_across_db_reconnect() {
    let test_dir = std::env::temp_dir().join(format!("test_atelier_persist_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    // 1. Initialiser le pool et exécuter les migrations
    let pool1 = db::init_db(&test_dir).await.expect("Failed to init db pool 1");

    // 2. Insérer une donnée de test persistante
    let test_ref = "CI-TEST-PERSIST-001";
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT OR IGNORE INTO categories (id, nom, type, description, created_at)
         VALUES ('cat-costume', 'Costumes Test CI', 'costume', 'Catégorie de test pour CI', ?)"
    )
    .bind(&now)
    .execute(&pool1)
    .await
    .expect("Failed to insert test category in pool 1");

    sqlx::query(
        "INSERT INTO articles (
            id, categorie_id, fournisseur_id, reference, nom, marque, couleur,
            description, prix_location_centimes, prix_vente_centimes,
            caution_suggeree_centimes, frais_nettoyage_centimes, image_url,
            est_actif, created_at, updated_at
        ) VALUES ('art-ci-persist-1', 'cat-costume', 'fourn-01', ?, 'Costume CI Persist', 'Prestige', 'Noir',
            'Test persistence', 25000, 85000, 50000, 1500, '', 1, ?, ?)"
    )
    .bind(test_ref)
    .bind(&now)
    .bind(&now)
    .execute(&pool1)
    .await
    .expect("Failed to insert article in pool 1");

    // Flush checkpoint
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);")
        .execute(&pool1)
        .await
        .expect("WAL checkpoint failed");

    // 3. Clôturer le pool (simule la terminaison complète du processus)
    pool1.close().await;

    // 4. Réouvrir un tout nouveau pool (simule le redémarrage de l'application)
    let pool2 = db::init_db(&test_dir).await.expect("Failed to re-init db pool 2");

    // 5. Vérifier que la donnée est intacte et immédiatement requêtable
    let row: Option<(String,)> = sqlx::query_as("SELECT reference FROM articles WHERE reference = ?")
        .bind(test_ref)
        .fetch_optional(&pool2)
        .await
        .expect("Failed to query pool 2");

    assert!(row.is_some(), "La référence de test {} DOIT persister après redémarrage", test_ref);
    assert_eq!(row.unwrap().0, test_ref);

    pool2.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_backup_and_restore_cycle_with_pool_reconnect() {
    use std::io::{Read, Write};

    let test_dir = std::env::temp_dir().join(format!("test_atelier_backup_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Insérer la donnée A
    let ref_a = "CI-TEST-BACKUP-A";
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT OR IGNORE INTO categories (id, nom, type, description, created_at)
         VALUES ('cat-costume', 'Costumes Test CI', 'costume', 'Catégorie de test pour CI', ?)"
    )
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Failed to insert test category");

    sqlx::query(
        "INSERT INTO articles (
            id, categorie_id, fournisseur_id, reference, nom, marque, couleur,
            description, prix_location_centimes, prix_vente_centimes,
            caution_suggeree_centimes, frais_nettoyage_centimes, image_url,
            est_actif, created_at, updated_at
        ) VALUES ('art-ci-a', 'cat-costume', 'fourn-01', ?, 'Article A Sauvegarde', 'Prestige', 'Noir',
            'Donnée A', 20000, 70000, 40000, 1000, '', 1, ?, ?)"
    )
    .bind(ref_a)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Failed to insert article A");

    // 2. Créer une sauvegarde SQLite (flush WAL + copy)
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);")
        .execute(&pool)
        .await
        .expect("WAL checkpoint failed");

    let db_path = test_dir.join("costume_rental.db");
    let backup_path = test_dir.join("backup_test_a.db");
    fs::copy(&db_path, &backup_path).expect("Failed to copy db to backup");

    // 3. Modifier la base : supprimer A et insérer B
    let ref_b = "CI-TEST-BACKUP-B";
    sqlx::query("DELETE FROM articles WHERE reference = ?")
        .bind(ref_a)
        .execute(&pool)
        .await
        .expect("Failed to delete A");

    sqlx::query(
        "INSERT INTO articles (
            id, categorie_id, fournisseur_id, reference, nom, marque, couleur,
            description, prix_location_centimes, prix_vente_centimes,
            caution_suggeree_centimes, frais_nettoyage_centimes, image_url,
            est_actif, created_at, updated_at
        ) VALUES ('art-ci-b', 'cat-costume', 'fourn-01', ?, 'Article B Modif', 'Prestige', 'Bleu',
            'Donnée B', 30000, 90000, 60000, 2000, '', 1, ?, ?)"
    )
    .bind(ref_b)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Failed to insert article B");

    // Vérifier l'état altéré
    let check_b: Option<(String,)> = sqlx::query_as("SELECT reference FROM articles WHERE reference = ?")
        .bind(ref_b)
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert!(check_b.is_some());

    // 4. Restauration avec l'algorithme atomique de restore_database
    let tmp_path = test_dir.join("restore_temp.tmp");
    {
        let mut src_file = fs::File::open(&backup_path).unwrap();
        let mut tmp_file = fs::File::create(&tmp_path).unwrap();
        std::io::copy(&mut src_file, &mut tmp_file).unwrap();
        tmp_file.flush().unwrap();
        tmp_file.sync_all().unwrap();
    }

    // Vérification intégrité sur le temporaire
    {
        use sqlx::sqlite::SqliteConnectOptions;
        use sqlx::ConnectOptions;
        let tmp_opts = SqliteConnectOptions::new().filename(&tmp_path).read_only(true);
        let mut tmp_conn = tmp_opts.connect().await.unwrap();
        let check: (String,) = sqlx::query_as("PRAGMA integrity_check;").fetch_one(&mut tmp_conn).await.unwrap();
        assert_eq!(check.0.to_lowercase(), "ok");
    }

    // Checkpoint pool & rename atomique
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);").execute(&pool).await;
    pool.close().await; // Fermeture du pool actif

    fs::rename(&tmp_path, &db_path).unwrap();

    // Suppression des anciens journaux WAL
    let _ = fs::remove_file(test_dir.join("costume_rental.db-wal"));
    let _ = fs::remove_file(test_dir.join("costume_rental.db-shm"));

    // 5. Réouverture d'un nouveau pool (comme après le restart de l'app)
    let restored_pool = db::init_db(&test_dir).await.expect("Failed to reconnect after restore");

    // 6. Vérifications formelles
    // a. Donnée A DOIT être revenue
    let row_a: Option<(String,)> = sqlx::query_as("SELECT reference FROM articles WHERE reference = ?")
        .bind(ref_a)
        .fetch_optional(&restored_pool)
        .await
        .unwrap();
    assert!(row_a.is_some(), "Donnée A ('{}') DOIT être restaurée", ref_a);

    // b. Donnée B DOIT avoir disparu
    let row_b: Option<(String,)> = sqlx::query_as("SELECT reference FROM articles WHERE reference = ?")
        .bind(ref_b)
        .fetch_optional(&restored_pool)
        .await
        .unwrap();
    assert!(row_b.is_none(), "Donnée B ('{}') NE DOIT PLUS exister", ref_b);

    restored_pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
