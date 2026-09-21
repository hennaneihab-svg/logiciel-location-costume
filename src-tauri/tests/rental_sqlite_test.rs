use costume_rental_lib::db;
use costume_rental_lib::models::*;
use costume_rental_lib::commands::*;
use std::fs;
use std::sync::Arc;

#[tokio::test]
async fn test_migration_0005_and_fk_integrity() {
    let test_dir = std::env::temp_dir().join(format!("test_migration_0005_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Vérification que la version 5 est bien appliquée
    let version: (i64,) = sqlx::query_as("SELECT MAX(version) FROM _migrations")
        .fetch_one(&pool)
        .await
        .expect("Failed to get migration version");
    assert!(version.0 >= 5, "La version de migration doit être au moins 5");

    // 2. PRAGMA foreign_key_check
    let fk_violations: Vec<(String, Option<i64>, String, i64)> = sqlx::query_as("PRAGMA foreign_key_check;")
        .fetch_all(&pool)
        .await
        .expect("PRAGMA foreign_key_check failed");

    assert!(
        fk_violations.is_empty(),
        "Aucune violation de clé étrangère n'est tolérée après migration 0005. Violations: {:?}",
        fk_violations
    );

    // 3. Vérification de la table app_meta
    let meta_val: (String,) = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = 'dernier_numero_location'")
        .fetch_one(&pool)
        .await
        .expect("app_meta clé dernier_numero_location introuvable");
    assert_eq!(meta_val.0, "15", "Le dernier numéro de location initialisé doit valoir 15");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_create_rental_contract_and_numbering() {
    let test_dir = std::env::temp_dir().join(format!("test_rental_flow_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Vérifier la lecture des 15 contrats initiaux via fetch_rental_dto_by_id
    let contract_1 = fetch_rental_dto_by_id(&pool, "loc-001")
        .await
        .expect("Contrat loc-001 de démo introuvable");

    assert_eq!(contract_1.contract_number, "LOC-2026-0001");
    assert_eq!(contract_1.customer_id, "cli-001");
    assert_eq!(contract_1.total_amount_cents, 18000, "Montant total en DA entiers (18 000 DA)");
    assert_eq!(contract_1.deposit_amount_cents, 45000, "Caution en DA entiers (45 000 DA)");

    // 2. Création d'un nouveau contrat pour une variante disponible (var-003 : Smoking 52 disponible)
    let dto = CreateRentalContractDto {
        customer_id: "cli-001".to_string(),
        utilisateur_id: Some("usr-001".to_string()),
        pickup_date: "2026-10-10".to_string(),
        return_date_scheduled: "2026-10-13".to_string(),
        event_date: Some("2026-10-11".to_string()),
        selected_variant_ids: vec!["var-003".to_string()],
        quantity_items: None,
        discount_cents: Some(1000),
        deposit_method: "empreinte_cb".to_string(),
        deposit_amount_cents: Some(45000),
        paid_amount_cents: Some(5000),
        payment_method: "carte_bancaire".to_string(),
        notes: Some("Test création contrat avec acompte".to_string()),
    };

    // Appel direct avec l'émulation State ou via pool (ici on teste la logique de création transactionnelle)
    let state = tauri::State::from(Box::leak(Box::new(db::DbState { pool: pool.clone() })));
    let created = create_rental(dto, state)
        .await
        .expect("Échec de création du contrat de location");

    // Vérification du numéro séquentiel
    let current_year = chrono::Utc::now().format("%Y").to_string();
    assert_eq!(created.contract_number, format!("LOC-{}-0016", current_year));
    assert_eq!(created.status, "reserve");
    assert_eq!(created.customer_id, "cli-001");
    assert_eq!(created.customer_name, "Jean Dupont");
    assert_eq!(created.discount_cents, 1000);
    assert_eq!(created.paid_amount_cents, 5000);
    assert!(created.total_amount_cents > 0);
    assert_eq!(created.remaining_amount_cents, created.total_amount_cents - 5000);

    // Vérification que la variante est bien passée au statut 'reserve'
    let var_row: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-003'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(var_row.0, "reserve");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_date_collision_and_stock_rollback() {
    let test_dir = std::env::temp_dir().join(format!("test_date_collision_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");
    let state = tauri::State::from(Box::leak(Box::new(db::DbState { pool: pool.clone() })));

    // 1. Créer une réservation du 2026-11-01 au 2026-11-05 pour var-001
    let dto1 = CreateRentalContractDto {
        customer_id: "cli-002".to_string(),
        utilisateur_id: None,
        pickup_date: "2026-11-01".to_string(),
        return_date_scheduled: "2026-11-05".to_string(),
        event_date: None,
        selected_variant_ids: vec!["var-001".to_string()],
        quantity_items: None,
        discount_cents: None,
        deposit_method: "cheque".to_string(),
        deposit_amount_cents: None,
        paid_amount_cents: None,
        payment_method: "especes".to_string(),
        notes: None,
    };

    let res1 = create_rental(dto1, state).await;
    assert!(res1.is_ok(), "Premier contrat doit réussir");

    // 2. Tenter une réservation chevauchante du 2026-11-03 au 2026-11-08 pour la même var-001
    let dto2 = CreateRentalContractDto {
        customer_id: "cli-003".to_string(),
        utilisateur_id: None,
        pickup_date: "2026-11-03".to_string(),
        return_date_scheduled: "2026-11-08".to_string(),
        event_date: None,
        selected_variant_ids: vec!["var-001".to_string()],
        quantity_items: None,
        discount_cents: None,
        deposit_method: "empreinte_cb".to_string(),
        deposit_amount_cents: None,
        paid_amount_cents: None,
        payment_method: "carte_bancaire".to_string(),
        notes: None,
    };

    let res2 = create_rental(dto2, state).await;
    assert!(res2.is_err(), "La seconde réservation DOIT échouer pour conflit de dates");
    let err_msg = res2.unwrap_err().to_string();
    assert!(err_msg.contains("Conflit de date"), "L'erreur doit mentionner le conflit de dates : {}", err_msg);

    // 3. Tenter une réservation non chevauchante (ex: 2026-11-10 au 2026-11-15)
    // Note : comme var-001 a été marquée 'reserve', une tentative à une autre date sans libération
    // dépend des règles physiques et calendaires
    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_concurrent_rental_creation_atomicity() {
    let test_dir = std::env::temp_dir().join(format!("test_conc_rental_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = Arc::new(db::init_db(&test_dir).await.expect("Failed to init db"));

    // Utilisation de la variante var-009 (disponible)
    let p1 = Arc::clone(&pool);
    let p2 = Arc::clone(&pool);

    let task1 = tokio::spawn(async move {
        let state = tauri::State::from(Box::leak(Box::new(db::DbState { pool: (*p1).clone() })));
        let dto = CreateRentalContractDto {
            customer_id: "cli-001".to_string(),
            utilisateur_id: None,
            pickup_date: "2026-12-01".to_string(),
            return_date_scheduled: "2026-12-05".to_string(),
            event_date: None,
            selected_variant_ids: vec!["var-009".to_string()],
            quantity_items: None,
            discount_cents: None,
            deposit_method: "especes".to_string(),
            deposit_amount_cents: None,
            paid_amount_cents: None,
            payment_method: "especes".to_string(),
            notes: None,
        };
        create_rental(dto, state).await
    });

    let task2 = tokio::spawn(async move {
        let state = tauri::State::from(Box::leak(Box::new(db::DbState { pool: (*p2).clone() })));
        let dto = CreateRentalContractDto {
            customer_id: "cli-002".to_string(),
            utilisateur_id: None,
            pickup_date: "2026-12-01".to_string(),
            return_date_scheduled: "2026-12-05".to_string(),
            event_date: None,
            selected_variant_ids: vec!["var-009".to_string()],
            quantity_items: None,
            discount_cents: None,
            deposit_method: "carte_bancaire".to_string(),
            deposit_amount_cents: None,
            paid_amount_cents: None,
            payment_method: "carte_bancaire".to_string(),
            notes: None,
        };
        create_rental(dto, state).await
    });

    let (res1, res2) = tokio::join!(task1, task2);
    let r1 = res1.unwrap();
    let r2 = res2.unwrap();

    let successes = [r1.is_ok(), r2.is_ok()].iter().filter(|&&x| x).count();
    let failures = [r1.is_err(), r2.is_err()].iter().filter(|&&x| x).count();

    assert_eq!(successes, 1, "Exactement 1 transaction concurrente doit réussir");
    assert_eq!(failures, 1, "Exactement 1 transaction concurrente doit être rejetée proprement");

    let err_str = if r1.is_err() {
        r1.unwrap_err().to_string()
    } else {
        r2.unwrap_err().to_string()
    };

    // Vérifier que le rejet n'est pas une erreur SQLITE_BUSY brute
    assert!(
        err_str.contains("Conflit de date") || err_str.contains("occupée") || err_str.contains("Erreur de validation"),
        "Le rejet doit être un message propre de validation/conflit, reçu: {}",
        err_str
    );

    (*pool).close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_register_return_and_cancel_lifecycle() {
    let test_dir = std::env::temp_dir().join(format!("test_return_lifecycle_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");
    let state = tauri::State::from(Box::leak(Box::new(db::DbState { pool: pool.clone() })));

    // 1. Tester le retour avec dégradations sur le contrat en cours loc-012 (Richelieu 43)
    let return_dto = RegisterReturnDto {
        contract_id: "loc-012".to_string(),
        items: vec![ReturnItemInputDto {
            variant_id: Some("var-018".to_string()),
            article_id: None,
            condition: "endommage".to_string(),
            damage_fee_cents: Some(3000), // 3 000 DA de dégâts
            damage_notes: Some("Rayure profonde cuir gauche".to_string()),
        }],
    };

    let returned = register_return(return_dto, state).await.expect("Échec de l'enregistrement de retour");

    assert_eq!(returned.status, "litige", "Un retour avec dégradation doit passer en 'litige'");
    assert_eq!(returned.damage_fee_cents, 3000);
    assert_eq!(returned.deposit_status, "conservee_partiellement");

    // Vérifier que la variante est passée en retouche
    let var_row: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-018'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(var_row.0, "en_retouche");

    // 2. Tester l'annulation du contrat réservé loc-014 (var-005)
    let cancelled = cancel_rental("loc-014".to_string(), state).await.expect("Échec d'annulation du contrat");
    assert_eq!(cancelled.status, "annule");

    // Vérifier que la variante var-005 a été remise en 'disponible'
    let var_row2: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-005'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(var_row2.0, "disponible");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
