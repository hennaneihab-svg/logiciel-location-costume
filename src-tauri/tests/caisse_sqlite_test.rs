use costume_rental_lib::db;
use costume_rental_lib::models::*;
use costume_rental_lib::commands::*;
use costume_rental_lib::error::AppError;
use std::fs;
use std::sync::Arc;

#[tokio::test]
async fn test_direct_sale_numbering_and_stock_decrement() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_sale_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Stock initial art-018
    let initial_qty: (i64,) = sqlx::query_as("SELECT quantite_disponible FROM articles WHERE id = 'art-018'")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch initial art-018 quantity");
    assert_eq!(initial_qty.0, 15);

    // 2. Vente directe sans variante
    let sale_input_1 = CreateDirectSaleDto {
        customer_id: Some("cli-001".to_string()),
        customer_name: Some("Jean Dupont".to_string()),
        customer_phone: Some("06 12 34 56 78".to_string()),
        user_id: "usr-001".to_string(),
        items: vec![
            DirectSaleCartItemInput {
                id: "item-test-1".to_string(),
                article_id: "art-018".to_string(),
                variant_id: None,
                name: "Nœud Papillon Satin Soie Noir à Nouer".to_string(),
                reference: "ACC-NDP-SOIE".to_string(),
                barcode: None,
                category_name: "Accessoires Prestige".to_string(),
                size: None,
                unit_price_cents: 9500,
                quantity: 2,
                subtotal_cents: 19000,
                photo_url: None,
            },
        ],
        payment: DirectSalePaymentInput {
            method: "carte_bancaire".to_string(),
            amount_paid_cents: 19000,
            cash_received_cents: None,
            change_returned_cents: None,
            transaction_ref: Some("CB-TEST-41".to_string()),
            cheque_number: None,
            bank_name: None,
        },
        notes: Some("Première vente directe de test".to_string()),
    };

    let sale_res_1 = execute_create_direct_sale(&pool, sale_input_1)
        .await
        .expect("Failed to execute create_direct_sale 1");

    assert_eq!(sale_res_1.sale_number, "VTE-2026-0041");
    assert_eq!(sale_res_1.total_amount_cents, 19000);
    assert_eq!(sale_res_1.items.len(), 1);

    // Décrément stock : 15 - 2 = 13
    let after_qty_1: (i64,) = sqlx::query_as("SELECT quantite_disponible FROM articles WHERE id = 'art-018'")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch art-018 quantity after sale");
    assert_eq!(after_qty_1.0, 13);

    // 3. Vente d'une variante var-001
    let initial_var_statut: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-001'")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch var-001 statut");
    assert_eq!(initial_var_statut.0, "disponible");

    let sale_input_2 = CreateDirectSaleDto {
        customer_id: None,
        customer_name: Some("Client Comptoir".to_string()),
        customer_phone: None,
        user_id: "usr-002".to_string(),
        items: vec![
            DirectSaleCartItemInput {
                id: "item-test-2".to_string(),
                article_id: "art-001".to_string(),
                variant_id: Some("var-001".to_string()),
                name: "Smoking Col Châle Soie Noir".to_string(),
                reference: "SMK-NOIR-01".to_string(),
                barcode: Some("BAR-SMK-001-48".to_string()),
                category_name: "Smokings Cérémonie".to_string(),
                size: Some("48".to_string()),
                unit_price_cents: 89000,
                quantity: 1,
                subtotal_cents: 89000,
                photo_url: None,
            },
        ],
        payment: DirectSalePaymentInput {
            method: "especes".to_string(),
            amount_paid_cents: 89000,
            cash_received_cents: Some(100000),
            change_returned_cents: Some(11000),
            transaction_ref: None,
            cheque_number: None,
            bank_name: None,
        },
        notes: None,
    };

    let sale_res_2 = execute_create_direct_sale(&pool, sale_input_2)
        .await
        .expect("Failed to execute create_direct_sale 2");

    assert_eq!(sale_res_2.sale_number, "VTE-2026-0042");
    assert_eq!(sale_res_2.total_amount_cents, 89000);

    let after_var_statut: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-001'")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch var-001 statut after sale");
    assert_eq!(after_var_statut.0, "vendu");

    let all_sales = execute_list_direct_sales(&pool)
        .await
        .expect("Failed to list direct sales");
    assert_eq!(all_sales.len(), 2);
    assert_eq!(all_sales[0].sale_number, "VTE-2026-0042");
    assert_eq!(all_sales[1].sale_number, "VTE-2026-0041");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_cash_session_open_ventilation_and_close() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_session_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let active_none = execute_get_active_cash_session(&pool)
        .await
        .expect("Failed to check active session");
    assert!(active_none.is_none());

    let open_dto = OpenCashSessionDto {
        utilisateur_id: "usr-001".to_string(),
        initial_cash_float_cents: 15000,
        notes: Some("Session matinée".to_string()),
    };
    let session = execute_open_cash_session(&pool, open_dto)
        .await
        .expect("Failed to open cash session");

    assert_eq!(session.status, "ouverte");
    assert_eq!(session.initial_cash_float_cents, 15000);
    assert_eq!(session.theoretical_cash_cents, 15000);

    // Vente espèces 5000 DA
    let sale_esp = CreateDirectSaleDto {
        customer_id: None,
        customer_name: Some("Client Espèces".to_string()),
        customer_phone: None,
        user_id: "usr-001".to_string(),
        items: vec![
            DirectSaleCartItemInput {
                id: "it-esp".to_string(),
                article_id: "art-018".to_string(),
                variant_id: None,
                name: "Article Espèces".to_string(),
                reference: "REF-ESP".to_string(),
                barcode: None,
                category_name: "Accessoires".to_string(),
                size: None,
                unit_price_cents: 5000,
                quantity: 1,
                subtotal_cents: 5000,
                photo_url: None,
            },
        ],
        payment: DirectSalePaymentInput {
            method: "especes".to_string(),
            amount_paid_cents: 5000,
            cash_received_cents: Some(5000),
            change_returned_cents: Some(0),
            transaction_ref: None,
            cheque_number: None,
            bank_name: None,
        },
        notes: None,
    };
    execute_create_direct_sale(&pool, sale_esp).await.expect("Failed sale cash");

    // Vente CB 12000 DA
    let sale_cb = CreateDirectSaleDto {
        customer_id: None,
        customer_name: Some("Client CB".to_string()),
        customer_phone: None,
        user_id: "usr-001".to_string(),
        items: vec![
            DirectSaleCartItemInput {
                id: "it-cb".to_string(),
                article_id: "art-019".to_string(),
                variant_id: None,
                name: "Article CB".to_string(),
                reference: "REF-CB".to_string(),
                barcode: None,
                category_name: "Accessoires".to_string(),
                size: None,
                unit_price_cents: 12000,
                quantity: 1,
                subtotal_cents: 12000,
                photo_url: None,
            },
        ],
        payment: DirectSalePaymentInput {
            method: "carte_bancaire".to_string(),
            amount_paid_cents: 12000,
            cash_received_cents: None,
            change_returned_cents: None,
            transaction_ref: Some("CB-REF-99".to_string()),
            cheque_number: None,
            bank_name: None,
        },
        notes: None,
    };
    execute_create_direct_sale(&pool, sale_cb).await.expect("Failed sale card");

    // Paiement location espèces 3000 DA
    let pay_loc = RecordPaymentDto {
        location_id: Some("loc-001".to_string()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 3000,
        type_paiement: "acompte".to_string(),
        moyen_paiement: "especes".to_string(),
        reference_transaction: None,
        notes: Some("Acompte reçu".to_string()),
    };
    execute_record_payment(&pool, pay_loc).await.expect("Failed rental payment");

    let active_session = execute_get_active_cash_session(&pool)
        .await
        .expect("Failed get session")
        .expect("Must exist");

    assert_eq!(active_session.sales_total_cents, 17000);
    assert_eq!(active_session.rentals_total_cents, 3000);
    assert_eq!(active_session.grand_total_cents, 20000);
    assert_eq!(active_session.breakdown.especes.total_cents, 8000);
    assert_eq!(active_session.breakdown.carte_bancaire.total_cents, 12000);
    assert_eq!(active_session.theoretical_cash_cents, 23000);

    // Clôture avec écart
    let close_dto = CloseCashSessionDto {
        session_id: Some(session.id.clone()),
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 22800,
        operator_notes: Some("Écart de caisse -200 DA".to_string()),
    };
    let closed = execute_close_cash_session(&pool, close_dto).await.expect("Failed close");
    assert_eq!(closed.status, "cloturee");
    assert_eq!(closed.counted_cash_cents, Some(22800));
    assert_eq!(closed.discrepancy_cents, Some(-200));

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_validation_errors_caisse() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_errors_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // Utilisateur invalide
    let bad_user = execute_open_cash_session(&pool, OpenCashSessionDto {
        utilisateur_id: "usr-inexistant".to_string(),
        initial_cash_float_cents: 10000,
        notes: None,
    }).await;
    assert!(matches!(bad_user, Err(AppError::Validation(_))));

    // Double session
    execute_open_cash_session(&pool, OpenCashSessionDto {
        utilisateur_id: "usr-001".to_string(),
        initial_cash_float_cents: 10000,
        notes: None,
    }).await.expect("First session ok");

    let second = execute_open_cash_session(&pool, OpenCashSessionDto {
        utilisateur_id: "usr-002".to_string(),
        initial_cash_float_cents: 5000,
        notes: None,
    }).await;
    assert!(matches!(second, Err(AppError::Validation(_))));

    // Panier vide
    let empty = execute_create_direct_sale(&pool, CreateDirectSaleDto {
        customer_id: None,
        customer_name: None,
        customer_phone: None,
        user_id: "usr-001".to_string(),
        items: vec![],
        payment: DirectSalePaymentInput {
            method: "especes".to_string(),
            amount_paid_cents: 1000,
            cash_received_cents: None,
            change_returned_cents: None,
            transaction_ref: None,
            cheque_number: None,
            bank_name: None,
        },
        notes: None,
    }).await;
    assert!(matches!(empty, Err(AppError::Validation(_))));

    // Clôture
    execute_close_cash_session(&pool, CloseCashSessionDto {
        session_id: None,
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 10000,
        operator_notes: None,
    }).await.expect("Close ok");

    // Clôture sans session
    let close_none = execute_close_cash_session(&pool, CloseCashSessionDto {
        session_id: None,
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 10000,
        operator_notes: None,
    }).await;
    assert!(matches!(close_none, Err(AppError::Validation(_))));

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_concurrent_direct_sale_same_variant() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_concurrency_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = Arc::new(db::init_db(&test_dir).await.expect("Failed to init db"));
    let var_id = "var-conc-sale-01";
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO variantes_stock (id, article_id, code_barre, taille, statut, created_at, updated_at)
         VALUES (?, 'art-001', 'BAR-CONC-01', '50', 'disponible', ?, ?)"
    )
    .bind(var_id)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .expect("Failed to insert variant");

    let p1 = Arc::clone(&pool);
    let p2 = Arc::clone(&pool);
    let v1 = var_id.to_string();
    let v2 = var_id.to_string();

    let task1 = tokio::spawn(async move {
        let dto = CreateDirectSaleDto {
            customer_id: None,
            customer_name: Some("Client 1".to_string()),
            customer_phone: None,
            user_id: "usr-001".to_string(),
            items: vec![
                DirectSaleCartItemInput {
                    id: "it-conc-1".to_string(),
                    article_id: "art-001".to_string(),
                    variant_id: Some(v1),
                    name: "Smoking".to_string(),
                    reference: "SMK".to_string(),
                    barcode: None,
                    category_name: "Smokings".to_string(),
                    size: Some("50".to_string()),
                    unit_price_cents: 89000,
                    quantity: 1,
                    subtotal_cents: 89000,
                    photo_url: None,
                },
            ],
            payment: DirectSalePaymentInput {
                method: "carte_bancaire".to_string(),
                amount_paid_cents: 89000,
                cash_received_cents: None,
                change_returned_cents: None,
                transaction_ref: Some("CB-1".to_string()),
                cheque_number: None,
                bank_name: None,
            },
            notes: None,
        };
        execute_create_direct_sale(&p1, dto).await
    });

    let task2 = tokio::spawn(async move {
        let dto = CreateDirectSaleDto {
            customer_id: None,
            customer_name: Some("Client 2".to_string()),
            customer_phone: None,
            user_id: "usr-002".to_string(),
            items: vec![
                DirectSaleCartItemInput {
                    id: "it-conc-2".to_string(),
                    article_id: "art-001".to_string(),
                    variant_id: Some(v2),
                    name: "Smoking".to_string(),
                    reference: "SMK".to_string(),
                    barcode: None,
                    category_name: "Smokings".to_string(),
                    size: Some("50".to_string()),
                    unit_price_cents: 89000,
                    quantity: 1,
                    subtotal_cents: 89000,
                    photo_url: None,
                },
            ],
            payment: DirectSalePaymentInput {
                method: "especes".to_string(),
                amount_paid_cents: 89000,
                cash_received_cents: Some(89000),
                change_returned_cents: None,
                transaction_ref: None,
                cheque_number: None,
                bank_name: None,
            },
            notes: None,
        };
        execute_create_direct_sale(&p2, dto).await
    });

    let (res1, res2) = tokio::join!(task1, task2);
    let r1 = res1.expect("join 1");
    let r2 = res2.expect("join 2");

    let successes = [r1.is_ok(), r2.is_ok()].iter().filter(|&&x| x).count();
    let failures = [r1.is_err(), r2.is_err()].iter().filter(|&&x| x).count();

    assert_eq!(successes, 1, "Exactement une vente directe concurrente doit réussir");
    assert_eq!(failures, 1, "Exactement une vente directe concurrente doit échouer");

    let err = if r1.is_err() { r1.unwrap_err() } else { r2.unwrap_err() };
    assert!(matches!(err, AppError::Validation(_)), "Le perdant doit recevoir AppError::Validation");

    let var_statut: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = ?")
        .bind(var_id)
        .fetch_one(&*pool)
        .await
        .unwrap();
    assert_eq!(var_statut.0, "vendu");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_annual_numbering_transition_and_independence() {
    let test_dir = std::env::temp_dir().join(format!("test_annual_num_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");
    let mut conn = pool.acquire().await.expect("Acquire conn");

    // 1. Locations : continuité 2026 puis transition 2027
    let (num_loc_2026_1, seq1) = next_rental_number_for_date(&mut conn, "2026-12-31").await.unwrap();
    assert_eq!(num_loc_2026_1, "LOC-2026-0016");
    assert_eq!(seq1, 16);

    let (num_loc_2027_1, seq2) = next_rental_number_for_date(&mut conn, "2027-01-01").await.unwrap();
    assert_eq!(num_loc_2027_1, "LOC-2027-0001", "Au 01/01/2027 le compteur doit repartir à 0001");
    assert_eq!(seq2, 1);

    // Vérifier l'indépendance des compteurs
    let (num_loc_2026_2, seq3) = next_rental_number_for_date(&mut conn, "2026-12-31").await.unwrap();
    assert_eq!(num_loc_2026_2, "LOC-2026-0017");
    assert_eq!(seq3, 17);

    let (num_loc_2027_2, seq4) = next_rental_number_for_date(&mut conn, "2027-01-02").await.unwrap();
    assert_eq!(num_loc_2027_2, "LOC-2027-0002");
    assert_eq!(seq4, 2);

    // 2. Ventes : continuité 2026 puis transition 2027
    let (num_vte_2026_1, v_seq1) = next_sale_number_for_date(&mut conn, "2026-12-31").await.unwrap();
    assert_eq!(num_vte_2026_1, "VTE-2026-0041");
    assert_eq!(v_seq1, 41);

    let (num_vte_2027_1, v_seq2) = next_sale_number_for_date(&mut conn, "2027-01-01").await.unwrap();
    assert_eq!(num_vte_2027_1, "VTE-2027-0001", "Au 01/01/2027 la vente doit repartir à 0001");
    assert_eq!(v_seq2, 1);

    let (num_vte_2026_2, v_seq3) = next_sale_number_for_date(&mut conn, "2026-12-31").await.unwrap();
    assert_eq!(num_vte_2026_2, "VTE-2026-0042");
    assert_eq!(v_seq3, 42);

    let (num_vte_2027_2, v_seq4) = next_sale_number_for_date(&mut conn, "2027-01-02").await.unwrap();
    assert_eq!(num_vte_2027_2, "VTE-2027-0002");
    assert_eq!(v_seq4, 2);

    drop(conn);
    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_concurrent_rental_numbering_sequential() {
    let test_dir = std::env::temp_dir().join(format!("test_concurrent_rental_num_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = Arc::new(db::init_db(&test_dir).await.expect("Failed to init db"));

    // Créer deux variantes distinctes
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO variantes_stock (id, article_id, code_barre, taille, statut, created_at, updated_at)
         VALUES ('var-num-01', 'art-001', 'BAR-NUM-01', '50', 'disponible', ?, ?),
                ('var-num-02', 'art-001', 'BAR-NUM-02', '52', 'disponible', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .bind(&now)
    .bind(&now)
    .execute(&*pool)
    .await
    .unwrap();

    let p1 = Arc::clone(&pool);
    let p2 = Arc::clone(&pool);

    let task1 = tokio::spawn(async move {
        let dto = CreateRentalContractDto {
            customer_id: "cli-001".to_string(),
            utilisateur_id: Some("usr-001".to_string()),
            pickup_date: "2028-06-01".to_string(),
            return_date_scheduled: "2028-06-05".to_string(),
            event_date: None,
            selected_variant_ids: vec!["var-num-01".to_string()],
            quantity_items: None,
            discount_cents: None,
            deposit_method: "especes".to_string(),
            deposit_amount_cents: None,
            paid_amount_cents: None,
            payment_method: "especes".to_string(),
            notes: None,
        };
        execute_create_rental(&p1, dto).await
    });

    let task2 = tokio::spawn(async move {
        let dto = CreateRentalContractDto {
            customer_id: "cli-002".to_string(),
            utilisateur_id: Some("usr-002".to_string()),
            pickup_date: "2028-06-01".to_string(),
            return_date_scheduled: "2028-06-05".to_string(),
            event_date: None,
            selected_variant_ids: vec!["var-num-02".to_string()],
            quantity_items: None,
            discount_cents: None,
            deposit_method: "carte_bancaire".to_string(),
            deposit_amount_cents: None,
            paid_amount_cents: None,
            payment_method: "carte_bancaire".to_string(),
            notes: None,
        };
        execute_create_rental(&p2, dto).await
    });

    let (res1, res2) = tokio::join!(task1, task2);
    let c1 = res1.expect("join 1").expect("contract 1 creation ok");
    let c2 = res2.expect("join 2").expect("contract 2 creation ok");

    assert_ne!(c1.contract_number, c2.contract_number, "Les numéros doivent être distincts");
    let nums = vec![c1.contract_number, c2.contract_number];
    assert!(nums.contains(&"LOC-2026-0016".to_string()));
    assert!(nums.contains(&"LOC-2026-0017".to_string()));

    (*pool).close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_migration_0007_continuity() {
    let test_dir = std::env::temp_dir().join(format!("test_migration_0007_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let version: (i64,) = sqlx::query_as("SELECT MAX(version) FROM _migrations")
        .fetch_one(&pool)
        .await
        .expect("Migration version");
    assert!(version.0 >= 7, "Migration 0007 doit être appliquée");

    // Clés 2026 existantes
    let loc_key: (String,) = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = 'dernier_numero_location_2026'")
        .fetch_one(&pool)
        .await
        .expect("dernier_numero_location_2026");
    assert_eq!(loc_key.0, "15");

    let vte_key: (String,) = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = 'dernier_numero_vente_2026'")
        .fetch_one(&pool)
        .await
        .expect("dernier_numero_vente_2026");
    assert_eq!(vte_key.0, "40");

    // Anciennes clés supprimées
    let old_loc: Option<(String,)> = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = 'dernier_numero_location'")
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert!(old_loc.is_none(), "L'ancienne clé globale 'dernier_numero_location' doit être supprimée");

    let old_vte: Option<(String,)> = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = 'dernier_numero_vente'")
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert!(old_vte.is_none(), "L'ancienne clé globale 'dernier_numero_vente' doit être supprimée");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_contract_payment_lifecycle_and_session() {
    let test_dir = std::env::temp_dir().join(format!("test_payment_lifecycle_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Créer un contrat avec acompte de 5 000 DA sur total de 18 000 DA
    let create_dto = CreateRentalContractDto {
        customer_id: "cli-001".to_string(),
        utilisateur_id: Some("usr-001".to_string()),
        pickup_date: "2026-10-01".to_string(),
        return_date_scheduled: "2026-10-02".to_string(),
        event_date: None,
        selected_variant_ids: vec!["var-001".to_string()],
        quantity_items: None,
        discount_cents: None,
        deposit_method: "especes".to_string(),
        deposit_amount_cents: Some(45000),
        paid_amount_cents: Some(5000),
        payment_method: "especes".to_string(),
        notes: None,
    };
    let contract = execute_create_rental(&pool, create_dto).await.expect("Create rental ok");
    assert_eq!(contract.paid_amount_cents, 5000);
    assert_eq!(contract.remaining_amount_cents, 13000);

    // 2. Ouvrir une session de caisse
    let open_dto = OpenCashSessionDto {
        utilisateur_id: "usr-001".to_string(),
        initial_cash_float_cents: 10000,
        notes: None,
    };
    execute_open_cash_session(&pool, open_dto).await.expect("Open session ok");

    // 3. Paiement partiel 1 du solde : 6 000 DA en espèces
    let pay1_dto = RecordPaymentDto {
        location_id: Some(contract.id.clone()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 6000,
        type_paiement: "solde".to_string(),
        moyen_paiement: "especes".to_string(),
        reference_transaction: None,
        notes: Some("Règlement partiel 1".to_string()),
    };
    execute_record_payment(&pool, pay1_dto).await.expect("Payment 1 ok");

    let c_after_1 = fetch_rental_dto_by_id(&pool, &contract.id).await.unwrap();
    assert_eq!(c_after_1.paid_amount_cents, 11000, "5000 + 6000 = 11000 DA");
    assert_eq!(c_after_1.remaining_amount_cents, 7000);

    // 4. Paiement partiel 2 du solde : 7 000 DA en carte bancaire (solde entièrement réglé)
    let pay2_dto = RecordPaymentDto {
        location_id: Some(contract.id.clone()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 7000,
        type_paiement: "solde".to_string(),
        moyen_paiement: "carte_bancaire".to_string(),
        reference_transaction: Some("CB-SOLDE-44".to_string()),
        notes: Some("Règlement final du solde".to_string()),
    };
    execute_record_payment(&pool, pay2_dto).await.expect("Payment 2 ok");

    let c_after_2 = fetch_rental_dto_by_id(&pool, &contract.id).await.unwrap();
    assert_eq!(c_after_2.paid_amount_cents, 18000);
    assert_eq!(c_after_2.remaining_amount_cents, 0, "Contrat entièrement soldé");

    // 5. Encaissement de la caution : 45 000 DA en espèces
    let pay_caution_dto = RecordPaymentDto {
        location_id: Some(contract.id.clone()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 45000,
        type_paiement: "caution".to_string(),
        moyen_paiement: "especes".to_string(),
        reference_transaction: None,
        notes: Some("Caution espèces".to_string()),
    };
    execute_record_payment(&pool, pay_caution_dto).await.expect("Payment caution ok");

    let c_after_caution = fetch_rental_dto_by_id(&pool, &contract.id).await.unwrap();
    assert_eq!(c_after_caution.deposit_status, "encaissee");

    // 6. Retour avec dégradation de 3 000 DA via register_return
    let return_dto = RegisterReturnDto {
        contract_id: contract.id.clone(),
        items: vec![
            ReturnItemInputDto {
                variant_id: Some("var-001".to_string()),
                article_id: None,
                condition: "endommage".to_string(),
                damage_fee_cents: Some(3000),
                damage_notes: Some("Tache tenace".to_string()),
            },
        ],
    };
    let c_returned = execute_register_return(&pool, return_dto).await.expect("Return ok");
    assert_eq!(c_returned.damage_fee_cents, 3000);
    assert_eq!(c_returned.deposit_status, "conservee_partiellement");

    // Vérifier l'absence de doublon : register_return n'insère PAS de nouveau paiement pour la dégradation
    let payments_for_loc = execute_list_payments(&pool, Some(contract.id.clone()), None).await.unwrap();
    let damage_payments_count = payments_for_loc.iter().filter(|p| p.type_paiement == "degradation").count();
    assert_eq!(damage_payments_count, 0, "Pas de doublon de paiement créé lors de register_return");

    // 7. Remboursement d'un trop-perçu de 2 000 DA en espèces
    let refund_dto = RecordPaymentDto {
        location_id: Some(contract.id.clone()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 2000,
        type_paiement: "remboursement".to_string(),
        moyen_paiement: "especes".to_string(),
        reference_transaction: None,
        notes: Some("Remboursement suite geste commercial".to_string()),
    };
    let refund_pay = execute_record_payment(&pool, refund_dto).await.expect("Refund ok");
    assert_eq!(refund_pay.montant_centimes, -2000, "Le remboursement est enregistré avec montant négatif");

    let c_after_refund = fetch_rental_dto_by_id(&pool, &contract.id).await.unwrap();
    assert_eq!(c_after_refund.paid_amount_cents, 16000, "18000 - 2000 = 16000 DA");

    // 8. Vérification des totaux de la session de caisse
    let session_active = execute_get_active_cash_session(&pool).await.unwrap().unwrap();
    // Ventes = 0
    assert_eq!(session_active.sales_total_cents, 0);
    // Locations = 6000 (pay1) + 7000 (pay2) - 2000 (remboursement) = 11 000 DA
    assert_eq!(session_active.rentals_total_cents, 11000);
    // Cautions = 45 000 DA
    assert_eq!(session_active.deposits_total_cents, 45000);
    // Espèces = 6000 (pay1) + 45000 (caution) - 2000 (remboursement) = 49 000 DA
    assert_eq!(session_active.breakdown.especes.total_cents, 49000);
    // Carte = 7000 DA
    assert_eq!(session_active.breakdown.carte_bancaire.total_cents, 7000);

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_migration_0009_sessions_caisse_totals_rename() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_mig0009_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let db_path = test_dir.join("costume_rental.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
    use std::str::FromStr;

    let opts = SqliteConnectOptions::from_str(&db_url)
        .expect("Valid db url")
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .expect("Failed to connect");

    // Exécuter manuellement les migrations 0001 à 0008 (état antérieur à 0009)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            nom TEXT NOT NULL,
            appliquee_le TEXT NOT NULL
        );"
    )
    .execute(&pool)
    .await
    .unwrap();

    let now = chrono::Utc::now().to_rfc3339();

    for stmt in db::MIGRATION_0001.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (1, '0001_initial_schema', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0002.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (2, '0002_seed_demo_data', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0005.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (5, '0005_rental_caisse_sqlite_tables', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0006.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (6, '0006_fix_lignes_location_fk_restrict', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0007.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (7, '0007_annual_numbering_counters', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0008.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (8, '0008_pressing', ?)").bind(&now).execute(&pool).await.unwrap();

    // Insérer une session avec les anciens noms de colonnes (total_locations_centimes, total_cautions_centimes, total_ventes_centimes)
    sqlx::query(
        "INSERT INTO sessions_caisse (
            id, numero_session, utilisateur_id, date_session, statut,
            fonds_initial_centimes, total_especes_theorique_centimes,
            total_ventes_centimes, total_locations_centimes, total_cautions_centimes,
            total_especes_centimes, total_carte_centimes, total_cheque_centimes, total_virement_centimes,
            opened_at
        ) VALUES ('ses-legacy-1', 'Z-20260922-99', 'usr-001', '2026-09-22', 'cloturee', 10000, 35000, 25000, 15000, 40000, 25000, 15000, 0, 0, ?)"
    )
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert legacy session ok");

    // Appliquer la migration 0009
    for stmt in db::MIGRATION_0009.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (9, '0009_rename_sessions_caisse_totals_centimes', ?)").bind(&now).execute(&pool).await.unwrap();

    // Vérifier que la migration 9 est bien inscrite
    let row9: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 9")
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert!(row9.is_some(), "Migration 0009 enregistrée");

    // Vérifier que les colonnes ont bien été renommées dans PRAGMA table_info
    let cols: Vec<(String,)> = sqlx::query_as("SELECT name FROM pragma_table_info('sessions_caisse')")
        .fetch_all(&pool)
        .await
        .unwrap();
    let col_names: Vec<String> = cols.into_iter().map(|c| c.0).collect();

    assert!(col_names.contains(&"rentals_total_centimes".to_string()), "Colonne rentals_total_centimes présente");
    assert!(col_names.contains(&"deposits_total_centimes".to_string()), "Colonne deposits_total_centimes présente");
    assert!(col_names.contains(&"sales_total_centimes".to_string()), "Colonne sales_total_centimes présente");

    // Vérifier l'absence de perte de données : les valeurs de la session legacy sont intactes
    use sqlx::Row;
    let row = sqlx::query("SELECT sales_total_centimes, rentals_total_centimes, deposits_total_centimes FROM sessions_caisse WHERE id = 'ses-legacy-1'")
        .fetch_one(&pool)
        .await
        .expect("Row fetch ok");

    let s_cents: i64 = row.get("sales_total_centimes");
    let r_cents: i64 = row.get("rentals_total_centimes");
    let d_cents: i64 = row.get("deposits_total_centimes");

    assert_eq!(s_cents, 25000, "Ventes préservées à 25 000 DA");
    assert_eq!(r_cents, 15000, "Locations préservées à 15 000 DA");
    assert_eq!(d_cents, 40000, "Cautions préservées à 40 000 DA");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_migration_0010_restore_french_column_names() {
    let test_dir = std::env::temp_dir().join(format!("test_mig_0010_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let db_path = test_dir.join("costume_rental.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
    use std::str::FromStr;

    let opts = SqliteConnectOptions::from_str(&db_url)
        .expect("Valid db url")
        .journal_mode(SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .expect("Failed to connect");

    // 1. Initialiser une base à l'état post-0009
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            nom TEXT NOT NULL,
            appliquee_le TEXT NOT NULL
        );"
    )
    .execute(&pool)
    .await
    .unwrap();

    let now = chrono::Utc::now().to_rfc3339();

    for stmt in db::MIGRATION_0001.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (1, '0001_initial_schema', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0002.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (2, '0002_seed_demo_data', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0005.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (5, '0005_rental_caisse_sqlite_tables', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0006.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (6, '0006_fix_lignes_location_fk_restrict', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0007.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (7, '0007_annual_numbering_counters', ?)").bind(&now).execute(&pool).await.unwrap();

    for stmt in db::MIGRATION_0008.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (8, '0008_pressing', ?)").bind(&now).execute(&pool).await.unwrap();

    // Appliquer 0009
    for stmt in db::MIGRATION_0009.split(';') {
        let s = stmt.trim();
        if !s.is_empty() {
            sqlx::query(s).execute(&pool).await.unwrap();
        }
    }
    sqlx::query("INSERT INTO _migrations VALUES (9, '0009_rename_sessions_caisse_totals_centimes', ?)").bind(&now).execute(&pool).await.unwrap();

    // Insérer une session avec le schéma post-0009 (rentals_total_centimes, deposits_total_centimes, sales_total_centimes)
    sqlx::query(
        "INSERT INTO sessions_caisse (
            id, numero_session, utilisateur_id, date_session, statut,
            fonds_initial_centimes, total_especes_theorique_centimes,
            sales_total_centimes, rentals_total_centimes, deposits_total_centimes,
            total_especes_centimes, total_carte_centimes, total_cheque_centimes, total_virement_centimes,
            opened_at
        ) VALUES ('ses-legacy-10', 'Z-20260923-01', 'usr-001', '2026-09-23', 'cloturee', 10000, 35000, 25000, 15000, 40000, 25000, 15000, 0, 0, ?)"
    )
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert post-0009 session ok");

    // 2. Exécuter le système de migrations global (qui doit appliquer la migration 0010)
    db::run_migrations(&pool).await.expect("Run migrations applying 0010 ok");

    // 3. Vérifier que la version 10 est bien enregistrée
    let row10: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 10")
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert!(row10.is_some(), "Migration 0010 bien enregistrée");

    // 4. Vérifier les colonnes restaurées dans sessions_caisse
    let cols: Vec<(String,)> = sqlx::query_as("SELECT name FROM pragma_table_info('sessions_caisse')")
        .fetch_all(&pool)
        .await
        .unwrap();
    let col_names: Vec<String> = cols.into_iter().map(|c| c.0).collect();

    assert!(col_names.contains(&"total_locations_centimes".to_string()), "Colonne total_locations_centimes restaurée");
    assert!(col_names.contains(&"total_cautions_centimes".to_string()), "Colonne total_cautions_centimes restaurée");
    assert!(col_names.contains(&"total_ventes_centimes".to_string()), "Colonne total_ventes_centimes restaurée");

    assert!(!col_names.contains(&"rentals_total_centimes".to_string()), "rentals_total_centimes supprimée");
    assert!(!col_names.contains(&"deposits_total_centimes".to_string()), "deposits_total_centimes supprimée");
    assert!(!col_names.contains(&"sales_total_centimes".to_string()), "sales_total_centimes supprimée");

    // 5. Vérifier qu'aucune donnée n'a été perdue
    use sqlx::Row;
    let row = sqlx::query("SELECT total_ventes_centimes, total_locations_centimes, total_cautions_centimes FROM sessions_caisse WHERE id = 'ses-legacy-10'")
        .fetch_one(&pool)
        .await
        .expect("Row fetch ok");

    let s_cents: i64 = row.get("total_ventes_centimes");
    let r_cents: i64 = row.get("total_locations_centimes");
    let d_cents: i64 = row.get("total_cautions_centimes");

    assert_eq!(s_cents, 25000, "total_ventes_centimes préservé à 25 000 DA");
    assert_eq!(r_cents, 15000, "total_locations_centimes préservé à 15 000 DA");
    assert_eq!(d_cents, 40000, "total_cautions_centimes préservé à 40 000 DA");

    // 6. Vérifier l'intégrité des clés étrangères
    let fk_violations: Vec<(String, Option<i64>, String, i64)> =
        sqlx::query_as("PRAGMA foreign_key_check;")
            .fetch_all(&pool)
            .await
            .unwrap();
    assert!(fk_violations.is_empty(), "Aucune violation FK après migration 0010");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_unassigned_payment_reconciliation_at_close_session() {
    let test_dir = std::env::temp_dir().join(format!("test_reconciliation_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Init db ok");

    // S'assurer qu'aucune session n'est ouverte
    let active = execute_get_active_cash_session(&pool).await.unwrap();
    assert!(active.is_none(), "Aucune session ouverte au départ");

    // 1. Créer une location
    let today = today_local();
    let contract_dto = CreateRentalContractDto {
        customer_id: "cli-001".to_string(),
        utilisateur_id: Some("usr-001".to_string()),
        pickup_date: format!("{}-01-01", &today[0..4]),
        return_date_scheduled: format!("{}-01-05", &today[0..4]),
        event_date: None,
        selected_variant_ids: vec!["var-001".to_string()],
        quantity_items: None,
        discount_cents: Some(0),
        deposit_method: "especes".to_string(),
        deposit_amount_cents: Some(20000),
        paid_amount_cents: Some(0),
        payment_method: "especes".to_string(),
        notes: Some("Contrat pour test réconciliation".to_string()),
    };
    let contract = execute_create_rental(&pool, contract_dto).await.expect("Create rental ok");

    // 2. Enregistrer un paiement SANS SESSION OUVERTE (ex: 5 000 DA en espèces pour solde)
    let pay_without_session = RecordPaymentDto {
        location_id: Some(contract.id.clone()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 5000,
        type_paiement: "solde".to_string(),
        moyen_paiement: "especes".to_string(),
        reference_transaction: None,
        notes: Some("Paiement effectué hors session".to_string()),
    };
    execute_record_payment(&pool, pay_without_session).await.expect("Payment hors session ok");

    // 3. Ouvrir une session de caisse avec fonds de 10 000 DA
    let open_dto = OpenCashSessionDto {
        utilisateur_id: "usr-001".to_string(),
        initial_cash_float_cents: 10000,
        notes: Some("Session de caisse journée".to_string()),
    };
    let session_opened = execute_open_cash_session(&pool, open_dto).await.expect("Open session ok");
    assert_eq!(session_opened.initial_cash_float_cents, 10000);
    assert_eq!(session_opened.cloture_number, format!("Z-{}-01", today.replace('-', "")));

    // 4. Enregistrer un second paiement PENDANT la session (7 000 DA par carte)
    let pay_during_session = RecordPaymentDto {
        location_id: Some(contract.id.clone()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 7000,
        type_paiement: "solde".to_string(),
        moyen_paiement: "carte_bancaire".to_string(),
        reference_transaction: Some("CB-REC-01".to_string()),
        notes: Some("Paiement pendant session".to_string()),
    };
    execute_record_payment(&pool, pay_during_session).await.expect("Payment pendant session ok");

    // 5. Enregistrer un encaissement de caution (20 000 DA en espèces)
    let pay_caution = RecordPaymentDto {
        location_id: Some(contract.id.clone()),
        vente_id: None,
        utilisateur_id: "usr-001".to_string(),
        montant_centimes: 20000,
        type_paiement: "caution".to_string(),
        moyen_paiement: "especes".to_string(),
        reference_transaction: None,
        notes: Some("Caution espèces".to_string()),
    };
    execute_record_payment(&pool, pay_caution).await.expect("Caution ok");

    // 6. Clôturer la session de caisse
    // Espèces attendues réconciliées : 10 000 (fonds) + 5 000 (pay1 hors session) + 20 000 (caution) = 35 000 DA
    let close_dto = CloseCashSessionDto {
        session_id: Some(session_opened.id.clone()),
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 35000,
        operator_notes: Some("Clôture avec réconciliation confirmée".to_string()),
    };
    let closed_session = execute_close_cash_session(&pool, close_dto).await.expect("Close session ok");

    assert_eq!(closed_session.status, "cloturee");
    assert_eq!(closed_session.initial_cash_float_cents, 10000);
    assert_eq!(closed_session.rentals_total_cents, 12000, "5000 hors session + 7000 pendant session");
    assert_eq!(closed_session.deposits_total_cents, 20000);
    assert_eq!(closed_session.sales_total_cents, 0);
    assert_eq!(closed_session.theoretical_cash_cents, 35000);
    assert_eq!(closed_session.counted_cash_cents, Some(35000));
    assert_eq!(closed_session.discrepancy_cents, Some(0));
    assert_eq!(closed_session.breakdown.especes.total_cents, 25000, "5000 rental + 20000 caution");
    assert_eq!(closed_session.breakdown.carte_bancaire.total_cents, 7000);

    // 7. Ouvrir une DEUXIÈME session le même jour : numéro incrémenté et pas de ré-incorporation des paiements clôturés
    let open_dto_2 = OpenCashSessionDto {
        utilisateur_id: "usr-001".to_string(),
        initial_cash_float_cents: 8000,
        notes: Some("Deuxième session de caisse".to_string()),
    };
    let session_2 = execute_open_cash_session(&pool, open_dto_2).await.expect("Open session 2 ok");
    assert_eq!(session_2.cloture_number, format!("Z-{}-02", today.replace('-', "")));
    assert_eq!(session_2.initial_cash_float_cents, 8000);

    let close_dto_2 = CloseCashSessionDto {
        session_id: Some(session_2.id.clone()),
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 8000,
        operator_notes: Some("Clôture session 2 sans vente".to_string()),
    };
    let closed_session_2 = execute_close_cash_session(&pool, close_dto_2).await.expect("Close session 2 ok");
    assert_eq!(closed_session_2.rentals_total_cents, 0, "Paiements antérieurs déjà clôturés non repris dans session 2");
    assert_eq!(closed_session_2.theoretical_cash_cents, 8000);
    assert_eq!(closed_session_2.discrepancy_cents, Some(0));

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_migration_0012_performance_indexes() {
    let test_dir = std::env::temp_dir().join(format!("test_migration_0012_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("DB init ok");

    // 1. Vérifier que la migration 0012 est bien enregistrée
    let row12: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 12")
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert!(row12.is_some(), "Migration 0012 bien enregistrée dans _migrations");

    // 2. Vérifier que les index créés par 0012 existent bien dans sqlite_master
    let indexes: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (
            'idx_paiements_date',
            'idx_locations_statut_retour',
            'idx_locations_date_retrait',
            'idx_ventes_date',
            'idx_ventes_client',
            'idx_ventes_statut',
            'idx_lignes_vente_vente',
            'idx_lignes_vente_article',
            'idx_lignes_vente_variante',
            'idx_mouvements_date',
            'idx_mouvements_type',
            'idx_sessions_caisse_statut_date'
        )"
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    let index_names: Vec<String> = indexes.into_iter().map(|i| i.0).collect();

    assert!(index_names.contains(&"idx_paiements_date".to_string()), "Index idx_paiements_date présent");
    assert!(index_names.contains(&"idx_locations_statut_retour".to_string()), "Index idx_locations_statut_retour présent");
    assert!(index_names.contains(&"idx_locations_date_retrait".to_string()), "Index idx_locations_date_retrait présent");
    assert!(index_names.contains(&"idx_ventes_date".to_string()), "Index idx_ventes_date présent");
    assert!(index_names.contains(&"idx_ventes_client".to_string()), "Index idx_ventes_client présent");
    assert!(index_names.contains(&"idx_lignes_vente_vente".to_string()), "Index idx_lignes_vente_vente présent");
    assert!(index_names.contains(&"idx_mouvements_date".to_string()), "Index idx_mouvements_date présent");
    assert!(index_names.contains(&"idx_sessions_caisse_statut_date".to_string()), "Index idx_sessions_caisse_statut_date présent");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

