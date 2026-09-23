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

    let res = execute_create_pressing_dispatch(&pool, dto).await.expect("Envoi pressing échoué");
    assert_eq!(res.dispatches.len(), 1);
    assert_eq!(res.dispatches[0].statut, "envoye");

    // Vérifier que la variante est bien au_pressing
    let status: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-003'")
        .fetch_one(&pool)
        .await
        .expect("Fetch variante status failed");
    assert_eq!(status.0, "au_pressing");

    // Tentative d'envoi d'une pièce actuellement en location (var-002 est sur loc-011 qui est en retard / en cours)
    let dto_rented = CreatePressingDispatchDto {
        variante_ids: vec!["var-002".to_string()],
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

    // var-005 est réservée sur loc-014 avec date_retrait_prevue = 2026-09-17
    // Créons un envoi pour retour prévu après cette date : 2026-09-22
    let dto_conflict = CreatePressingDispatchDto {
        variante_ids: vec!["var-005".to_string()],
        prestataire_id: None, // Atelier interne
        location_id: None,
        type_traitement: Some("nettoyage_complet".to_string()),
        motif: Some("tache".to_string()),
        cout_centimes: Some(0),
        date_retour_prevue: "2026-09-22".to_string(),
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
        date_retour_prevue: "2026-09-22".to_string(),
        notes: None,
        force: true,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let res = execute_create_pressing_dispatch(&pool, dto_forced).await.expect("Envoi forcé échoué");
    assert_eq!(res.dispatches.len(), 1);
    assert_eq!(res.dispatches[0].statut, "envoye");

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
        variante_ids: vec!["var-003".to_string(), "var-004".to_string(), "var-inexistante-999".to_string()],
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
    let st3: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-003'").fetch_one(&pool).await.unwrap();
    let st4: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-004'").fetch_one(&pool).await.unwrap();
    assert_eq!(st3.0, "disponible");
    assert_eq!(st4.0, "disponible");

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

    let res = execute_create_pressing_dispatch(&pool, dto).await.unwrap();
    let envoi_id = &res.dispatches[0].id;

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

    let res = execute_create_pressing_dispatch(&pool, dto).await.unwrap();
    let envoi_id = &res.dispatches[0].id;

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
        pack_lines: None,
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

    let res = execute_create_pressing_dispatch(&pool, dto).await.unwrap();
    assert_eq!(res.dispatches.len(), 1);

    // Désactiver le prestataire
    execute_set_pressing_provider_active(&pool, &prv.id, false)
        .await
        .expect("Désactivation prestataire échouée");

    // L'envoi en cours est préservé et référence toujours le prestataire
    let check_dispatch: (String, Option<String>) = sqlx::query_as(
        "SELECT id, prestataire_id FROM pressing_envois WHERE id = ?"
    )
    .bind(&res.dispatches[0].id)
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

/// 9. test_duplicate_dispatch_rejection_and_multi_variant_partial
/// - Une variante déjà envoyée au pressing (statut envoye) est refusée avec le numéro de son envoi actif.
/// - Un lot multi-pièces contenant une variante active et une disponible : la variante active est refusée
///   sans faire échouer le lot ; la variante disponible est envoyée avec succès.
/// - Le résultat contient explicitement dispatches (pièces créées) et skipped (pièces ignorées avec leur numéro actif).
#[tokio::test]
async fn test_duplicate_dispatch_rejection_and_multi_variant_partial() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_dup_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Premier envoi pour var-003
    let dto1 = CreatePressingDispatchDto {
        variante_ids: vec!["var-003".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("nettoyage".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(100000),
        date_retour_prevue: "2026-10-20".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };
    let res1 = execute_create_pressing_dispatch(&pool, dto1).await.expect("Premier envoi échoué");
    assert_eq!(res1.dispatches.len(), 1);
    assert!(res1.skipped.is_empty(), "Aucune pièce ne doit être ignorée lors du premier envoi");
    let num_actif = res1.dispatches[0].numero_envoi.clone();

    // 2. Second envoi pour var-003 seule -> doit être refusé avec le numéro actif
    let dto2 = CreatePressingDispatchDto {
        variante_ids: vec!["var-003".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("repassage".to_string()),
        motif: Some("retouche".to_string()),
        cout_centimes: Some(50000),
        date_retour_prevue: "2026-10-22".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };
    let err2 = execute_create_pressing_dispatch(&pool, dto2).await.unwrap_err();
    let err_msg = err2.to_string();
    assert!(
        err_msg.contains(&num_actif),
        "L'erreur doit citer le numéro d'envoi actif {}. Reçu : {}",
        num_actif,
        err_msg
    );
    assert!(
        err_msg.contains("déjà envoyée au pressing sous"),
        "Message attendu de non-double envoi. Reçu : {}",
        err_msg
    );

    // 3. Lot mixte : var-003 (active) et var-004 (disponible)
    // var-003 est ignorée/refusée, var-004 est envoyée sans bloquer le lot
    let dto_mixte = CreatePressingDispatchDto {
        variante_ids: vec!["var-003".to_string(), "var-004".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("nettoyage".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(80000),
        date_retour_prevue: "2026-10-25".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };
    let res_mixte = execute_create_pressing_dispatch(&pool, dto_mixte)
        .await
        .expect("Le lot mixte doit réussir pour la pièce disponible");
    assert_eq!(res_mixte.dispatches.len(), 1, "Seule var-004 doit générer un envoi");
    assert_eq!(res_mixte.dispatches[0].variante_id, "var-004");

    // Remontée explicite des pièces ignorées (F1)
    assert_eq!(res_mixte.skipped.len(), 1, "var-003 doit être explicitement listée dans les pièces ignorées");
    assert_eq!(res_mixte.skipped[0].variante_id, "var-003");
    assert_eq!(res_mixte.skipped[0].numero_envoi_actif, num_actif);
    assert!(
        res_mixte.skipped[0].message.contains("déjà envoyée au pressing sous"),
        "Le message doit expliquer le refus : {}",
        res_mixte.skipped[0].message
    );
    assert!(
        res_mixte.skipped[0].message.contains(&num_actif),
        "Le message doit citer le numéro d'envoi actif {}: {}",
        num_actif,
        res_mixte.skipped[0].message
    );

    // Vérifier que var-004 est passée au statut au_pressing
    let st4: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = 'var-004'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(st4.0, "au_pressing");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 10. test_dispatch_allowed_after_received_cancelled_or_problem
/// - Un envoi 'recu', 'annule' ou 'probleme' ne bloque PAS un nouvel envoi (seuls 'envoye' et 'en_traitement' bloquent).
/// - Un envoi avec statut 'en_traitement' bloque également le nouvel envoi.
#[tokio::test]
async fn test_dispatch_allowed_after_received_cancelled_or_problem() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_states_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let create_dto = |var_id: &str| CreatePressingDispatchDto {
        variante_ids: vec![var_id.to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("nettoyage".to_string()),
        motif: Some("usage_normal".to_string()),
        cout_centimes: Some(50000),
        date_retour_prevue: "2026-10-20".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    // --- Cas 1 : Envoi terminé par réception (recu) ---
    let d1 = execute_create_pressing_dispatch(&pool, create_dto("var-006")).await.unwrap();
    execute_receive_pressing_dispatch(&pool, &d1.dispatches[0].id, None, None).await.unwrap();
    // Le nouvel envoi pour var-006 doit être accepté
    let d1_bis = execute_create_pressing_dispatch(&pool, create_dto("var-006")).await;
    assert!(d1_bis.is_ok(), "Un envoi recu ne doit pas bloquer un nouvel envoi");

    // --- Cas 2 : Envoi annulé (annule) ---
    let d1_bis_id = d1_bis.unwrap().dispatches[0].id.clone();
    execute_cancel_pressing_dispatch(&pool, &d1_bis_id).await.unwrap();
    // Le statut est annule -> un nouvel envoi pour var-006 doit être accepté
    let d1_ter = execute_create_pressing_dispatch(&pool, create_dto("var-006")).await;
    assert!(d1_ter.is_ok(), "Un envoi annule ne doit pas bloquer un nouvel envoi");

    // --- Cas 3 : Envoi en problème (probleme) ---
    let d2 = execute_create_pressing_dispatch(&pool, create_dto("var-012")).await.unwrap();
    execute_mark_pressing_problem(&pool, &d2.dispatches[0].id, Some("Tache tenace".to_string())).await.unwrap();
    // Le statut est probleme -> un nouvel envoi pressing doit être possible (par ex. pour pressing spécialisé)
    let d2_bis = execute_create_pressing_dispatch(&pool, create_dto("var-012")).await;
    assert!(d2_bis.is_ok(), "Un envoi en probleme ne doit pas bloquer un nouvel envoi pressing");

    // --- Cas 4 : Statut en_traitement -> DOIT BLOQUER ---
    let d2_bis_id = d2_bis.unwrap().dispatches[0].id.clone();
    let num_en_traitement: (String,) = sqlx::query_as("SELECT numero_envoi FROM pressing_envois WHERE id = ?")
        .bind(&d2_bis_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Passer l'envoi au statut 'en_traitement'
    sqlx::query("UPDATE pressing_envois SET statut = 'en_traitement' WHERE id = ?")
        .bind(&d2_bis_id)
        .execute(&pool)
        .await
        .unwrap();

    let err_en_traitement = execute_create_pressing_dispatch(&pool, create_dto("var-012")).await.unwrap_err();
    let err_msg = err_en_traitement.to_string();
    assert!(
        err_msg.contains(&num_en_traitement.0),
        "Le statut en_traitement doit bloquer et citer le numéro actif {}. Reçu : {}",
        num_en_traitement.0,
        err_msg
    );

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// 11. test_concurrent_create_pressing_dispatch_race_condition
/// Deux appels concurrents sur la même variante sous BEGIN IMMEDIATE :
/// Exactement un seul appel réussit (200/Ok), l'autre reçoit un refus explicite
/// citant le numéro d'envoi actif créé par le premier (pas une erreur générique de base de données).
#[tokio::test]
async fn test_concurrent_create_pressing_dispatch_race_condition() {
    let test_dir = std::env::temp_dir().join(format!("test_dispatch_concurrency_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let pool_arc = Arc::new(pool.clone());
    let pool1 = pool_arc.clone();
    let pool2 = pool_arc.clone();

    let dto1 = CreatePressingDispatchDto {
        variante_ids: vec!["var-009".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("nettoyage".to_string()),
        motif: Some("concurrence_1".to_string()),
        cout_centimes: Some(100000),
        date_retour_prevue: "2026-10-30".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let dto2 = CreatePressingDispatchDto {
        variante_ids: vec!["var-009".to_string()],
        prestataire_id: None,
        location_id: None,
        type_traitement: Some("nettoyage".to_string()),
        motif: Some("concurrence_2".to_string()),
        cout_centimes: Some(100000),
        date_retour_prevue: "2026-10-30".to_string(),
        notes: None,
        force: false,
        utilisateur_id: Some("usr-001".to_string()),
    };

    let h1 = tokio::spawn(async move {
        execute_create_pressing_dispatch(&pool1, dto1).await
    });
    let h2 = tokio::spawn(async move {
        execute_create_pressing_dispatch(&pool2, dto2).await
    });

    let res1 = h1.await.unwrap();
    let res2 = h2.await.unwrap();

    let (ok_res, err_res) = match (res1, res2) {
        (Ok(succ), Err(err)) => (succ, err),
        (Err(err), Ok(succ)) => (succ, err),
        (Ok(_), Ok(_)) => panic!("Course critique : les deux envois ont réussi pour la même variante !"),
        (Err(e1), Err(e2)) => panic!("Les deux envois ont échoué : e1={:?}, e2={:?}", e1, e2),
    };

    assert_eq!(ok_res.dispatches.len(), 1);
    let created_number = &ok_res.dispatches[0].numero_envoi;

    let err_msg = err_res.to_string();
    assert!(
        err_msg.contains(created_number),
        "L'appel refusé doit citer le numéro d'envoi actif créé ({}), reçu: {}",
        created_number,
        err_msg
    );
    assert!(
        err_msg.contains("déjà envoyée au pressing sous"),
        "L'appel refusé doit recevoir un message de validation explicite, pas une erreur SQLite générique : {}",
        err_msg
    );

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
