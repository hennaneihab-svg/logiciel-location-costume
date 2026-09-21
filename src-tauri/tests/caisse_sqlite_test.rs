use costume_rental_lib::db;
use costume_rental_lib::models::*;
use costume_rental_lib::commands::*;
use costume_rental_lib::error::AppError;
use std::fs;

#[tokio::test]
async fn test_direct_sale_numbering_and_stock_decrement() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_sale_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Vérifier le stock initial de l'article en quantité art-018 (15 unités)
    let initial_qty: (i64,) = sqlx::query_as("SELECT quantite_disponible FROM articles WHERE id = 'art-018'")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch initial art-018 quantity");
    assert_eq!(initial_qty.0, 15);

    // 2. Créer une vente directe sans variante (mode quantité)
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

    // Vérifier la numérotation séquentielle VTE-2026-0041
    assert_eq!(sale_res_1.sale_number, "VTE-2026-0041");
    assert_eq!(sale_res_1.total_amount_cents, 19000);
    assert_eq!(sale_res_1.items.len(), 1);

    // Vérifier le décrément du stock : 15 - 2 = 13
    let after_qty_1: (i64,) = sqlx::query_as("SELECT quantite_disponible FROM articles WHERE id = 'art-018'")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch art-018 quantity after sale");
    assert_eq!(after_qty_1.0, 13);

    // 3. Vente d'une pièce physique (variante var-001)
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

    // Deuxième vente séquentielle : VTE-2026-0042
    assert_eq!(sale_res_2.sale_number, "VTE-2026-0042");
    assert_eq!(sale_res_2.total_amount_cents, 89000);

    // Vérifier que la variante est bien marquée 'vendu'
    let after_var_statut: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-001'")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch var-001 statut after sale");
    assert_eq!(after_var_statut.0, "vendu");

    // 4. Vérifier la liste des ventes directes
    let all_sales = execute_list_direct_sales(&pool)
        .await
        .expect("Failed to list direct sales");
    assert_eq!(all_sales.len(), 2);
    assert_eq!(all_sales[0].sale_number, "VTE-2026-0042"); // tri décroissant
    assert_eq!(all_sales[1].sale_number, "VTE-2026-0041");

    // 5. Vérifier la table paiements
    let p1: (i64, String, String) = sqlx::query_as("SELECT montant_centimes, type_paiement, moyen_paiement FROM paiements WHERE vente_id = ?")
        .bind(&sale_res_1.id)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch payment for sale 1");
    assert_eq!(p1.0, 19000);
    assert_eq!(p1.1, "vente_directe");
    assert_eq!(p1.2, "carte_bancaire");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_cash_session_open_ventilation_and_close() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_session_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Au début, aucune session active
    let active_none = execute_get_active_cash_session(&pool)
        .await
        .expect("Failed to check active session");
    assert!(active_none.is_none(), "Aucune session ne doit être ouverte initialement");

    // 2. Ouverture de la session avec un fond de caisse de 15 000 DA
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
    assert_eq!(session.sales_total_cents, 0);
    assert_eq!(session.rentals_total_cents, 0);

    // 3. Effectuer des opérations pendant que la session est ouverte
    // A. Vente directe en espèces : 5 000 DA
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
    execute_create_direct_sale(&pool, sale_esp)
        .await
        .expect("Failed sale in cash");

    // B. Vente directe en carte bancaire : 12 000 DA
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
    execute_create_direct_sale(&pool, sale_cb)
        .await
        .expect("Failed sale in card");

    // C. Paiement de location (acompte en espèces) : 3 000 DA
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
    execute_record_payment(&pool, pay_loc)
        .await
        .expect("Failed record rental payment");

    // 4. Vérifier la ventilation en temps réel de la session active
    let active_session = execute_get_active_cash_session(&pool)
        .await
        .expect("Failed to get active session")
        .expect("Active session must exist");

    assert_eq!(active_session.sales_total_cents, 17000, "Ventes directes : 5 000 + 12 000 = 17 000 DA");
    assert_eq!(active_session.rentals_total_cents, 3000, "Locations : 3 000 DA");
    assert_eq!(active_session.grand_total_cents, 20000, "Total CA journée : 20 000 DA");
    assert_eq!(active_session.breakdown.especes.total_cents, 8000, "Total espèces : 5000 vente + 3000 location = 8 000 DA");
    assert_eq!(active_session.breakdown.carte_bancaire.total_cents, 12000, "Total CB : 12 000 DA");
    assert_eq!(active_session.theoretical_cash_cents, 23000, "Espèces théoriques : 15 000 (fond) + 8 000 (reçu) = 23 000 DA");

    // 5. Clôture de caisse avec comptage physique et calcul d'écart
    // Cas : l'opérateur compte 22 800 DA (écart de -200 DA)
    let close_dto = CloseCashSessionDto {
        session_id: Some(session.id.clone()),
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 22800,
        operator_notes: Some("Écart de caisse mineur : 200 DA d'erreur de rendu monnaie".to_string()),
    };

    let closed_session = execute_close_cash_session(&pool, close_dto)
        .await
        .expect("Failed to close cash session");

    assert_eq!(closed_session.status, "cloturee");
    assert_eq!(closed_session.counted_cash_cents, Some(22800));
    assert_eq!(closed_session.discrepancy_cents, Some(-200));
    assert!(closed_session.closed_at.is_some());
    assert_eq!(closed_session.closed_by_user_name, Some("Jean-Philippe Directeur".to_string()));

    // 6. Vérifier qu'il n'y a plus de session active
    let active_after_close = execute_get_active_cash_session(&pool)
        .await
        .expect("Failed to check active session after close");
    assert!(active_after_close.is_none(), "Après clôture, aucune session ne doit être ouverte");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_validation_errors_caisse() {
    let test_dir = std::env::temp_dir().join(format!("test_caisse_errors_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Ouvrir une session avec un utilisateur inexistant -> Erreur Validation
    let bad_user_session = execute_open_cash_session(&pool, OpenCashSessionDto {
        utilisateur_id: "usr-inexistant".to_string(),
        initial_cash_float_cents: 10000,
        notes: None,
    }).await;
    match bad_user_session {
        Err(AppError::Validation(msg)) => assert!(msg.contains("Utilisateur introuvable")),
        other => panic!("Attendu AppError::Validation pour utilisateur invalide, obtenu : {:?}", other),
    }

    // 2. Ouvrir une session valide puis tenter d'en ouvrir une seconde simultanément -> Erreur Validation
    execute_open_cash_session(&pool, OpenCashSessionDto {
        utilisateur_id: "usr-001".to_string(),
        initial_cash_float_cents: 10000,
        notes: None,
    }).await.expect("Ouverture première session doit réussir");

    let second_session = execute_open_cash_session(&pool, OpenCashSessionDto {
        utilisateur_id: "usr-002".to_string(),
        initial_cash_float_cents: 5000,
        notes: None,
    }).await;
    match second_session {
        Err(AppError::Validation(msg)) => assert!(msg.contains("déjà actuellement ouverte")),
        other => panic!("Attendu AppError::Validation pour double ouverture simultanée, obtenu : {:?}", other),
    }

    // 3. Créer une vente directe avec panier vide -> Erreur Validation
    let empty_cart_sale = execute_create_direct_sale(&pool, CreateDirectSaleDto {
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
    match empty_cart_sale {
        Err(AppError::Validation(msg)) => assert!(msg.contains("panier")),
        other => panic!("Attendu AppError::Validation pour panier vide, obtenu : {:?}", other),
    }

    // 4. Clôturer la session ouverte
    execute_close_cash_session(&pool, CloseCashSessionDto {
        session_id: None,
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 10000,
        operator_notes: None,
    }).await.expect("Clôture session doit réussir");

    // 5. Tenter de clôturer à nouveau alors qu'aucune session n'est ouverte -> Erreur Validation
    let close_when_none = execute_close_cash_session(&pool, CloseCashSessionDto {
        session_id: None,
        utilisateur_id: "usr-001".to_string(),
        counted_cash_cents: 10000,
        operator_notes: None,
    }).await;
    match close_when_none {
        Err(AppError::Validation(msg)) => assert!(msg.contains("Aucune session")),
        other => panic!("Attendu AppError::Validation lors de la clôture sans session active, obtenu : {:?}", other),
    }

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
