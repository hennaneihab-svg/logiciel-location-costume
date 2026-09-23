use costume_rental_lib::db;
use costume_rental_lib::commands::settings::*;
use std::fs;

#[tokio::test]
async fn test_migration_0011_parametres_table_and_defaults() {
    let test_dir = std::env::temp_dir().join(format!("test_mig_0011_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Init db ok");

    // 1. Vérifier que la version 11 est bien enregistrée
    let row11: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 11")
        .fetch_optional(&pool)
        .await
        .unwrap();
    assert!(row11.is_some(), "Migration 0011 doit être enregistrée");

    // 2. Vérifier les colonnes de la table parametres
    let cols: Vec<(String,)> = sqlx::query_as("SELECT name FROM pragma_table_info('parametres')")
        .fetch_all(&pool)
        .await
        .unwrap();
    let col_names: Vec<String> = cols.into_iter().map(|c| c.0).collect();

    assert!(col_names.contains(&"cle".to_string()), "Colonne cle présente");
    assert!(col_names.contains(&"valeur".to_string()), "Colonne valeur présente");
    assert!(col_names.contains(&"updated_at".to_string()), "Colonne updated_at présente");

    // 3. Vérifier la présence des réglages par défaut
    let all_settings = execute_get_all_settings(&pool).await.unwrap();
    assert!(all_settings.contains_key("boutique"), "Clé boutique présente par défaut");
    assert!(all_settings.contains_key("numerotation"), "Clé numerotation présente par défaut");
    assert!(all_settings.contains_key("fiscalite"), "Clé fiscalite présente par défaut");
    assert!(all_settings.contains_key("backups"), "Clé backups présente par défaut");
    assert!(all_settings.contains_key("audit_logs"), "Clé audit_logs présente par défaut");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_settings_read_write_persistence_across_reconnect() {
    let test_dir = std::env::temp_dir().join(format!("test_settings_persist_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Init db ok");

    // Écriture d'un réglage personnalisé boutique et numérotation
    let custom_boutique = r#"{"name":"Boutique Test Persistance","slogan":"Test Slogan","city":"Oran"}"#;
    execute_set_setting(&pool, "boutique", custom_boutique).await.expect("Set boutique ok");

    let custom_num = r#"{"rental_prefix":"TEST-LOC","sale_prefix":"TEST-VTE"}"#;
    execute_set_setting(&pool, "numerotation", custom_num).await.expect("Set numerotation ok");

    // Fermeture du pool (simulation arrêt application)
    pool.close().await;

    // Réouverture d'un nouveau pool (simulation redémarrage)
    let reconnected_pool = db::init_db(&test_dir).await.expect("Reconnect db ok");

    let read_boutique = execute_get_setting(&reconnected_pool, "boutique").await.unwrap();
    assert_eq!(read_boutique.as_deref(), Some(custom_boutique), "Boutique restaurée fidèlement après reconnexion");

    let read_num = execute_get_setting(&reconnected_pool, "numerotation").await.unwrap();
    assert_eq!(read_num.as_deref(), Some(custom_num), "Numérotation restaurée fidèlement après reconnexion");

    reconnected_pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_backup_and_restore_includes_settings() {
    let test_dir = std::env::temp_dir().join(format!("test_backup_settings_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Init db ok");

    // 1. Configurer des réglages spécifiques
    let custom_boutique = r#"{"name":"Boutique Avant Sauvegarde","city":"Constantine"}"#;
    execute_set_setting(&pool, "boutique", custom_boutique).await.unwrap();

    let custom_tax = r#"{"default_vat_rate":0.15,"currency":"DZD","currency_symbol":"DA"}"#;
    execute_set_setting(&pool, "fiscalite", custom_tax).await.unwrap();

    // 2. Créer une sauvegarde physique (flush WAL checkpoint puis copie)
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);").execute(&pool).await;
    let db_path = test_dir.join("costume_rental.db");
    let backup_path = test_dir.join("costume_rental_backup_test.db");
    fs::copy(&db_path, &backup_path).expect("Copy db to backup file");

    // 3. Altérer la base courante (écraser par d'autres valeurs)
    execute_set_setting(&pool, "boutique", r#"{"name":"Boutique Modifiée Invalide"}"#).await.unwrap();
    execute_set_setting(&pool, "fiscalite", r#"{"default_vat_rate":0.0}"#).await.unwrap();

    // Vérifier l'altération
    let altered = execute_get_setting(&pool, "boutique").await.unwrap();
    assert_eq!(altered.as_deref(), Some(r#"{"name":"Boutique Modifiée Invalide"}"#));

    // 4. Restaurer depuis le backup_path
    // Libération des verrous Windows
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);").execute(&pool).await;
    pool.close().await;

    // Remplacement atomique avec retry loop pour Windows
    let backup_pre_restore = test_dir.join("costume_rental.db.pre-restore.bak");
    let mut backed_up = false;
    for _ in 0..20 {
        let _ = fs::remove_file(&backup_pre_restore);
        if fs::rename(&db_path, &backup_pre_restore).is_ok() {
            backed_up = true;
            break;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    assert!(backed_up, "Rename to pre-restore must succeed");

    fs::copy(&backup_path, &db_path).expect("Copy backup to active db");

    let _ = fs::remove_file(test_dir.join("costume_rental.db-wal"));
    let _ = fs::remove_file(test_dir.join("costume_rental.db-shm"));

    // 5. Réouverture de la base restaurée
    let restored_pool = db::init_db(&test_dir).await.expect("Reconnect restored db ok");

    // 6. Vérifications : les réglages personnalisés d'origine sont intégralement revenus
    let restored_boutique = execute_get_setting(&restored_pool, "boutique").await.unwrap();
    assert_eq!(restored_boutique.as_deref(), Some(custom_boutique), "Réglages boutique restaurés");

    let restored_tax = execute_get_setting(&restored_pool, "fiscalite").await.unwrap();
    assert_eq!(restored_tax.as_deref(), Some(custom_tax), "Réglages fiscalité restaurés");

    restored_pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_import_legacy_localstorage_and_duplicate_prevention() {
    let test_dir = std::env::temp_dir().join(format!("test_import_legacy_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Init db ok");

    // Préparation d'un jeu de données legacy simulé
    let payload = LegacyImportPayload {
        contracts: Some(vec![
            LegacyRentalContract {
                id: "loc-legacy-101".to_string(),
                contract_number: "LOC-2025-0101".to_string(),
                customer_id: "cli-legacy-01".to_string(),
                customer_name: Some("Karim Meziani".to_string()),
                customer_phone: Some("0550112233".to_string()),
                customer_email: Some("karim@example.com".to_string()),
                customer_address: Some("Rue Didouche Mourad, Alger".to_string()),
                customer_cni: Some("CNI-DZ-16-99281".to_string()),
                status: "retourne".to_string(),
                event_date: Some("2025-10-15".to_string()),
                pickup_date: "2025-10-13".to_string(),
                return_date_scheduled: "2025-10-16".to_string(),
                return_date_actual: Some("2025-10-16".to_string()),
                items: vec![
                    LegacyRentalItem {
                        variant_id: "var-001".to_string(),
                        article_id: Some("art-001".to_string()),
                        unit_price_cents: 18000,
                        deposit_cents: Some(40000),
                        cleaning_fee_cents: Some(1500),
                        pickup_condition: Some("excellent".to_string()),
                        return_condition: Some("bon_etat".to_string()),
                        damage_fee_cents: Some(0),
                        damage_notes: None,
                        is_returned: Some(true),
                        return_date: Some("2025-10-16".to_string()),
                    }
                ],
                total_rental_cents: Some(18000),
                cleaning_fee_cents: Some(1500),
                discount_cents: Some(0),
                late_fee_cents: Some(0),
                damage_fee_cents: Some(0),
                total_amount_cents: 18000,
                deposit_amount_cents: Some(40000),
                deposit_status: Some("restituee".to_string()),
                deposit_method: Some("cheque".to_string()),
                deposit_notes: Some("Chèque restitué le 16/10".to_string()),
                paid_amount_cents: Some(18000),
                payment_method: Some("carte_bancaire".to_string()),
                remaining_amount_cents: Some(0),
                notes: Some("Location historique marié".to_string()),
                created_at: Some("2025-10-01T10:00:00.000Z".to_string()),
                updated_at: Some("2025-10-16T18:00:00.000Z".to_string()),
            },
            LegacyRentalContract {
                id: "loc-legacy-102".to_string(),
                contract_number: "LOC-2025-0102".to_string(),
                customer_id: "cli-legacy-02".to_string(),
                customer_name: Some("Amine Bensalem".to_string()),
                customer_phone: Some("0661445566".to_string()),
                customer_email: None,
                customer_address: None,
                customer_cni: None,
                status: "en_cours".to_string(),
                event_date: None,
                pickup_date: "2025-11-01".to_string(),
                return_date_scheduled: "2025-11-05".to_string(),
                return_date_actual: None,
                items: vec![
                    LegacyRentalItem {
                        variant_id: "var-002".to_string(),
                        article_id: Some("art-001".to_string()),
                        unit_price_cents: 22000,
                        deposit_cents: Some(50000),
                        cleaning_fee_cents: None,
                        pickup_condition: Some("excellent".to_string()),
                        return_condition: None,
                        damage_fee_cents: None,
                        damage_notes: None,
                        is_returned: Some(false),
                        return_date: None,
                    }
                ],
                total_rental_cents: Some(22000),
                cleaning_fee_cents: None,
                discount_cents: None,
                late_fee_cents: None,
                damage_fee_cents: None,
                total_amount_cents: 22000,
                deposit_amount_cents: Some(50000),
                deposit_status: Some("cheque_retenu".to_string()),
                deposit_method: Some("cheque".to_string()),
                deposit_notes: None,
                paid_amount_cents: Some(10000), // Acompte payé
                payment_method: Some("especes".to_string()),
                remaining_amount_cents: Some(12000),
                notes: None,
                created_at: Some("2025-10-25T14:00:00.000Z".to_string()),
                updated_at: Some("2025-11-01T09:30:00.000Z".to_string()),
            },
        ]),
        sales: Some(vec![
            LegacyDirectSale {
                id: "vte-legacy-201".to_string(),
                sale_number: "VTE-2025-0088".to_string(),
                customer_id: None,
                customer_name: Some("Client Passage".to_string()),
                user_id: Some("usr-001".to_string()),
                total_amount_cents: 9500,
                payment: Some(LegacySalePayment {
                    method: "especes".to_string(),
                    amount_paid_cents: 9500,
                    transaction_ref: None,
                }),
                items: vec![
                    LegacySaleItem {
                        id: Some("item-leg-1".to_string()),
                        article_id: "art-001".to_string(),
                        variant_id: Some("var-001".to_string()),
                        quantity: Some(1),
                        unit_price_cents: 9500,
                        subtotal_cents: Some(9500),
                    }
                ],
                notes: Some("Vente boutons de manchette".to_string()),
                created_at: Some("2025-10-20T11:00:00.000Z".to_string()),
            }
        ]),
    };

    // 1. Premier import
    let report1 = execute_import_legacy_localstorage(&pool, payload.clone()).await.unwrap();

    assert_eq!(report1.locations_imported, 2, "2 locations importées");
    assert_eq!(report1.locations_skipped_duplicates, 0, "0 doublon au départ");
    assert_eq!(report1.lignes_location_imported, 2, "2 lignes de location importées");
    assert_eq!(report1.ventes_imported, 1, "1 vente importée");
    assert_eq!(report1.ventes_skipped_duplicates, 0, "0 vente doublon au départ");
    assert_eq!(report1.lignes_vente_imported, 1, "1 ligne de vente importée");
    assert_eq!(report1.paiements_imported, 3, "3 paiements créés (2 locations + 1 vente)");
    assert_eq!(report1.paiements_skipped_duplicates, 0, "0 paiement doublon");
    assert!(report1.errors.is_empty(), "Aucune erreur d'import");

    // Vérification des données en base
    let count_loc: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM locations WHERE id IN ('loc-legacy-101', 'loc-legacy-102')")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count_loc.0, 2, "Les 2 locations sont bien présentes dans SQLite");

    let count_vte: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ventes WHERE id = 'vte-legacy-201'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count_vte.0, 1, "La vente est bien présente dans SQLite");

    // Vérifier que le flag de migration app_meta est à '1'
    let meta_flag: (String,) = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = 'local_storage_migrated'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(meta_flag.0, "1", "Flag local_storage_migrated passé à 1");

    // 2. Second import du MÊME payload (vérification anti-doublon absolue)
    let report2 = execute_import_legacy_localstorage(&pool, payload).await.unwrap();

    assert_eq!(report2.locations_imported, 0, "0 nouvelle location importée au second passage");
    assert_eq!(report2.locations_skipped_duplicates, 2, "2 doublons locations détectés et ignorés");
    assert_eq!(report2.ventes_imported, 0, "0 nouvelle vente importée au second passage");
    assert_eq!(report2.ventes_skipped_duplicates, 1, "1 doublon vente détecté et ignoré");
    assert_eq!(report2.paiements_imported, 0, "0 nouveau paiement importé");
    assert_eq!(report2.paiements_skipped_duplicates, 0, "Aucun paiement orphelin tenté");

    // Vérifier qu'aucun doublon n'a été inséré dans SQLite
    let count_loc_after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM locations WHERE id IN ('loc-legacy-101', 'loc-legacy-102')")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count_loc_after.0, 2, "Toujours exactement 2 locations en base");

    let count_vte_after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ventes WHERE id = 'vte-legacy-201'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count_vte_after.0, 1, "Toujours exactement 1 vente en base");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
