use std::collections::HashMap;
use tauri::{command, State};
use serde::{Deserialize, Serialize};
use crate::db::DbState;
use crate::error::AppError;
use sqlx::SqlitePool;

// ============================================================================
// MODÈLES POUR L'IMPORTATION DE DONNÉES HISTORIQUES LOCALSTORAGE
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
pub struct LegacyRentalItem {
    pub variant_id: String,
    pub article_id: Option<String>,
    pub unit_price_cents: i64,
    pub deposit_cents: Option<i64>,
    pub cleaning_fee_cents: Option<i64>,
    pub pickup_condition: Option<String>,
    pub return_condition: Option<String>,
    pub damage_fee_cents: Option<i64>,
    pub damage_notes: Option<String>,
    pub is_returned: Option<bool>,
    pub return_date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LegacyRentalContract {
    pub id: String,
    pub contract_number: String,
    pub customer_id: String,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub customer_email: Option<String>,
    pub customer_address: Option<String>,
    pub customer_cni: Option<String>,
    pub status: String,
    pub event_date: Option<String>,
    pub pickup_date: String,
    pub return_date_scheduled: String,
    pub return_date_actual: Option<String>,
    pub items: Vec<LegacyRentalItem>,
    pub total_rental_cents: Option<i64>,
    pub cleaning_fee_cents: Option<i64>,
    pub discount_cents: Option<i64>,
    pub late_fee_cents: Option<i64>,
    pub damage_fee_cents: Option<i64>,
    pub total_amount_cents: i64,
    pub deposit_amount_cents: Option<i64>,
    pub deposit_status: Option<String>,
    pub deposit_method: Option<String>,
    pub deposit_notes: Option<String>,
    pub paid_amount_cents: Option<i64>,
    pub payment_method: Option<String>,
    pub remaining_amount_cents: Option<i64>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LegacySaleItem {
    pub id: Option<String>,
    pub article_id: String,
    pub variant_id: Option<String>,
    pub quantity: Option<i64>,
    pub unit_price_cents: i64,
    pub subtotal_cents: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LegacySalePayment {
    pub method: String,
    pub amount_paid_cents: i64,
    pub transaction_ref: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LegacyDirectSale {
    pub id: String,
    pub sale_number: String,
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub user_id: Option<String>,
    pub total_amount_cents: i64,
    pub payment: Option<LegacySalePayment>,
    pub items: Vec<LegacySaleItem>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LegacyImportPayload {
    pub contracts: Option<Vec<LegacyRentalContract>>,
    pub sales: Option<Vec<LegacyDirectSale>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyImportReportDto {
    pub locations_imported: usize,
    pub locations_skipped_duplicates: usize,
    pub lignes_location_imported: usize,
    pub ventes_imported: usize,
    pub ventes_skipped_duplicates: usize,
    pub lignes_vente_imported: usize,
    pub paiements_imported: usize,
    pub paiements_skipped_duplicates: usize,
    pub errors: Vec<String>,
}

// ============================================================================
// LOGIQUE MÉTIER PURE POUR LES PARAMÈTRES
// ============================================================================

pub async fn execute_get_setting(pool: &SqlitePool, cle: &str) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT valeur FROM parametres WHERE cle = ?")
        .bind(cle)
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(row.map(|r| r.0))
}

pub async fn execute_set_setting(pool: &SqlitePool, cle: &str, valeur: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO parametres (cle, valeur, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at"
    )
    .bind(cle)
    .bind(valeur)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(())
}

pub async fn execute_get_all_settings(pool: &SqlitePool) -> Result<HashMap<String, String>, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT cle, valeur FROM parametres")
        .fetch_all(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let mut map = HashMap::new();
    for (k, v) in rows {
        map.insert(k, v);
    }
    Ok(map)
}

// ============================================================================
// LOGIQUE MÉTIER PURE POUR L'IMPORTATION HISTORIQUE SANS DOUBLON
// ============================================================================

pub async fn execute_import_legacy_localstorage(
    pool: &SqlitePool,
    payload: LegacyImportPayload,
) -> Result<LegacyImportReportDto, AppError> {
    let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
    sqlx::query("BEGIN IMMEDIATE;")
        .execute(&mut *conn)
        .await
        .map_err(AppError::DatabaseError)?;

    let import_res: Result<LegacyImportReportDto, AppError> = async {
        let mut report = LegacyImportReportDto {
            locations_imported: 0,
            locations_skipped_duplicates: 0,
            lignes_location_imported: 0,
            ventes_imported: 0,
            ventes_skipped_duplicates: 0,
            lignes_vente_imported: 0,
            paiements_imported: 0,
            paiements_skipped_duplicates: 0,
            errors: Vec::new(),
        };

        let now = chrono::Utc::now().to_rfc3339();

        // 1. IMPORT DES CONTRATS DE LOCATION
        if let Some(contracts) = payload.contracts {
            for c in contracts {
                // Détection de doublon par ID ou numero_location
                let exists: Option<(i64,)> = sqlx::query_as(
                    "SELECT 1 FROM locations WHERE id = ? OR numero_location = ?"
                )
                .bind(&c.id)
                .bind(&c.contract_number)
                .fetch_optional(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;

                if exists.is_some() {
                    report.locations_skipped_duplicates += 1;
                    continue;
                }

                // Vérifier/Créer le client pour satisfaire la contrainte de clé étrangère
                let client_exists: Option<(i64,)> = sqlx::query_as(
                    "SELECT 1 FROM clients WHERE id = ?"
                )
                .bind(&c.customer_id)
                .fetch_optional(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;

                if client_exists.is_none() {
                    let prenom = c.customer_name.clone().unwrap_or_else(|| "Client".to_string());
                    let nom = "Historique".to_string();
                    let tel = c.customer_phone.clone().unwrap_or_else(|| "0000000000".to_string());
                    let created = c.created_at.clone().unwrap_or_else(|| now.clone());

                    sqlx::query(
                        "INSERT OR IGNORE INTO clients (id, prenom, nom, telephone, email, adresse, numero_cni, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    )
                    .bind(&c.customer_id)
                    .bind(prenom)
                    .bind(nom)
                    .bind(tel)
                    .bind(&c.customer_email)
                    .bind(&c.customer_address)
                    .bind(&c.customer_cni)
                    .bind(&created)
                    .bind(&created)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
                }

                // Utilisateur responsable (par défaut 'usr-001')
                let user_id = "usr-001";

                let statut_valid = match c.status.as_str() {
                    "brouillon" | "reserve" | "en_cours" | "retourne" | "en_retard" | "litige" | "annule" => c.status.clone(),
                    _ => "en_cours".to_string(),
                };

                let statut_caution_valid = match c.deposit_status.as_deref() {
                    Some("non_recue") | Some("encaissee") | Some("empreinte_cb") | Some("cheque_retenu")
                    | Some("restituee") | Some("conservee_partiellement") | Some("conservee_totalement") => {
                        c.deposit_status.clone().unwrap()
                    }
                    _ => "non_recue".to_string(),
                };

                let created_date = c.created_at.clone().unwrap_or_else(|| now.clone());
                let updated_date = c.updated_at.clone().unwrap_or_else(|| created_date.clone());

                sqlx::query(
                    "INSERT INTO locations (
                        id, numero_location, client_id, utilisateur_id, statut,
                        date_evenement, date_retrait_prevue, date_retrait_effective,
                        date_retour_prevue, date_retour_effective, montant_total_ht_centimes,
                        tva_taux, montant_total_ttc_centimes, frais_nettoyage_centimes,
                        frais_retard_centimes, frais_degradation_centimes, remise_centimes,
                        montant_caution_centimes, statut_caution, notes_caution, notes,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 19.0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(&c.id)
                .bind(&c.contract_number)
                .bind(&c.customer_id)
                .bind(user_id)
                .bind(statut_valid)
                .bind(&c.event_date)
                .bind(&c.pickup_date)
                .bind(&c.pickup_date) // date_retrait_effective
                .bind(&c.return_date_scheduled)
                .bind(&c.return_date_actual)
                .bind(c.total_rental_cents.unwrap_or(c.total_amount_cents))
                .bind(c.total_amount_cents)
                .bind(c.cleaning_fee_cents.unwrap_or(0))
                .bind(c.late_fee_cents.unwrap_or(0))
                .bind(c.damage_fee_cents.unwrap_or(0))
                .bind(c.discount_cents.unwrap_or(0))
                .bind(c.deposit_amount_cents.unwrap_or(0))
                .bind(statut_caution_valid)
                .bind(&c.deposit_notes)
                .bind(&c.notes)
                .bind(&created_date)
                .bind(&updated_date)
                .execute(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;

                report.locations_imported += 1;

                // Lignes de location
                for (idx, item) in c.items.iter().enumerate() {
                    // S'assurer que la variante existe
                    let var_exists: Option<(i64,)> = sqlx::query_as(
                        "SELECT 1 FROM variantes_stock WHERE id = ?"
                    )
                    .bind(&item.variant_id)
                    .fetch_optional(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                    if var_exists.is_none() {
                        // Récupérer un article valide pour ancrer la variante
                        let art_id: Option<(String,)> = sqlx::query_as(
                            "SELECT id FROM articles LIMIT 1"
                        )
                        .fetch_optional(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;

                        if let Some((valid_art_id,)) = art_id {
                            let barcode = format!("BAR-IMP-{}", &item.variant_id);
                            sqlx::query(
                                "INSERT OR IGNORE INTO variantes_stock (id, article_id, code_barre, taille, etat_usure, statut, created_at, updated_at)
                                 VALUES (?, ?, ?, 'Standard', 'bon', 'disponible', ?, ?)"
                            )
                            .bind(&item.variant_id)
                            .bind(valid_art_id)
                            .bind(barcode)
                            .bind(&created_date)
                            .bind(&created_date)
                            .execute(&mut *conn)
                            .await
                            .map_err(AppError::DatabaseError)?;
                        }
                    }

                    let ligne_id = format!("lign-{}-{}", &c.id, idx);
                    let is_rendu = if item.is_returned.unwrap_or(false) { 1 } else { 0 };

                    sqlx::query(
                        "INSERT INTO lignes_location (
                            id, location_id, variante_id, type_ligne, prix_unitaire_centimes,
                            caution_centimes, etat_depart, etat_retour, est_rendu, date_retour, notes
                        ) VALUES (?, ?, ?, 'location', ?, ?, ?, ?, ?, ?, ?)"
                    )
                    .bind(&ligne_id)
                    .bind(&c.id)
                    .bind(&item.variant_id)
                    .bind(item.unit_price_cents)
                    .bind(item.deposit_cents.unwrap_or(0))
                    .bind(item.pickup_condition.as_deref().unwrap_or("excellent"))
                    .bind(item.return_condition.as_deref())
                    .bind(is_rendu)
                    .bind(&item.return_date)
                    .bind(&item.damage_notes)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                    report.lignes_location_imported += 1;
                }

                // Paiement associé à la location
                if let Some(paid) = c.paid_amount_cents {
                    if paid > 0 {
                        let pay_id = format!("pay-loc-{}", &c.id);
                        let pay_exists: Option<(i64,)> = sqlx::query_as(
                            "SELECT 1 FROM paiements WHERE id = ?"
                        )
                        .bind(&pay_id)
                        .fetch_optional(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;

                        if pay_exists.is_none() {
                            let pay_method = match c.payment_method.as_deref() {
                                Some("especes") | Some("carte_bancaire") | Some("cheque") | Some("virement") => {
                                    c.payment_method.clone().unwrap()
                                }
                                _ => "especes".to_string(),
                            };

                            sqlx::query(
                                "INSERT INTO paiements (
                                    id, location_id, vente_id, utilisateur_id, montant_centimes,
                                    type_paiement, moyen_paiement, notes, date_paiement
                                ) VALUES (?, ?, NULL, ?, ?, 'solde', ?, 'Paiement import historique', ?)"
                            )
                            .bind(&pay_id)
                            .bind(&c.id)
                            .bind(user_id)
                            .bind(paid)
                            .bind(pay_method)
                            .bind(&created_date)
                            .execute(&mut *conn)
                            .await
                            .map_err(AppError::DatabaseError)?;

                            report.paiements_imported += 1;
                        } else {
                            report.paiements_skipped_duplicates += 1;
                        }
                    }
                }
            }
        }

        // 2. IMPORT DES VENTES DIRECTES
        if let Some(sales) = payload.sales {
            for s in sales {
                // Détection de doublon par ID ou numero_vente
                let exists: Option<(i64,)> = sqlx::query_as(
                    "SELECT 1 FROM ventes WHERE id = ? OR numero_vente = ?"
                )
                .bind(&s.id)
                .bind(&s.sale_number)
                .fetch_optional(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;

                if exists.is_some() {
                    report.ventes_skipped_duplicates += 1;
                    continue;
                }

                let user_id = s.user_id.clone().unwrap_or_else(|| "usr-001".to_string());
                let created_date = s.created_at.clone().unwrap_or_else(|| now.clone());
                let moyen_paiement = s.payment.as_ref()
                    .map(|p| p.method.clone())
                    .unwrap_or_else(|| "especes".to_string());

                let moyen_valid = match moyen_paiement.as_str() {
                    "especes" | "carte_bancaire" | "cheque" | "virement" | "autre" => moyen_paiement,
                    _ => "especes".to_string(),
                };

                sqlx::query(
                    "INSERT INTO ventes (
                        id, numero_vente, client_id, utilisateur_id, montant_total_centimes,
                        moyen_paiement, statut, notes, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 'completee', ?, ?)"
                )
                .bind(&s.id)
                .bind(&s.sale_number)
                .bind(&s.customer_id)
                .bind(&user_id)
                .bind(s.total_amount_cents)
                .bind(moyen_valid)
                .bind(&s.notes)
                .bind(&created_date)
                .execute(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;

                report.ventes_imported += 1;

                // Lignes de vente
                for (idx, item) in s.items.iter().enumerate() {
                    let ligne_id = item.id.clone().unwrap_or_else(|| format!("lign-vte-{}-{}", &s.id, idx));
                    let qty = item.quantity.unwrap_or(1);
                    let subtotal = item.subtotal_cents.unwrap_or(item.unit_price_cents * qty);

                    sqlx::query(
                        "INSERT INTO lignes_vente (
                            id, vente_id, article_id, variante_id, quantite,
                            prix_unitaire_centimes, total_centimes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)"
                    )
                    .bind(&ligne_id)
                    .bind(&s.id)
                    .bind(&item.article_id)
                    .bind(&item.variant_id)
                    .bind(qty)
                    .bind(item.unit_price_cents)
                    .bind(subtotal)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                    report.lignes_vente_imported += 1;
                }

                // Paiement de la vente
                if let Some(payment) = s.payment {
                    if payment.amount_paid_cents > 0 {
                        let pay_id = format!("pay-vte-{}", &s.id);
                        let pay_exists: Option<(i64,)> = sqlx::query_as(
                            "SELECT 1 FROM paiements WHERE id = ?"
                        )
                        .bind(&pay_id)
                        .fetch_optional(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;

                        if pay_exists.is_none() {
                            let moyen_paiement = match payment.method.as_str() {
                                "especes" | "carte_bancaire" | "cheque" | "virement" | "autre" => payment.method,
                                _ => "especes".to_string(),
                            };

                            sqlx::query(
                                "INSERT INTO paiements (
                                    id, location_id, vente_id, utilisateur_id, montant_centimes,
                                    type_paiement, moyen_paiement, reference_transaction, notes, date_paiement
                                ) VALUES (?, NULL, ?, ?, ?, 'vente_directe', ?, ?, 'Paiement vente import historique', ?)"
                            )
                            .bind(&pay_id)
                            .bind(&s.id)
                            .bind(&user_id)
                            .bind(payment.amount_paid_cents)
                            .bind(moyen_paiement)
                            .bind(&payment.transaction_ref)
                            .bind(&created_date)
                            .execute(&mut *conn)
                            .await
                            .map_err(AppError::DatabaseError)?;

                            report.paiements_imported += 1;
                        } else {
                            report.paiements_skipped_duplicates += 1;
                        }
                    }
                }
            }
        }

        // 3. MISE À JOUR DU FLAG DE MIGRATION DANS APP_META
        sqlx::query(
            "INSERT INTO app_meta (cle, valeur, updated_at) VALUES ('local_storage_migrated', '1', ?)
             ON CONFLICT(cle) DO UPDATE SET valeur = '1', updated_at = excluded.updated_at"
        )
        .bind(&now)
        .execute(&mut *conn)
        .await
        .map_err(AppError::DatabaseError)?;

        Ok(report)
    }.await;

    match import_res {
        Ok(rep) => {
            sqlx::query("COMMIT;")
                .execute(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;
            Ok(rep)
        }
        Err(e) => {
            let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
            Err(e)
        }
    }
}

// ============================================================================
// COMMANDES TAURI EXPOSÉES À L'IPC
// ============================================================================

#[command]
pub async fn get_setting(cle: String, state: State<'_, DbState>) -> Result<Option<String>, AppError> {
    execute_get_setting(&state.pool, &cle).await
}

#[command]
pub async fn set_setting(cle: String, valeur: String, state: State<'_, DbState>) -> Result<(), AppError> {
    execute_set_setting(&state.pool, &cle, &valeur).await
}

#[command]
pub async fn get_all_settings(state: State<'_, DbState>) -> Result<HashMap<String, String>, AppError> {
    execute_get_all_settings(&state.pool).await
}

#[command]
pub async fn import_legacy_localstorage(
    payload: LegacyImportPayload,
    state: State<'_, DbState>,
) -> Result<LegacyImportReportDto, AppError> {
    execute_import_legacy_localstorage(&state.pool, payload).await
}
