use costume_rental_lib::db;
use costume_rental_lib::commands::*;
use std::fs;

#[tokio::test]
async fn test_rapports_overview_calculations_and_period_filtering() {
    let test_dir = std::env::temp_dir().join(format!("test_rapports_{}", chrono::Utc::now().timestamp_micros()));
    fs::create_dir_all(&test_dir).expect("Failed to create test dir");

    let pool = db::init_db(&test_dir).await.expect("Failed to init db");

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let old_date = "2025-01-15"; // Date passée (hors mois / semaine en cours)

    // 1. Insertion de 2 contrats aujourd'hui :
    // - Contrat 1 : 25 000 DA (en cours)
    // - Contrat 2 : 15 000 DA (en retard)
    let loc_id_1 = "loc-test-rap-1";
    let loc_id_2 = "loc-test-rap-2";

    sqlx::query(
        "INSERT INTO locations (id, numero_location, client_id, utilisateur_id, statut,
                                date_retrait_prevue, date_retour_prevue, montant_total_ht_centimes,
                                tva_taux, montant_total_ttc_centimes, frais_nettoyage_centimes,
                                frais_retard_centimes, frais_degradation_centimes, remise_centimes,
                                montant_caution_centimes, statut_caution, created_at, updated_at)
         VALUES (?, 'LOC-RAP-001', 'cli-001', 'usr-001', 'en_cours',
                 ?, ?, 25000, 0, 25000, 0, 0, 0, 0, 10000, 'recue', ?, ?)"
    )
    .bind(loc_id_1)
    .bind(&today)
    .bind(&today)
    .bind(format!("{}T10:00:00Z", today))
    .bind(format!("{}T10:00:00Z", today))
    .execute(&pool)
    .await
    .expect("Failed to insert loc 1");

    sqlx::query(
        "INSERT INTO locations (id, numero_location, client_id, utilisateur_id, statut,
                                date_retrait_prevue, date_retour_prevue, montant_total_ht_centimes,
                                tva_taux, montant_total_ttc_centimes, frais_nettoyage_centimes,
                                frais_retard_centimes, frais_degradation_centimes, remise_centimes,
                                montant_caution_centimes, statut_caution, created_at, updated_at)
         VALUES (?, 'LOC-RAP-002', 'cli-002', 'usr-001', 'en_retard',
                 ?, ?, 15000, 0, 15000, 0, 0, 0, 0, 8000, 'recue', ?, ?)"
    )
    .bind(loc_id_2)
    .bind(&today)
    .bind(&today)
    .bind(format!("{}T11:00:00Z", today))
    .bind(format!("{}T11:00:00Z", today))
    .execute(&pool)
    .await
    .expect("Failed to insert loc 2");

    // Contrat ancien (hors période) : 70 000 DA
    let loc_id_old = "loc-test-rap-old";
    sqlx::query(
        "INSERT INTO locations (id, numero_location, client_id, utilisateur_id, statut,
                                date_retrait_prevue, date_retour_prevue, montant_total_ht_centimes,
                                tva_taux, montant_total_ttc_centimes, frais_nettoyage_centimes,
                                frais_retard_centimes, frais_degradation_centimes, remise_centimes,
                                montant_caution_centimes, statut_caution, created_at, updated_at)
         VALUES (?, 'LOC-RAP-OLD', 'cli-001', 'usr-001', 'retourne',
                 ?, ?, 70000, 0, 70000, 0, 0, 0, 0, 20000, 'restituee', ?, ?)"
    )
    .bind(loc_id_old)
    .bind(old_date)
    .bind(old_date)
    .bind(format!("{}T09:00:00Z", old_date))
    .bind(format!("{}T09:00:00Z", old_date))
    .execute(&pool)
    .await
    .expect("Failed to insert old loc");

    // 2. Insertion d'une vente directe aujourd'hui : 10 000 DA
    let vente_id = "vte-test-rap-1";
    sqlx::query(
        "INSERT INTO ventes (id, numero_vente, client_id, client_nom, client_telephone,
                             utilisateur_id, statut, montant_total_centimes, montant_tva_centimes,
                             taux_tva, notes, created_at, updated_at)
         VALUES (?, 'VTE-RAP-001', 'cli-001', 'Jean Dupont', '0600000000',
                 'usr-001', 'completee', 10000, 0, 0, 'Test Vente', ?, ?)"
    )
    .bind(vente_id)
    .bind(format!("{}T12:00:00Z", today))
    .bind(format!("{}T12:00:00Z", today))
    .execute(&pool)
    .await
    .expect("Failed to insert vente");

    // 3. Paiements enregistrés aujourd'hui :
    // - 12 000 DA en espèces sur loc 1
    // - 10 000 DA en CB sur la vente
    sqlx::query(
        "INSERT INTO paiements (id, location_id, vente_id, utilisateur_id, montant_centimes,
                                type_paiement, moyen_paiement, date_paiement)
         VALUES ('pay-rap-1', ?, NULL, 'usr-001', 12000, 'acompte', 'especes', ?)"
    )
    .bind(loc_id_1)
    .bind(format!("{}T12:30:00Z", today))
    .execute(&pool)
    .await
    .expect("Failed to insert payment 1");

    sqlx::query(
        "INSERT INTO paiements (id, location_id, vente_id, utilisateur_id, montant_centimes,
                                type_paiement, moyen_paiement, date_paiement)
         VALUES ('pay-rap-2', NULL, ?, 'usr-001', 10000, 'solde', 'carte_bancaire', ?)"
    )
    .bind(vente_id)
    .bind(format!("{}T12:45:00Z", today))
    .execute(&pool)
    .await
    .expect("Failed to insert payment 2");

    // 4. Envoi pressing aujourd'hui avec coût 4 500 DA
    sqlx::query(
        "INSERT INTO pressing_envois (id, numero_envoi, variante_id, prestataire_id,
                                      type_traitement, cout_centimes, statut_paiement_prestataire,
                                      date_envoi, date_retour_prevue, statut, utilisateur_id,
                                      created_at, updated_at)
         VALUES ('prs-rap-1', 'PRS-RAP-001', 'var-001', 'pres-001', 'lavage', 4500, 'a_payer',
                 ?, ?, 'envoye', 'usr-001', ?, ?)"
    )
    .bind(&today)
    .bind(&today)
    .bind(format!("{}T14:00:00Z", today))
    .bind(format!("{}T14:00:00Z", today))
    .execute(&pool)
    .await
    .expect("Failed to insert pressing envoi");

    // --- TEST 1 : Calcul de l'overview sur la période 'aujourdhui' ---
    let overview_today = execute_get_rapports_overview(&pool, Some("aujourdhui".to_string()), None, None)
        .await
        .expect("Failed to execute get_rapports_overview today");

    // Financier
    assert_eq!(overview_today.financier.ca_locations_centimes, 40000); // 25 000 + 15 000
    assert_eq!(overview_today.financier.ca_ventes_centimes, 10000); // 10 000
    assert_eq!(overview_today.financier.ca_total_centimes, 50000); // 40 000 + 10 000
    assert_eq!(overview_today.financier.nombre_contrats, 2);
    assert_eq!(overview_today.financier.nombre_ventes, 1);
    assert_eq!(overview_today.financier.taux_retard_pourcentage, 50.0); // 1 retard sur 2 contrats = 50.0%
    assert_eq!(overview_today.financier.panier_moyen_centimes, 50000 / 3);

    // Caisse
    assert_eq!(overview_today.caisse.total_reglements_centimes, 22000); // 12 000 + 10 000
    assert_eq!(overview_today.caisse.nombre_transactions, 2);
    let especes = overview_today.caisse.reglements_par_mode.iter().find(|m| m.moyen == "especes").unwrap();
    assert_eq!(especes.montant_centimes, 12000);
    assert_eq!(especes.nb_transactions, 1);
    let cb = overview_today.caisse.reglements_par_mode.iter().find(|m| m.moyen == "carte_bancaire").unwrap();
    assert_eq!(cb.montant_centimes, 10000);
    assert_eq!(cb.nb_transactions, 1);

    // Stock & Pressing
    assert!(overview_today.stock.valeur_totale_stock_centimes > 0);
    assert!(overview_today.stock.nombre_articles_total > 0);
    assert_eq!(overview_today.stock.cout_pressing_centimes, 4500);

    // --- TEST 2 : Vérification du filtrage strict (période personnalisée sur une date passée vide) ---
    let overview_empty = execute_get_rapports_overview(
        &pool,
        Some("personnalise".to_string()),
        Some("2024-01-01".to_string()),
        Some("2024-01-02".to_string()),
    )
    .await
    .expect("Failed to execute get_rapports_overview empty period");

    assert_eq!(overview_empty.financier.ca_total_centimes, 0);
    assert_eq!(overview_empty.financier.nombre_contrats, 0);
    assert_eq!(overview_empty.financier.taux_retard_pourcentage, 0.0);
    assert_eq!(overview_empty.caisse.total_reglements_centimes, 0);
    assert_eq!(overview_empty.stock.cout_pressing_centimes, 0);

    // --- TEST 3 : Lignes de transactions détaillées ---
    let tx_rows = execute_get_financial_transactions_report(&pool, Some("aujourdhui".to_string()), None, None)
        .await
        .expect("Failed to get financial transactions report");

    assert_eq!(tx_rows.len(), 2);
    assert!(tx_rows.iter().any(|r| r.reference == "LOC-RAP-001" && r.montant_centimes == 12000));
    assert!(tx_rows.iter().any(|r| r.reference == "VTE-RAP-001" && r.montant_centimes == 10000));

    // --- TEST 4 : Lignes d'inventaire détaillées ---
    let stock_rows = execute_get_stock_inventory_report(&pool)
        .await
        .expect("Failed to get stock inventory report");

    assert!(!stock_rows.is_empty());
    let var_1_row = stock_rows.iter().find(|s| s.variant_id == "var-001");
    assert!(var_1_row.is_some());
    assert_eq!(var_1_row.unwrap().cout_pressing_total_centimes, 4500);
}
