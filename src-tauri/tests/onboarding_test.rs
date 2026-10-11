use costume_rental_lib::db;
use costume_rental_lib::commands::*;
use costume_rental_lib::models::*;
use std::fs;

#[tokio::test]
async fn test_virgin_db_has_zero_users_and_zero_demo_data() {
    std::env::set_var("TEST_VIRGIN_DB", "1");
    let test_dir = std::env::temp_dir().join(format!("test_virgin_db_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    // 1. Initialiser une base vierge (sans seed de démo)
    let pool = db::init_db(&test_dir).await.expect("Failed to init virgin db");

    // 2. Vérifier que la table utilisateurs est rigoureusement vide (0 compte admin pré-créé)
    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM utilisateurs")
        .fetch_one(&pool)
        .await
        .expect("Query count utilisateurs failed");
    assert_eq!(user_count.0, 0, "Une base vierge NE DOIT contenir aucun utilisateur.");

    // 3. Vérifier que les articles, clients et contrats sont totalement absents
    let article_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM articles")
        .fetch_one(&pool)
        .await
        .expect("Query count articles failed");
    assert_eq!(article_count.0, 0, "Une base vierge NE DOIT contenir aucun article de démo.");

    let client_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM clients")
        .fetch_one(&pool)
        .await
        .expect("Query count clients failed");
    assert_eq!(client_count.0, 0, "Une base vierge NE DOIT contenir aucun client de démo.");

    let rental_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM locations")
        .fetch_one(&pool)
        .await
        .expect("Query count locations failed");
    assert_eq!(rental_count.0, 0, "Une base vierge NE DOIT contenir aucune location de démo.");

    // 4. Vérifier que check_setup_required retourne true
    let setup_required = execute_check_setup_required(&pool)
        .await
        .expect("check_setup_required failed");
    assert!(setup_required, "L'assistant de premier lancement DOIT être requis sur une base vierge.");

    // 5. Exécuter la configuration initiale (création compte admin + boutique avec type d'activité)
    let setup_dto = InitialSetupInput {
        admin_username: "mon_admin".to_string(),
        admin_full_name: "Directeur Général".to_string(),
        admin_password_hash: "$2a$10$dummyhashforbcrypttestingpurposesonly".to_string(),
        boutique_name: "Boutique Royale Cérémonie".to_string(),
        boutique_address: "45 Rue Didouche Mourad, Alger".to_string(),
        boutique_phone: "0555 12 34 56".to_string(),
        activity_type: "mixte".to_string(),
    };

    execute_complete_initial_setup(&pool, setup_dto)
        .await
        .expect("complete_initial_setup failed");

    // 6. Vérifier que l'utilisateur admin a bien été créé
    let users = execute_list_auth_users(&pool)
        .await
        .expect("list_auth_users failed");
    assert_eq!(users.len(), 1, "Il doit maintenant y avoir exactement 1 utilisateur.");
    assert_eq!(users[0].username, "mon_admin");
    assert_eq!(users[0].role, "admin");
    assert!(users[0].is_active);

    // 7. Vérifier que la table parametres contient bien la boutique avec activity_type = 'mixte'
    let boutique_row: Option<(String,)> = sqlx::query_as("SELECT valeur FROM parametres WHERE cle = 'boutique'")
        .fetch_optional(&pool)
        .await
        .expect("Query parametres boutique failed");
    assert!(boutique_row.is_some(), "La clé 'boutique' doit exister dans parametres");
    let boutique_json: serde_json::Value = serde_json::from_str(&boutique_row.unwrap().0)
        .expect("Boutique JSON parsing failed");
    assert_eq!(boutique_json["name"], "Boutique Royale Cérémonie");
    assert_eq!(boutique_json["activity_type"], "mixte");

    let cat_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories")
        .fetch_one(&pool)
        .await
        .expect("Query categories failed");
    assert!(cat_count.0 >= 5, "Les catégories adaptées au type d'activité doivent être créées.");

    // 8. Vérifier que check_setup_required retourne maintenant FALSE (l'assistant ne réapparaît plus)
    let setup_required_after = execute_check_setup_required(&pool)
        .await
        .expect("check_setup_required after setup failed");
    assert!(!setup_required_after, "L'assistant de premier lancement NE DOIT PLUS être requis une fois le compte créé.");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_seed_demo_data_on_demand() {
    std::env::set_var("TEST_VIRGIN_DB", "1");
    let test_dir = std::env::temp_dir().join(format!("test_seed_on_demand_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init virgin db");

    // Vérifier 0 articles avant seed
    let count_before: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM articles")
        .fetch_one(&pool)
        .await
        .expect("Count before seed failed");
    assert_eq!(count_before.0, 0);

    // Déclencher le seed à la demande
    db::seed_demo_data(&pool).await.expect("seed_demo_data on demand failed");

    // Vérifier que les 20 articles de démo et les utilisateurs sont bien injectés
    let count_after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM articles")
        .fetch_one(&pool)
        .await
        .expect("Count after seed failed");
    assert_eq!(count_after.0, 20, "Le seed de démo à la demande doit insérer 20 articles.");

    let user_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM utilisateurs")
        .fetch_one(&pool)
        .await
        .expect("User count after seed failed");
    assert!(user_count.0 >= 2, "Le seed de démo doit insérer les utilisateurs de démo (admin + vendeur).");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
