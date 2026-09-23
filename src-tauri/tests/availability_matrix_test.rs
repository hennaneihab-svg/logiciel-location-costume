use costume_rental_lib::db;
use costume_rental_lib::commands::*;
use std::fs;

/// A4.1 Test sur le calcul du tampon pressing automatique :
/// - Historique insuffisant (< 3 envois clôturés) → délai par défaut du prestataire utilisé.
/// - Historique suffisant (≥ 3 envois clôturés, N=5) → moyenne réelle arrondie utilisée.
#[tokio::test]
async fn test_calculate_pressing_buffer_days() {
    let test_dir = std::env::temp_dir().join(format!("test_matrix_buffer_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // 1. Créer un prestataire avec un délai par défaut de 4 jours
    let prest_id = "prest-test-matrix";
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO pressing_prestataires (
            id, nom, contact_nom, telephone, adresse, tarif_defaut_centimes,
            delai_defaut_jours, actif, created_at, updated_at
        ) VALUES (?, 'Pressing Test Matrice', 'Karim', '0555123456', 'Alger', 1000, 4, 1, ?, ?)"
    )
    .bind(prest_id)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert prestataire");

    // Cas A : Aucun envoi clôturé → repli sur delai_defaut_jours (4)
    let buffer_initial = calculate_pressing_buffer_days(&pool, Some(prest_id)).await.expect("Buffer calculation ok");
    assert_eq!(buffer_initial, 4, "Sans historique suffisant, le délai par défaut (4j) doit être utilisé");

    // Créer un premier envoi clôturé (durée = 2 jours)
    sqlx::query(
        "INSERT INTO pressing_envois (
            id, numero_envoi, variante_id, prestataire_id, location_id,
            date_envoi, date_retour_prevue, date_retour_effective, statut, utilisateur_id, created_at, updated_at
        ) VALUES ('env-m1', 'PRS-M-001', 'var-001', ?, NULL, '2026-05-01', '2026-05-04', '2026-05-03', 'recu', 'usr-001', ?, ?)"
    )
    .bind(prest_id)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert envoi 1");

    // Toujours 1 seul envoi (< 3 seuil minimal) → toujours 4 jours
    let buffer_1_envoi = calculate_pressing_buffer_days(&pool, Some(prest_id)).await.expect("Buffer calculation ok");
    assert_eq!(buffer_1_envoi, 4, "Avec 1 seul envoi (< 3), le délai par défaut (4j) doit être maintenu");

    // Créer deuxième envoi clôturé (durée = 2 jours)
    sqlx::query(
        "INSERT INTO pressing_envois (
            id, numero_envoi, variante_id, prestataire_id, location_id,
            date_envoi, date_retour_prevue, date_retour_effective, statut, utilisateur_id, created_at, updated_at
        ) VALUES ('env-m2', 'PRS-M-002', 'var-001', ?, NULL, '2026-05-05', '2026-05-08', '2026-05-07', 'recu', 'usr-001', ?, ?)"
    )
    .bind(prest_id)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert envoi 2");

    // Toujours 2 envois (< 3 seuil minimal) → toujours 4 jours
    let buffer_2_envois = calculate_pressing_buffer_days(&pool, Some(prest_id)).await.expect("Buffer calculation ok");
    assert_eq!(buffer_2_envois, 4, "Avec 2 envois (< 3), le délai par défaut doit être maintenu");

    // Créer troisième envoi clôturé (durée = 2 jours : du 2026-05-10 au 2026-05-12)
    sqlx::query(
        "INSERT INTO pressing_envois (
            id, numero_envoi, variante_id, prestataire_id, location_id,
            date_envoi, date_retour_prevue, date_retour_effective, statut, utilisateur_id, created_at, updated_at
        ) VALUES ('env-m3', 'PRS-M-003', 'var-001', ?, NULL, '2026-05-10', '2026-05-13', '2026-05-12', 'recu', 'usr-001', ?, ?)"
    )
    .bind(prest_id)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert envoi 3");

    // Cas B : 3 envois clôturés de durées (2j, 2j, 2j) → moyenne = 2 jours !
    let buffer_3_envois = calculate_pressing_buffer_days(&pool, Some(prest_id)).await.expect("Buffer calculation ok");
    assert_eq!(buffer_3_envois, 2, "Avec 3 envois de 2 jours chacun, la moyenne réelle (2j) doit être calculée");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// A4.2 Test sur get_availability_matrix :
