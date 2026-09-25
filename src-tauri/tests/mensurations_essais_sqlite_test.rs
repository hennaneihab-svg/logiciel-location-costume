use costume_rental_lib::db;
use costume_rental_lib::models::*;
use costume_rental_lib::commands::*;
use costume_rental_lib::commands::matrix::{get_availability_matrix_internal, validate_variant_availability, SlotNature};
use sqlx::Row;
use std::fs;

#[tokio::test]
async fn test_migration_0015_and_fk_integrity() {
    let test_dir = std::env::temp_dir().join(format!("test_mig_0015_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let version: (i64,) = sqlx::query_as("SELECT MAX(version) FROM _migrations")
        .fetch_one(&pool)
        .await
        .expect("Failed to get migration version");
    assert!(version.0 >= 15, "La version de migration doit être au moins 15");

    let fk_violations: Vec<(String, Option<i64>, String, i64)> = sqlx::query_as("PRAGMA foreign_key_check;")
        .fetch_all(&pool)
        .await
        .expect("PRAGMA foreign_key_check failed");

    assert!(
        fk_violations.is_empty(),
        "Aucune violation de clé étrangère tolérée après migration 0015 : {:?}",
        fk_violations
    );

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// Test I4 : vérifie qu'un client_mensurations mis à jour conserve l'ancienne valeur consultable dans l'historique
#[tokio::test]
async fn test_client_mensurations_update_preserves_old_value_in_history() {
    let test_dir = std::env::temp_dir().join(format!("test_mensurations_hist_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let client_id = "cli-001";

    // 1. Première prise de mesure (historique initial)
    let m1 = execute_create_client_mensurations(
        &pool,
        client_id,
        CreateMensurationsDto {
            tour_poitrine: Some(88.0),
            tour_taille: Some(68.0),
            tour_hanches: Some(94.0),
            longueur_bras: Some(58.0),
            longueur_jambe: Some(102.0),
            tour_cou: Some(36.0),
            pointure: Some(38.0),
            stature: Some(172.0),
            notes_mensurations: Some("Mesure initiale avant mariage".to_string()),
            date_mesure: Some("2026-06-01".to_string()),
        },
    )
    .await
    .expect("Échec création m1");

    assert_eq!(m1.est_actuel, 1);
    assert_eq!(m1.tour_taille, Some(68.0));

    // Vérifier get_active
    let active1 = execute_get_client_mensurations_active(&pool, client_id)
        .await
        .expect("Failed to fetch active")
        .expect("Active mensurations should exist");
    assert_eq!(active1.id, m1.id);
    assert_eq!(active1.tour_taille, Some(68.0));

    // 2. Deuxième prise de mesure (mise à jour)
    let m2 = execute_create_client_mensurations(
        &pool,
        client_id,
        CreateMensurationsDto {
            tour_poitrine: Some(88.0),
            tour_taille: Some(65.0), // Évolution taille : 68 -> 65
            tour_hanches: Some(92.0),
            longueur_bras: Some(58.0),
            longueur_jambe: Some(102.0),
            tour_cou: Some(36.0),
            pointure: Some(38.0),
            stature: Some(172.0),
            notes_mensurations: Some("Ajustement après régime".to_string()),
            date_mesure: Some("2026-08-01".to_string()),
        },
    )
    .await
    .expect("Échec création m2");

    assert_eq!(m2.est_actuel, 1);
    assert_eq!(m2.tour_taille, Some(65.0));

    // 3. Vérifier que la nouvelle active est m2 avec la nouvelle valeur
    let active2 = execute_get_client_mensurations_active(&pool, client_id)
        .await
        .expect("Failed to fetch active")
        .expect("Active mensurations should exist");
    assert_eq!(active2.id, m2.id);
    assert_eq!(active2.tour_taille, Some(65.0));

    // 4. Vérifier l'historique complet : l'ancienne valeur (68.0) est conservée et consultable
    let history = execute_get_client_mensurations_history(&pool, client_id)
        .await
        .expect("Failed to fetch history");
    assert_eq!(history.len(), 2, "L'historique doit contenir 2 enregistrements");
    assert_eq!(history[0].id, m2.id);
    assert_eq!(history[0].tour_taille, Some(65.0));
    assert_eq!(history[0].est_actuel, 1);

    // L'ancienne valeur est archivée avec est_actuel = 0
    assert_eq!(history[1].id, m1.id);
    assert_eq!(history[1].tour_taille, Some(68.0), "L'ancienne valeur de taille doit être conservée intacte");
    assert_eq!(history[1].est_actuel, 0, "L'ancienne mesure doit être marquée archivée (est_actuel = 0)");

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_search_clients_by_mensurations() {
    let test_dir = std::env::temp_dir().join(format!("test_search_men_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let client_id = "cli-001";

    execute_create_client_mensurations(
        &pool,
        client_id,
        CreateMensurationsDto {
            tour_poitrine: Some(90.0),
            tour_taille: Some(70.0),
            tour_hanches: Some(96.0),
            longueur_bras: None,
            longueur_jambe: None,
            tour_cou: None,
            pointure: Some(39.0),
            stature: Some(175.0),
            notes_mensurations: None,
            date_mesure: Some("2026-09-01".to_string()),
        },
    )
    .await
    .expect("Création mensuration");

    // Recherche ciblant taille 68..72 -> trouve cli-001
    let filter1 = MensurationSearchFilterDto {
        min_tour_taille: Some(68.0),
        max_tour_taille: Some(72.0),
        ..Default::default()
    };
    let results1 = execute_search_clients_by_mensurations(&pool, filter1).await.expect("Search 1");
    assert!(results1.iter().any(|c| c.id == client_id));

    // Recherche ciblant taille 80..90 -> ne trouve pas cli-001
    let filter2 = MensurationSearchFilterDto {
        min_tour_taille: Some(80.0),
        max_tour_taille: Some(90.0),
        ..Default::default()
    };
    let results2 = execute_search_clients_by_mensurations(&pool, filter2).await.expect("Search 2");
    assert!(!results2.iter().any(|c| c.id == client_id));

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

#[tokio::test]
async fn test_create_essai_cabine_and_duplicate_rejection() {
    let test_dir = std::env::temp_dir().join(format!("test_essai_cabine_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let var_id = "var-001";

    // 1. Créer un premier essai
    let essai = execute_create_essai_cabine(
        &pool,
        CreateEssaiCabineDto {
            variante_id: var_id.to_string(),
            client_id: Some("cli-001".to_string()),
            client_nom_libre: None,
            date_debut: Some("2026-09-25T14:00:00Z".to_string()),
            date_fin_prevue: Some("2026-09-25T15:30:00Z".to_string()),
            notes: Some("Essai pour soirée cocktail".to_string()),
            utilisateur_id: None,
        },
    )
    .await
    .expect("Échec création premier essai");

    assert!(essai.numero_essai.starts_with("ESS-"));
    assert_eq!(essai.statut, "en_cours");
    assert_eq!(essai.variante_id, var_id);

    // 2. Tenter un deuxième essai simultané sur la même pièce -> doit être rejeté
    let err = execute_create_essai_cabine(
        &pool,
        CreateEssaiCabineDto {
            variante_id: var_id.to_string(),
            client_id: None,
            client_nom_libre: Some("Mme Martin".to_string()),
            date_debut: None,
            date_fin_prevue: None,
            notes: None,
            utilisateur_id: None,
        },
    )
    .await;

    assert!(err.is_err(), "Le deuxième essai simultané sur la même pièce doit échouer");
    let err_msg = format!("{:?}", err.err().unwrap());
    assert!(err_msg.contains("déjà en cours d'essayage"), "Message d'erreur inattendu : {}", err_msg);

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// Test J4 : vérifie qu'une clôture d'essai avec issue "retouche_necessaire" crée bien un envoi dans pressing_envois sans double saisie
#[tokio::test]
async fn test_finish_essai_cabine_retouche_necessaire_creates_pressing_envoi_without_duplicate() {
    let test_dir = std::env::temp_dir().join(format!("test_finish_essai_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let var_id = "var-012";

    // 1. Créer un essai
    let essai = execute_create_essai_cabine(
        &pool,
        CreateEssaiCabineDto {
            variante_id: var_id.to_string(),
            client_id: Some("cli-002".to_string()),
            client_nom_libre: None,
            date_debut: Some("2026-09-25T10:00:00Z".to_string()),
            date_fin_prevue: Some("2026-09-25T11:00:00Z".to_string()),
            notes: Some("Retouche ourlet possible".to_string()),
            utilisateur_id: None,
        },
    )
    .await
    .expect("Échec création essai");

    // 2. Clôture avec résultat retouche_necessaire et envoi atelier direct
    let finished = execute_finish_essai_cabine(
        &pool,
        FinishEssaiCabineDto {
            essai_id: essai.id.clone(),
            resultat: "retouche_necessaire".to_string(),
            notes: Some("Ourlet à raccourcir de 3cm".to_string()),
            envoyer_retouche: Some(true),
            retouche_motif: Some("Ourlet 3cm suite essayage".to_string()),
            retouche_prestataire_id: None,
            retouche_date_retour_prevue: Some("2026-09-28".to_string()),
            retouche_cout_centimes: Some(1500),
        },
    )
    .await
    .expect("Échec clôture essai");

    assert_eq!(finished.statut, "termine");
    assert_eq!(finished.resultat, Some("retouche_necessaire".to_string()));
    assert!(finished.pressing_envoi_id.is_some(), "Un envoi retouche/pressing doit être lié directement sans double saisie");

    // 3. Vérifier que la variante de stock est automatiquement passée à 'en_retouche'
    let var_statut: (String,) = sqlx::query_as("SELECT statut FROM variantes_stock WHERE id = ?")
        .bind(var_id)
        .fetch_one(&pool)
        .await
        .expect("Fetch var statut");
    assert_eq!(var_statut.0, "en_retouche");

    // 4. Vérifier l'envoi créé dans pressing_envois avec les données fournies (sans ressaisie)
    let p_row = sqlx::query("SELECT type_traitement, statut, date_retour_prevue, cout_centimes, notes FROM pressing_envois WHERE id = ?")
        .bind(finished.pressing_envoi_id.as_ref().unwrap())
        .fetch_one(&pool)
        .await
        .expect("Fetch pressing envoi");

    let t_type: String = p_row.get("type_traitement");
    let p_stat: String = p_row.get("statut");
    let p_cout: i64 = p_row.get("cout_centimes");
    let p_notes: Option<String> = p_row.get("notes");

    assert_eq!(t_type, "retouche");
    assert_eq!(p_stat, "envoye");
    assert_eq!(p_cout, 1500);
    assert!(p_notes.unwrap_or_default().contains("Ourlet 3cm"));

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}

/// Test J4 : vérifie qu'une variante en essai_cabine est refusée par validate_variant_availability pour une nouvelle réservation sur la période concernée
#[tokio::test]
async fn test_variant_in_essai_cabine_rejected_by_validate_variant_availability() {
    let test_dir = std::env::temp_dir().join(format!("test_matrix_essayage_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");
    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let var_id = "var-003";

    // 1. Créer un essai en cours
    let _ = execute_create_essai_cabine(
        &pool,
        CreateEssaiCabineDto {
            variante_id: var_id.to_string(),
            client_id: Some("cli-001".to_string()),
            client_nom_libre: None,
            date_debut: Some("2026-09-25".to_string()),
            date_fin_prevue: Some("2026-09-25".to_string()),
            notes: Some("Essayage en cours pour la matrice".to_string()),
            utilisateur_id: None,
        },
    )
    .await
    .expect("Création essai");

    // 2. Interroger la Matrice de Disponibilité
    let matrix = get_availability_matrix_internal(&pool, "2026-09-20", "2026-09-30", None)
        .await
        .expect("Get matrix");

    let var_row = matrix.iter().find(|r| r.variante_id == var_id).expect("Row var-003 found");
    let essayage_slot = var_row.slots.iter().find(|s| s.nature == SlotNature::Essayage);

    assert!(essayage_slot.is_some(), "Un créneau de nature Essayage doit apparaître sur la matrice");
    let slot = essayage_slot.unwrap();
    assert_eq!(slot.date_debut, "2026-09-25");
    assert_eq!(slot.date_fin, "2026-09-25");

    // 3. Valider la disponibilité pour cette journée -> doit être REFUSÉE avec conflit SlotNature::Essayage
    let validation = validate_variant_availability(&pool, var_id, "2026-09-25", "2026-09-25", None)
        .await
        .expect("Validate availability");

    assert!(!validation.disponible, "La variante ne doit pas être disponible pendant son essayage en cabine");
    assert_eq!(
        validation.conflit_nature,
        Some(SlotNature::Essayage),
        "Le conflit doit explicitement désigner l'essayage"
    );

    pool.close().await;
    let _ = fs::remove_dir_all(&test_dir);
}
