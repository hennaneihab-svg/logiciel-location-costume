use costume_rental_lib::db;
use costume_rental_lib::models::*;
use costume_rental_lib::commands::*;
use std::fs;
use std::sync::Arc;

/// 1. test_migration_0008_and_fk_integrity
/// Vérifie l'application des migrations 0001 à 0008 sur base neuve et sur base peuplée.
/// Contrôle que PRAGMA foreign_key_check renvoie 0 violation.
#[tokio::test]
async fn test_migration_0008_and_fk_integrity() {
    let test_dir = std::env::temp_dir().join(format!("test_migration_0008_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // Vérification version >= 8
    let version: (i64,) = sqlx::query_as("SELECT MAX(version) FROM _migrations")
        .fetch_one(&pool)
        .await
        .expect("Failed to get migration version");
    assert!(version.0 >= 8, "La version de migration doit être au moins 8");

    // PRAGMA foreign_key_check = 0 violation
    let fk_violations: Vec<(String, Option<i64>, String, i64)> = sqlx::query_as("PRAGMA foreign_key_check;")
        .fetch_all(&pool)
        .await
        .expect("PRAGMA foreign_key_check failed");

    assert!(
        fk_violations.is_empty(),
        "Aucune violation de clé étrangère n'est tolérée après migration 0008. Violations: {:?}",
        fk_violations
    );

    // Vérification présence de app_meta pressing_module_actif
    let meta_val: (String,) = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = 'pressing_module_actif'")
        .fetch_one(&pool)
        .await
        .expect("app_meta pressing_module_actif manquant");
    assert_eq!(meta_val.0, "1");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 2. test_create_pressing_dispatch_simple_and_rented_rejection
/// - Envoi d'une pièce disponible -> OK, statut passe à au_pressing.
/// - Envoi d'une pièce en cours de location -> REFUS avec message clair.
#[tokio::test]
async fn test_create_pressing_dispatch_simple_and_rented_rejection() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_simple_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Créer un prestataire
    let prv = execute_create_pressing_provider(
        &pool,
        CreatePressingProviderDto {
            nom: "Pressing Blanchisserie Centrale".to_string(),
            contact_nom: Some("M. Karim".to_string()),
            telephone: Some("0550123456".to_string()),
            adresse: Some("Alger Centre".to_string()),
            tarif_defaut_centimes: Some(150000),
            delai_defaut_jours: Some(3),
            notes: None,
        },
    )
    .await
    .expect("Erreur création prestataire");

    // var-003 est disponible
    let dto = CreatePressingDispatchDto {
        variante_ids: vec!["var-003".to_string()],
        prestataire_id: Some(prv.id.clone()),
        location_id: None,
        type_traitement: Some("nettoyage_complet".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(150000),
        date_retour_prevue: "2026-10-20".to_string(),
        notes: Some("Nettoyage standard".to_string()),
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let dispatches = execute_create_pressing_dispatch(&pool, dto).await.expect("Envoi pressing échoué");
    assert_eq!(dispatches.len(), 1);
    assert_eq!(dispatches[0].statut, "envoye");

    // Vérifier que la variante est bien au_pressing
    let status: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-003'")
        .fetch_one(&pool)
        .await
        .expect("Fetch variante status failed");
    assert_eq!(status.0, "au_pressing");

    // Tentative d'envoi d'une pièce actuellement en location (var-001 est sur loc-001 qui est en_cours)
    let dto_rented = CreatePressingDispatchDto {
        variante_ids: vec!["var-001".to_string()],
        prestataire_id: Some(prv.id),
        location_id: None,
        type_traitement: Some("repassage".to_string()),
        motif: Some("retouche".to_string()),
        cout_centimes: Some(50000),
        date_retour_prevue: "2026-10-20".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let err = execute_create_pressing_dispatch(&pool, dto_rented).await.unwrap_err();
    assert!(err.to_string().contains("actuellement sortie sur le contrat"), "Message attendu: {}", err);

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 3. test_create_pressing_dispatch_future_conflict_force
/// - Pièce avec réservation dans 2 jours, envoi prévu pour retour dans 4 jours sans force -> REFUS avec conflit détecté.
/// - Même cas avec force: true -> ACCEPTÉ avec avertissement.
#[tokio::test]
async fn test_create_pressing_dispatch_future_conflict_force() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_conflict_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // var-005 est réservée sur loc-003 avec date_retrait_prevue = 2026-06-18
    // Créons un envoi pour retour prévu après cette date : 2026-06-25
    let dto_conflict = CreatePressingDispatchDto {
        variante_ids: vec!["var-005".to_string()],
        prestataire_id: None, // Atelier interne
        location_id: None,
        type_traitement: Some("nettoyage_complet".to_string()),
        motif: Some("tache".to_string()),
        cout_centimes: Some(0),
        date_retour_prevue: "2026-06-25".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let err = execute_create_pressing_dispatch(&pool, dto_conflict).await.unwrap_err();
    assert!(err.to_string().contains("Conflit de date"), "L'erreur de conflit attendue: {}", err);

    // Même envoi avec force: true -> DOIT RÉUSSIR
    let dto_forced = CreatePressingDispatchDto {
        variante_ids: vec!["var-005".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("nettoyage_complet".to_string()),
        motif: Some("tache".to_string()),
        cout_centimes: Some(0),
        date_retour_prevue: "2026-06-25".to_string(),
        notes: None,
        force: true,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let dispatches = execute_create_pressing_dispatch(&pool, dto_forced).await.expect("Envoi forcé échoué");
    assert_eq!(dispatches.len(), 1);
    assert_eq!(dispatches[0].statut, "envoye");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 4. test_create_pressing_dispatch_multi_variant_atomic_rollback
/// Envoi de 3 pièces dont la 3e est invalide -> AUCUNE pièce n'est modifiée, aucun envoi créé (rollback complet).
#[tokio::test]
async fn test_create_pressing_dispatch_multi_variant_atomic_rollback() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_rollback_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let count_before: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pressing_envois")
        .fetch_one(&pool)
        .await
        .unwrap();

    let dto = CreatePressingDispatchDto {
        variante_ids: vec!["var-007".to_string(), "var-008".to_string(), "var-inexistante-999".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("complet".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(0),
        date_retour_prevue: "2026-10-20".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let result = execute_create_pressing_dispatch(&pool, dto).await;
    assert!(result.is_err(), "L'envoi avec une variante invalide doit échouer");

    // Vérification qu'aucun envoi n'a été inséré
    let count_after: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pressing_envois")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count_before.0, count_after.0, "Rollback complet: aucun envoi ne doit être créé");

    // Vérification que les pièces n'ont pas changé de statut
    let st7: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-007'").fetch_one(&pool).await.unwrap();
    let st8: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-008'").fetch_one(&pool).await.unwrap();
    assert_ne!(st7.0, "au_pressing");
    assert_ne!(st8.0, "au_pressing");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 5. test_receive_pressing_dispatch_and_recompute_status
/// Réception -> statut recu, la variante repasse à disponible via recompute_variant_status.
#[tokio::test]
async fn test_receive_pressing_dispatch_and_recompute_status() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_receive_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let dto = CreatePressingDispatchDto {
        variante_ids: vec!["var-010".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("repassage".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(0),
        date_retour_prevue: "2026-10-20".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let dispatches = execute_create_pressing_dispatch(&pool, dto).await.unwrap();
    let envoi_id = &dispatches[0].id;

    // Réception
    let updated = execute_receive_pressing_dispatch(&pool, envoi_id, Some("2026-10-18".to_string()), Some("Reçu en parfait état".to_string()))
        .await
        .expect("Réception pressing échouée");

    assert_eq!(updated.statut, "recu");
    assert_eq!(updated.date_retour_effective.as_deref(), Some("2026-10-18"));

    // Vérifier recompute_variant_status -> disponible
    let st: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-010'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(st.0, "disponible");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 6. test_mark_pressing_problem_blocks_rental
/// Problème signalé -> variante passe à indisponible, tentative de création de location avec cette variante -> REFUSÉE.
#[tokio::test]
async fn test_mark_pressing_problem_blocks_rental() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_problem_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let dto = CreatePressingDispatchDto {
        variante_ids: vec!["var-011".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("detachable".to_string()),
        motif: Some("tache".to_string()),
        cout_centimes: Some(0),
        date_retour_prevue: "2026-10-20".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let dispatches = execute_create_pressing_dispatch(&pool, dto).await.unwrap();
    let envoi_id = &dispatches[0].id;

    // Signalement problème
    let updated = execute_mark_pressing_problem(&pool, envoi_id, Some("Brûlure au fer à repasser, tissu endommagé".to_string()))
        .await
        .expect("Signalement problème échoué");

    assert_eq!(updated.statut, "probleme");

    // Vérifier que la variante est passée à indisponible
    let st: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-011'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(st.0, "indisponible");

    // Tentative de louer cette variante -> doit être refusée
    let create_rental_dto = CreateRentalContractDto {
        customer_id: "cli-001".to_string(),
        utilisateur_id: Some("usr-001".to_string()),
        pickup_date: "2026-11-01".to_string(),
        return_date_scheduled: "2026-11-04".to_string(),
        event_date: None,
        selected_variant_ids: vec!["var-011".to_string()],
        quantity_items: None,
        discount_cents: None,
        deposit_method: "empreinte_cb".to_string(),
        deposit_amount_cents: Some(45000),
        paid_amount_cents: Some(0),
        payment_method: "especes".to_string(),
        notes: None,
    };

    let rental_res = execute_create_rental(&pool, create_rental_dto).await;
    assert!(rental_res.is_err(), "La location d'une pièce indisponible doit être refusée");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 7. test_annual_numbering_pressing
/// - Premier envoi 2026 -> PRS-2026-0001.
/// - Passage au 01/01/2027 -> PRS-2027-0001.
/// - Concurrence: deux envois simultanés n'ont jamais le même numéro (BEGIN IMMEDIATE).
#[tokio::test]
async fn test_annual_numbering_pressing() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_numbering_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let mut conn = pool.acquire().await.unwrap();

    // Numérotation 2026
    let (num1_2026, seq1) = next_pressing_number_for_date(&mut conn, "2026-05-10").await.unwrap();
    assert_eq!(num1_2026, "PRS-2026-0001");
    assert_eq!(seq1, 1);

    let (num2_2026, seq2) = next_pressing_number_for_date(&mut conn, "2026-06-15").await.unwrap();
    assert_eq!(num2_2026, "PRS-2026-0002");
    assert_eq!(seq2, 2);

    // Passage en 2027 -> réinitialisation à 0001
    let (num1_2027, seq1_2027) = next_pressing_number_for_date(&mut conn, "2027-01-01").await.unwrap();
    assert_eq!(num1_2027, "PRS-2027-0001");
    assert_eq!(seq1_2027, 1);

    drop(conn);

    // Test concurrence BEGIN IMMEDIATE
    let pool_arc = Arc::new(pool.clone());
    let mut handles = Vec::new();

    for _ in 0..5 {
        let p = pool_arc.clone();
        handles.push(tokio::spawn(async move {
            let mut conn = p.acquire().await.unwrap();
            let (num, _) = next_pressing_number_for_date(&mut conn, "2026-07-01").await.unwrap();
            num
        }));
    }

    let mut generated_numbers = Vec::new();
    for h in handles {
        let num = h.await.unwrap();
        generated_numbers.push(num);
    }

    // Vérifier l'unicité stricte de tous les numéros
    let mut unique_set = generated_numbers.clone();
    unique_set.sort();
    unique_set.dedup();
    assert_eq!(unique_set.len(), generated_numbers.len(), "Aucun doublon de numéro ne doit être généré: {:?}", generated_numbers);

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 8. test_deactivate_provider_with_active_dispatches
/// Prestataire avec envois en cours désactivé -> désactivation OK (archivage logique), historique préservé,
/// impossible de créer de NOUVEAUX envois vers lui.
#[tokio::test]
async fn test_deactivate_provider_with_active_dispatches() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_provider_deact_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // Créer un prestataire
    let prv = execute_create_pressing_provider(
        &pool,
        CreatePressingProviderDto {
            nom: "Pressing Pro Test".to_string(),
            contact_nom: None,
            telephone: None,
            adresse: None,
            tarif_defaut_centimes: Some(200000),
            delai_defaut_jours: Some(2),
            notes: None,
        },
    )
    .await
    .unwrap();

    // Créer un envoi vers ce prestataire
    let dto = CreatePressingDispatchDto {
        variante_ids: vec!["var-015".to_string()],
        prestataire_id: Some(prv.id.clone()),
        location_id: None,
        type_traitement: Some("nettoyage".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(200000),
        date_retour_prevue: "2026-10-25".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let dispatches = execute_create_pressing_dispatch(&pool, dto).await.unwrap();
    assert_eq!(dispatches.len(), 1);

    // Désactiver le prestataire
    execute_set_pressing_provider_active(&pool, &prv.id, false)
        .await
        .expect("Désactivation prestataire échouée");

    // L'envoi en cours est préservé et référence toujours le prestataire
    let check_dispatch: (String, Option<String>) = sqlx::query_as(
        "SELECT id, prestataire_id FROM pressing_envois WHERE id = ?"
    )
    .bind(&dispatches[0].id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(check_dispatch.1.as_deref(), Some(prv.id.as_str()));

    // Tentative de créer un NOUVEL envoi vers ce prestataire inactif -> doit être REFUSÉE
    let dto_new = CreatePressingDispatchDto {
        variante_ids: vec!["var-016".to_string()],
        prestataire_id: Some(prv.id),
        location_id: None,
        type_traitement: Some("nettoyage".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(200000),
        date_retour_prevue: "2026-10-25".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let err = execute_create_pressing_dispatch(&pool, dto_new).await.unwrap_err();
    assert!(err.to_string().contains("inactif"), "Message attendu concernant le prestataire inactif: {}", err);

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