/// Une variante avec une location + pressing consécutif ordonnés chronologiquement sans trou anormal.
#[tokio::test]
async fn test_get_availability_matrix_slots() {
    let test_dir = std::env::temp_dir().join(format!("test_matrix_slots_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    // var-003 (Smoking Midnight Blue 52)
    // Créons une location du 2026-11-10 au 2026-11-14
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO locations (
            id, numero_location, client_id, utilisateur_id, statut,
            date_retrait_prevue, date_retour_prevue, montant_total_ttc_centimes, montant_caution_centimes,
            statut_caution, created_at, updated_at
        ) VALUES ('loc-mat-01', 'LOC-2026-MAT1', 'cli-001', 'usr-001', 'reserve', '2026-11-10', '2026-11-14', 19000, 50000, 'non_recue', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert location");

    sqlx::query(
        "INSERT INTO lignes_location (id, location_id, variante_id, type_ligne, prix_unitaire_centimes, caution_centimes, etat_depart, est_rendu)
         VALUES ('lig-mat-01', 'loc-mat-01', 'var-003', 'location', 19000, 50000, 'excellent', 0)"
    )
    .execute(&pool)
    .await
    .expect("Insert ligne location");

    // Interroger la matrice sur le mois de novembre 2026 pour art-001 (auquel var-003 appartient)
    let rows = get_availability_matrix_internal(&pool, "2026-11-01", "2026-11-30", Some(vec!["art-001".to_string()]))
        .await
        .expect("Fetch availability matrix ok");

    let row_var3 = rows.iter().find(|r| r.variante_id == "var-003").expect("var-003 found in matrix");
    assert!(!row_var3.slots.is_empty(), "var-003 doit posséder des créneaux");

    // Créneau 1 : Location (2026-11-10 .. 2026-11-14)
    let slot_loc = row_var3.slots.iter().find(|s| s.nature == SlotNature::Location).expect("Créneau location trouvé");
    assert_eq!(slot_loc.date_debut, "2026-11-10");
    assert_eq!(slot_loc.date_fin, "2026-11-14");
    assert_eq!(slot_loc.reference_code.as_deref(), Some("LOC-2026-MAT1"));

    // Créneau 2 : Tampon Pressing consécutif (débute le 2026-11-14)
    let slot_press = row_var3.slots.iter().find(|s| s.nature == SlotNature::Pressing).expect("Créneau pressing trouvé");
    assert_eq!(slot_press.date_debut, "2026-11-14", "Le tampon pressing démarre le jour de la restitution prévue");
    assert!(slot_press.date_fin > slot_press.date_debut, "Le tampon pressing s'étend sur plusieurs jours");

    // Vérifier l'ordre chronologique
    for i in 0..row_var3.slots.len() - 1 {
        assert!(row_var3.slots[i].date_debut <= row_var3.slots[i + 1].date_debut, "Les créneaux doivent être triés par date_debut");
    }

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// A4.3 Test sur validate_variant_availability :
/// - Plage libre acceptée
/// - Plage chevauchant une location existante refusée
/// - Plage chevauchant le tampon pressing post-location refusée
#[tokio::test]
async fn test_validate_variant_availability_rules() {
    let test_dir = std::env::temp_dir().join(format!("test_matrix_val_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let var_id = "var-006"; // Costume 3P Prince de Galles 50
    let now = chrono::Utc::now().to_rfc3339();

    // Créer une location réservée du 2026-12-05 au 2026-12-09
    sqlx::query(
        "INSERT INTO locations (
            id, numero_location, client_id, utilisateur_id, statut,
            date_retrait_prevue, date_retour_prevue, montant_total_ttc_centimes, montant_caution_centimes,
            statut_caution, created_at, updated_at
        ) VALUES ('loc-val-01', 'LOC-2026-VAL1', 'cli-001', 'usr-001', 'reserve', '2026-12-05', '2026-12-09', 21000, 60000, 'non_recue', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert location");

    sqlx::query(
        "INSERT INTO lignes_location (id, location_id, variante_id, type_ligne, prix_unitaire_centimes, caution_centimes, etat_depart, est_rendu)
         VALUES ('lig-val-01', 'loc-val-01', ?, 'location', 21000, 60000, 'excellent', 0)"
    )
    .bind(var_id)
    .execute(&pool)
    .await
    .expect("Insert ligne location");

    // 1. Plage totalement libre (2026-12-20 .. 2026-12-25)
    let res_libre = validate_variant_availability(&pool, var_id, "2026-12-20", "2026-12-25", None)
        .await
        .expect("Validation libre ok");
    assert!(res_libre.disponible, "Une plage sans conflit doit être disponible");
    assert!(res_libre.motif_refus.is_none());

    // 2. Plage chevauchant directement la location (2026-12-07 .. 2026-12-10)
    let res_loc_conflict = validate_variant_availability(&pool, var_id, "2026-12-07", "2026-12-10", None)
        .await
        .expect("Validation ok");
    assert!(!res_loc_conflict.disponible, "Le chevauchement direct avec une location doit être refusé");
    assert_eq!(res_loc_conflict.conflit_nature, Some(SlotNature::Location));
    assert!(res_loc_conflict.motif_refus.unwrap().contains("LOC-2026-VAL1"));

    // 3. Plage chevauchant le tampon pressing (retour le 2026-12-09, tampon de 3j -> jusqu'au 2026-12-12)
    // Tentative de réserver du 2026-12-10 au 2026-12-13
    let res_press_conflict = validate_variant_availability(&pool, var_id, "2026-12-10", "2026-12-13", None)
        .await
        .expect("Validation ok");
    assert!(!res_press_conflict.disponible, "Le chevauchement avec le tampon pressing post-location doit être refusé");
    assert_eq!(res_press_conflict.conflit_nature, Some(SlotNature::Pressing));
    assert!(res_press_conflict.motif_refus.unwrap().contains("nettoyage/pressing"));

    // 4. Plage immédiatement après la fin du tampon pressing (ex: 2026-12-13 .. 2026-12-16)
    let res_after_buffer = validate_variant_availability(&pool, var_id, "2026-12-13", "2026-12-16", None)
        .await
        .expect("Validation ok");
    assert!(res_after_buffer.disponible, "Une fois le tampon pressing dépassé, la pièce redevient réservable");

    // 5. Cas exclusion du contrat (ex: modification/déplacement de LOC-2026-VAL1 sur les mêmes dates)
    let res_excluded = validate_variant_availability(&pool, var_id, "2026-12-05", "2026-12-09", Some("loc-val-01"))
        .await
        .expect("Validation ok");
    assert!(res_excluded.disponible, "Exclure le contrat en cours permet de tester le créneau pour lui-même");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// C4. Test Rust sur reschedule_rental_line :
/// Vérifie que la commande refuse et n'écrit rien si la plage cible est en conflit
/// au moment de l'écriture (simulation de course concurrente entre l'ouverture de la modal et la confirmation).
#[tokio::test]
async fn test_reschedule_rental_line_atomic_rollback_on_concurrent_conflict() {
    use costume_rental_lib::commands::matrix::{
        reschedule_rental_line_internal, RescheduleRentalLineDto,
    };

    let test_dir = std::env::temp_dir().join(format!("test_matrix_resched_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");
    let now = chrono::Utc::now().to_rfc3339();

    // 1. Créer une location initiale : loc-res-01 sur var-001 (Smoking Col Châle Noir 48) du 2026-11-01 au 2026-11-05
    sqlx::query(
        "INSERT INTO locations (
            id, numero_location, client_id, utilisateur_id, statut,
            date_retrait_prevue, date_retour_prevue, montant_total_ttc_centimes, montant_caution_centimes,
            statut_caution, created_at, updated_at
        ) VALUES ('loc-res-01', 'LOC-2026-R01', 'cli-001', 'usr-001', 'reserve', '2026-11-01', '2026-11-05', 18000, 45000, 'non_recue', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert initial location");

    sqlx::query(
        "INSERT INTO lignes_location (id, location_id, variante_id, type_ligne, prix_unitaire_centimes, caution_centimes, etat_depart, est_rendu)
         VALUES ('lig-res-01', 'loc-res-01', 'var-001', 'location', 18000, 45000, 'excellent', 0)"
    )
    .execute(&pool)
    .await
    .expect("Insert initial ligne location");

    // 2. Vérification initiale : var-004 (Smoking Midnight Blue 50) est libre du 2026-11-15 au 2026-11-19
    let initial_val = validate_variant_availability(&pool, "var-004", "2026-11-15", "2026-11-19", Some("loc-res-01"))
        .await
        .expect("Validation initiale ok");
    assert!(initial_val.disponible, "La plage cible est initialement libre");

    // 3. SIMULATION DE COURSE CONCURRENTE :
    // Entre le moment où l'opérateur a vu la case libre et le clic sur 'Confirmer',
    // un collègue valide une location loc-concurrent-02 sur var-004 du 2026-11-16 au 2026-11-20
    sqlx::query(
        "INSERT INTO locations (
            id, numero_location, client_id, utilisateur_id, statut,
            date_retrait_prevue, date_retour_prevue, montant_total_ttc_centimes, montant_caution_centimes,
            statut_caution, created_at, updated_at
        ) VALUES ('loc-conc-02', 'LOC-2026-CONC2', 'cli-002', 'usr-001', 'reserve', '2026-11-16', '2026-11-20', 19000, 50000, 'non_recue', ?, ?)"
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .expect("Insert concurrent location");

    sqlx::query(
        "INSERT INTO lignes_location (id, location_id, variante_id, type_ligne, prix_unitaire_centimes, caution_centimes, etat_depart, est_rendu)
         VALUES ('lig-conc-02', 'loc-conc-02', 'var-004', 'location', 19000, 50000, 'excellent', 0)"
    )
    .execute(&pool)
    .await
    .expect("Insert concurrent ligne");

    // 4. Tentative de reprogrammation : doit ÉCHOUER et ne RIEN ÉCRIRE
    let dto_conflict = RescheduleRentalLineDto {
        location_id: "loc-res-01".to_string(),
        current_variant_id: "var-001".to_string(),
        target_variant_id: "var-004".to_string(),
        new_pickup_date: "2026-11-15".to_string(),
        new_return_date: "2026-11-19".to_string(),
    };

    let result_conflict = reschedule_rental_line_internal(&pool, &dto_conflict).await;
    assert!(result_conflict.is_err(), "La reprogrammation DOIT être rejetée en cas de collision concurrente");
    let err_msg = result_conflict.unwrap_err().to_string();
    assert!(err_msg.contains("conflit de disponibilité"), "L'erreur doit expliciter le conflit : {}", err_msg);

    // 5. VÉRIFICATION DE NON-MODIFICATION (ROLLBACK / ATOMICITÉ) :
    // La location loc-res-01 doit toujours être sur les dates 2026-11-01 .. 2026-11-05
    let loc_check: (String, String) = sqlx::query_as(
        "SELECT date_retrait_prevue, date_retour_prevue FROM locations WHERE id = 'loc-res-01'"
    )
    .fetch_one(&pool)
    .await
    .expect("Fetch location");

    assert_eq!(loc_check.0, "2026-11-01", "La date de retrait n'a pas été altérée");
    assert_eq!(loc_check.1, "2026-11-05", "La date de retour n'a pas été altérée");

    let lig_check: String = sqlx::query_scalar(
        "SELECT variante_id FROM lignes_location WHERE id = 'lig-res-01'"
    )
    .fetch_one(&pool)
    .await
    .expect("Fetch ligne");
    assert_eq!(lig_check, "var-001", "La variante n'a pas été modifiée après échec");

    // 6. CAS NOMINAL : Reprogrammation sans conflit sur une plage totalement libre (2026-11-25 .. 2026-11-28)
    let dto_success = RescheduleRentalLineDto {
        location_id: "loc-res-01".to_string(),
        current_variant_id: "var-001".to_string(),
        target_variant_id: "var-001".to_string(),
        new_pickup_date: "2026-11-25".to_string(),
        new_return_date: "2026-11-28".to_string(),
    };

    let result_success = reschedule_rental_line_internal(&pool, &dto_success).await;
    assert!(result_success.is_ok(), "La reprogrammation valide doit réussir");

    // Vérifier les nouvelles dates en base
    let loc_updated: (String, String) = sqlx::query_as(
        "SELECT date_retrait_prevue, date_retour_prevue FROM locations WHERE id = 'loc-res-01'"
    )
    .fetch_one(&pool)
    .await
    .expect("Fetch location updated");

    assert_eq!(loc_updated.0, "2026-11-25", "La date de retrait a été mise à jour");
    assert_eq!(loc_updated.1, "2026-11-28", "La date de retour a été mise à jour");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

