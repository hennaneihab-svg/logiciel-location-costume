use sqlx::{SqlitePool, Row};
use serde::{Deserialize, Serialize};
use tauri::{command, State};
use crate::error::AppError;
use crate::db::DbState;
use crate::commands::{ImmediateTx, recompute_variant_status, today_local, map_sqlite_err};

// ── Modèles Prestataires ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PressingProvider {
    pub id: String,
    pub nom: String,
    pub contact_nom: Option<String>,
    pub telephone: Option<String>,
    pub adresse: Option<String>,
    pub tarif_defaut_centimes: Option<i64>,
    pub delai_defaut_jours: i64,
    pub actif: bool,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreatePressingProviderDto {
    pub nom: String,
    pub contact_nom: Option<String>,
    pub telephone: Option<String>,
    pub adresse: Option<String>,
    pub tarif_defaut_centimes: Option<i64>,
    pub delai_defaut_jours: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdatePressingProviderDto {
    pub id: String,
    pub nom: String,
    pub contact_nom: Option<String>,
    pub telephone: Option<String>,
    pub adresse: Option<String>,
    pub tarif_defaut_centimes: Option<i64>,
    pub delai_defaut_jours: i64,
    pub notes: Option<String>,
}

// ── Modèles Envois ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PressingDispatchDto {
    pub id: String,
    pub numero_envoi: String,
    pub variante_id: String,
    pub article_id: String,
    pub article_name: String,
    pub reference: String,
    pub size: String,
    pub prestataire_id: Option<String>,
    pub prestataire_nom: Option<String>,
    pub location_id: Option<String>,
    pub numero_location: Option<String>,
    pub type_traitement: Option<String>,
    pub motif: Option<String>,
    pub cout_centimes: i64,
    pub statut_paiement_prestataire: String,
    pub date_paiement_prestataire: Option<String>,
    pub date_envoi: String,
    pub date_retour_prevue: String,
    pub date_retour_effective: Option<String>,
    pub statut: String,
    pub notes: Option<String>,
    pub utilisateur_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub has_photo: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreatePressingDispatchDto {
    pub variante_ids: Vec<String>,
    pub prestataire_id: Option<String>,
    pub location_id: Option<String>,
    pub type_traitement: Option<String>,
    pub motif: Option<String>,
    pub cout_centimes: Option<i64>,
    pub date_retour_prevue: String,
    pub force: bool,
    pub notes: Option<String>,
    pub utilisateur_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetPressingPhotoDto {
    pub envoi_id: String,
    pub mime: Option<String>,
    pub data_base64: String,
    pub thumb_base64: String,
}

// ── Helpers Numérotation & Configuration ───────────────────────────────────

pub async fn next_pressing_number_for_date(
    conn: &mut sqlx::SqliteConnection,
    date_str: &str,
) -> Result<(String, i64), AppError> {
    let year = if date_str.len() >= 4 {
        &date_str[0..4]
    } else {
        "2026"
    };

    let key = format!("dernier_numero_pressing_{}", year);
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT OR IGNORE INTO app_meta (cle, valeur, updated_at) VALUES (?, '0', ?)"
    )
    .bind(&key)
    .bind(&now)
    .execute(&mut *conn)
    .await
    .map_err(map_sqlite_err)?;

    sqlx::query(
        "UPDATE app_meta SET valeur = CAST(valeur AS INTEGER) + 1, updated_at = ? WHERE cle = ?"
    )
    .bind(&now)
    .bind(&key)
    .execute(&mut *conn)
    .await
    .map_err(map_sqlite_err)?;

    let meta_row: (String,) = sqlx::query_as("SELECT valeur FROM app_meta WHERE cle = ?")
        .bind(&key)
        .fetch_one(&mut *conn)
        .await
        .map_err(map_sqlite_err)?;

    let seq_num: i64 = meta_row.0.parse().unwrap_or(1);
    let dispatch_number = format!("PRS-{}-{:04}", year, seq_num);
    Ok((dispatch_number, seq_num))
}

// ── Fonctions Prestataires ─────────────────────────────────────────────────

pub async fn execute_create_pressing_provider(
    pool: &SqlitePool,
    dto: CreatePressingProviderDto,
) -> Result<PressingProvider, AppError> {
    let nom = dto.nom.trim();
    if nom.is_empty() {
        return Err(AppError::Validation("Le nom du prestataire est obligatoire.".to_string()));
    }

    let mut tx = ImmediateTx::begin(pool).await?;
    let id = format!("prs-prv-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let now = chrono::Utc::now().to_rfc3339();
    let delai = dto.delai_defaut_jours.unwrap_or(3).max(1);

    match async {
        sqlx::query(
            "INSERT INTO pressing_prestataires (
                id, nom, contact_nom, telephone, adresse, tarif_defaut_centimes,
                delai_defaut_jours, actif, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)"
        )
        .bind(&id)
        .bind(nom)
        .bind(&dto.contact_nom)
        .bind(&dto.telephone)
        .bind(&dto.adresse)
        .bind(dto.tarif_defaut_centimes)
        .bind(delai)
        .bind(&dto.notes)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        Ok(())
    }.await {
        Ok(_) => {
            tx.commit().await?;
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    }

    Ok(PressingProvider {
        id,
        nom: nom.to_string(),
        contact_nom: dto.contact_nom,
        telephone: dto.telephone,
        adresse: dto.adresse,
        tarif_defaut_centimes: dto.tarif_defaut_centimes,
        delai_defaut_jours: delai,
        actif: true,
        notes: dto.notes,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub async fn execute_update_pressing_provider(
    pool: &SqlitePool,
    dto: UpdatePressingProviderDto,
) -> Result<PressingProvider, AppError> {
    let nom = dto.nom.trim();
    if nom.is_empty() {
        return Err(AppError::Validation("Le nom du prestataire est obligatoire.".to_string()));
    }

    let mut tx = ImmediateTx::begin(pool).await?;
    let now = chrono::Utc::now().to_rfc3339();
    let delai = dto.delai_defaut_jours.max(1);

    let provider = match async {
        let rows_affected = sqlx::query(
            "UPDATE pressing_prestataires SET
                nom = ?, contact_nom = ?, telephone = ?, adresse = ?,
                tarif_defaut_centimes = ?, delai_defaut_jours = ?, notes = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(nom)
        .bind(&dto.contact_nom)
        .bind(&dto.telephone)
        .bind(&dto.adresse)
        .bind(dto.tarif_defaut_centimes)
        .bind(delai)
        .bind(&dto.notes)
        .bind(&now)
        .bind(&dto.id)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?
        .rows_affected();

        if rows_affected == 0 {
            return Err(AppError::NotFound(format!("Prestataire introuvable : {}", dto.id)));
        }

        let row = sqlx::query(
            "SELECT id, nom, contact_nom, telephone, adresse, tarif_defaut_centimes,
                    delai_defaut_jours, actif, notes, created_at, updated_at
             FROM pressing_prestataires WHERE id = ?"
        )
        .bind(&dto.id)
        .fetch_one(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        let actif_int: i64 = row.get("actif");
        Ok(PressingProvider {
            id: row.get("id"),
            nom: row.get("nom"),
            contact_nom: row.get("contact_nom"),
            telephone: row.get("telephone"),
            adresse: row.get("adresse"),
            tarif_defaut_centimes: row.get("tarif_defaut_centimes"),
            delai_defaut_jours: row.get("delai_defaut_jours"),
            actif: actif_int == 1,
            notes: row.get("notes"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }.await {
        Ok(p) => {
            tx.commit().await?;
            p
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    Ok(provider)
}

pub async fn execute_set_pressing_provider_active(
    pool: &SqlitePool,
    id: &str,
    actif: bool,
) -> Result<(), AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;
    let now = chrono::Utc::now().to_rfc3339();
    let actif_val = if actif { 1 } else { 0 };

    match async {
        let rows_affected = sqlx::query(
            "UPDATE pressing_prestataires SET actif = ?, updated_at = ? WHERE id = ?"
        )
        .bind(actif_val)
        .bind(&now)
        .bind(id)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?
        .rows_affected();

        if rows_affected == 0 {
            return Err(AppError::NotFound(format!("Prestataire introuvable : {}", id)));
        }

        Ok(())
    }.await {
        Ok(_) => {
            tx.commit().await?;
            Ok(())
        }
        Err(e) => {
            let _ = tx.rollback().await;
            Err(e)
        }
    }
}

pub async fn execute_list_pressing_providers(
    pool: &SqlitePool,
    only_active: bool,
) -> Result<Vec<PressingProvider>, AppError> {
    let query_str = if only_active {
        "SELECT id, nom, contact_nom, telephone, adresse, tarif_defaut_centimes,
                delai_defaut_jours, actif, notes, created_at, updated_at
         FROM pressing_prestataires WHERE actif = 1 ORDER BY nom ASC"
    } else {
        "SELECT id, nom, contact_nom, telephone, adresse, tarif_defaut_centimes,
                delai_defaut_jours, actif, notes, created_at, updated_at
         FROM pressing_prestataires ORDER BY actif DESC, nom ASC"
    };

    let rows = sqlx::query(query_str)
        .fetch_all(pool)
        .await
        .map_err(map_sqlite_err)?;

    let mut list = Vec::new();
    for row in rows {
        let actif_int: i64 = row.get("actif");
        list.push(PressingProvider {
            id: row.get("id"),
            nom: row.get("nom"),
            contact_nom: row.get("contact_nom"),
            telephone: row.get("telephone"),
            adresse: row.get("adresse"),
            tarif_defaut_centimes: row.get("tarif_defaut_centimes"),
            delai_defaut_jours: row.get("delai_defaut_jours"),
            actif: actif_int == 1,
            notes: row.get("notes"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        });
    }

    Ok(list)
}

// ── Fonctions Envois Pressing ──────────────────────────────────────────────

pub async fn execute_create_pressing_dispatch(
    pool: &SqlitePool,
    dto: CreatePressingDispatchDto,
) -> Result<Vec<PressingDispatchDto>, AppError> {
    if dto.variante_ids.is_empty() {
        return Err(AppError::Validation("Au moins une pièce doit être sélectionnée.".to_string()));
    }

    let mut tx = ImmediateTx::begin(pool).await?;

    let created_ids = match async {
        // Résolution utilisateur
        let user_id = if let Some(ref uid) = dto.utilisateur_id {
            if !uid.trim().is_empty() {
                let user_exists: Option<(String,)> = sqlx::query_as(
                    "SELECT id FROM utilisateurs WHERE id = ? AND est_actif = 1"
                )
                .bind(uid)
                .fetch_optional(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?;

                if user_exists.is_none() {
                    return Err(AppError::Validation(format!("Utilisateur introuvable ou inactif : {}", uid)));
                }
                uid.clone()
            } else {
                "usr-001".to_string()
            }
        } else {
            "usr-001".to_string()
        };

        // Vérification du prestataire si fourni
        if let Some(ref prv_id) = dto.prestataire_id {
            let prv_exists: Option<(String,)> = sqlx::query_as(
                "SELECT id FROM pressing_prestataires WHERE id = ? AND actif = 1"
            )
            .bind(prv_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            if prv_exists.is_none() {
                return Err(AppError::Validation(format!("Prestataire de pressing introuvable ou inactif : {}", prv_id)));
            }
        }

        let today = today_local();
        let now = chrono::Utc::now().to_rfc3339();
        let mut ids = Vec::new();

        for var_id in &dto.variante_ids {
            // 1. Récupérer variante et article
            let var_row = sqlx::query(
                "SELECT v.id, v.article_id, v.taille, a.nom as article_nom, a.reference as article_ref
                 FROM variantes_stock v
                 JOIN articles a ON v.article_id = a.id
                 WHERE v.id = ?"
            )
            .bind(var_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::Validation(format!("Variante introuvable : {}", var_id)))?;

            let art_nom: String = var_row.get("article_nom");
            let _art_ref: String = var_row.get("article_ref");

            // 2. Refus si la variante est actuellement en cours de location
            let active_rental = sqlx::query(
                "SELECT l.numero_location
                 FROM lignes_location ll
                 JOIN locations l ON ll.location_id = l.id
                 WHERE ll.variante_id = ?
                   AND ll.est_rendu = 0
                   AND l.statut IN ('en_cours', 'en_retard', 'litige')
                 LIMIT 1"
            )
            .bind(var_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            if let Some(r) = active_rental {
                let num_loc: String = r.get("numero_location");
                return Err(AppError::Validation(format!(
                    "La pièce '{}' est actuellement sortie sur le contrat {} (non rendue). Envoi pressing impossible.",
                    art_nom, num_loc
                )));
            }

            // 3. Vérification des réservations futures en conflit
            let future_conflict = sqlx::query(
                "SELECT l.numero_location, l.date_retrait_prevue
                 FROM lignes_location ll
                 JOIN locations l ON ll.location_id = l.id
                 WHERE ll.variante_id = ?
                   AND ll.est_rendu = 0
                   AND l.statut = 'reserve'
                   AND l.date_retrait_prevue < ?
                 ORDER BY l.date_retrait_prevue ASC
                 LIMIT 1"
            )
            .bind(var_id)
            .bind(&dto.date_retour_prevue)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            let mut item_notes = dto.notes.clone().unwrap_or_default();
            if let Some(fc) = future_conflict {
                let c_num: String = fc.get("numero_location");
                let c_pickup: String = fc.get("date_retrait_prevue");

                if !dto.force {
                    return Err(AppError::Validation(format!(
                        "Conflit de date pour '{}' : réservée pour le contrat {} dès le {}, avant la date de retour prévue du pressing ({}). Confirmez avec 'force' pour déroger.",
                        art_nom, c_num, c_pickup, dto.date_retour_prevue
                    )));
                } else {
                    let warning_note = format!("[ATTENTION: Envoi forcé malgré réservation {} au {}] ", c_num, c_pickup);
                    item_notes = format!("{}{}", warning_note, item_notes);
                }
            }

            // 4. Numérotation et enregistrement
            let (num_envoi, _) = next_pressing_number_for_date(&mut *tx.conn, &today).await?;
            let envoi_id = format!("prs-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));

            sqlx::query(
                "INSERT INTO pressing_envois (
                    id, numero_envoi, variante_id, prestataire_id, location_id,
                    type_traitement, motif, cout_centimes, statut_paiement_prestataire,
                    date_paiement_prestataire, date_envoi, date_retour_prevue,
                    date_retour_effective, statut, notes, utilisateur_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'a_payer', NULL, ?, ?, NULL, 'envoye', ?, ?, ?, ?)"
            )
            .bind(&envoi_id)
            .bind(&num_envoi)
            .bind(var_id)
            .bind(&dto.prestataire_id)
            .bind(&dto.location_id)
            .bind(&dto.type_traitement)
            .bind(&dto.motif)
            .bind(dto.cout_centimes.unwrap_or(0))
            .bind(&today)
            .bind(&dto.date_retour_prevue)
            .bind(&item_notes)
            .bind(&user_id)
            .bind(&now)
            .bind(&now)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            // 5. Bascule du statut physique de la variante en au_pressing
            sqlx::query("UPDATE variantes_stock SET statut = 'au_pressing', updated_at = ? WHERE id = ?")
                .bind(&now)
                .bind(var_id)
                .execute(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?;

            ids.push(envoi_id);
        }

        Ok(ids)
    }.await {
        Ok(ids) => {
            tx.commit().await?;
            ids
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    // Chargement des DTOs complets
    let mut dispatches = Vec::new();
    for id in created_ids {
        if let Some(dto) = fetch_pressing_dispatch_dto(pool, &id).await? {
            dispatches.push(dto);
        }
    }

    Ok(dispatches)
}

pub async fn execute_receive_pressing_dispatch(
    pool: &SqlitePool,
    envoi_id: &str,
    date_retour_effective: Option<String>,
    notes: Option<String>,
) -> Result<PressingDispatchDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    match async {
        let row = sqlx::query("SELECT id, variante_id, statut, notes FROM pressing_envois WHERE id = ?")
            .bind(envoi_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::NotFound(format!("Envoi pressing introuvable : {}", envoi_id)))?;

        let cur_statut: String = row.get("statut");
        let var_id: String = row.get("variante_id");
        let cur_notes: Option<String> = row.get("notes");

        if matches!(cur_statut.as_str(), "recu" | "annule") {
            return Err(AppError::Validation(format!(
                "Impossible de réceptionner un envoi au statut '{}'.",
                cur_statut
            )));
        }

        let today = today_local();
        let ret_eff = date_retour_effective.unwrap_or(today);
        let now = chrono::Utc::now().to_rfc3339();

        let merged_notes = match (cur_notes, notes) {
            (Some(c), Some(n)) if !n.trim().is_empty() => Some(format!("{} | Réception: {}", c, n)),
            (None, Some(n)) if !n.trim().is_empty() => Some(format!("Réception: {}", n)),
            (c, _) => c,
        };

        sqlx::query(
            "UPDATE pressing_envois SET
                statut = 'recu', date_retour_effective = ?, notes = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&ret_eff)
        .bind(&merged_notes)
        .bind(&now)
        .bind(envoi_id)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        // Libère la variante du statut physique au_pressing vers disponible
        sqlx::query("UPDATE variantes_stock SET statut = 'disponible', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(&var_id)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        // Recalcule le statut réel (disponible ou reserve si contrat futur)
        recompute_variant_status(&mut *tx.conn, &var_id).await?;

        Ok(())
    }.await {
        Ok(_) => {
            tx.commit().await?;
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    }

    fetch_pressing_dispatch_dto(pool, envoi_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Envoi introuvable après réception : {}", envoi_id)))
}

pub async fn execute_mark_pressing_problem(
    pool: &SqlitePool,
    envoi_id: &str,
    notes: Option<String>,
) -> Result<PressingDispatchDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    match async {
        let row = sqlx::query("SELECT id, variante_id, notes FROM pressing_envois WHERE id = ?")
            .bind(envoi_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::NotFound(format!("Envoi pressing introuvable : {}", envoi_id)))?;

        let var_id: String = row.get("variante_id");
        let cur_notes: Option<String> = row.get("notes");
        let now = chrono::Utc::now().to_rfc3339();

        let merged_notes = match (cur_notes, notes) {
            (Some(c), Some(n)) if !n.trim().is_empty() => Some(format!("{} | PROBLÈME: {}", c, n)),
            (None, Some(n)) if !n.trim().is_empty() => Some(format!("PROBLÈME: {}", n)),
            (c, _) => c,
        };

        sqlx::query(
            "UPDATE pressing_envois SET statut = 'probleme', notes = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&merged_notes)
        .bind(&now)
        .bind(envoi_id)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        // Ne pas libérer la variante : statut physique devient indisponible
        sqlx::query("UPDATE variantes_stock SET statut = 'indisponible', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(&var_id)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        Ok(())
    }.await {
        Ok(_) => {
            tx.commit().await?;
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    }

    fetch_pressing_dispatch_dto(pool, envoi_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Envoi introuvable après signalement problème : {}", envoi_id)))
}

pub async fn execute_cancel_pressing_dispatch(
    pool: &SqlitePool,
    envoi_id: &str,
) -> Result<PressingDispatchDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    match async {
        let row = sqlx::query("SELECT id, variante_id, statut FROM pressing_envois WHERE id = ?")
            .bind(envoi_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::NotFound(format!("Envoi pressing introuvable : {}", envoi_id)))?;

        let cur_statut: String = row.get("statut");
        let var_id: String = row.get("variante_id");

        if cur_statut != "envoye" {
            return Err(AppError::Validation(format!(
                "Seul un envoi au statut 'envoye' peut être annulé (statut actuel : '{}').",
                cur_statut
            )));
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE pressing_envois SET statut = 'annule', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(envoi_id)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        // Libère la variante du statut au_pressing et recalcul
        sqlx::query("UPDATE variantes_stock SET statut = 'disponible', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(&var_id)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        recompute_variant_status(&mut *tx.conn, &var_id).await?;

        Ok(())
    }.await {
        Ok(_) => {
            tx.commit().await?;
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    }

    fetch_pressing_dispatch_dto(pool, envoi_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Envoi introuvable après annulation : {}", envoi_id)))
}

pub async fn execute_pay_pressing_provider(
    pool: &SqlitePool,
    envoi_id: &str,
    date_paiement: Option<String>,
) -> Result<PressingDispatchDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    match async {
        let today = today_local();
        let pay_date = date_paiement.unwrap_or(today);
        let now = chrono::Utc::now().to_rfc3339();

        let rows_affected = sqlx::query(
            "UPDATE pressing_envois SET
                statut_paiement_prestataire = 'paye', date_paiement_prestataire = ?, updated_at = ?
             WHERE id = ?"
        )
        .bind(&pay_date)
        .bind(&now)
        .bind(envoi_id)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?
        .rows_affected();

        if rows_affected == 0 {
            return Err(AppError::NotFound(format!("Envoi pressing introuvable : {}", envoi_id)));
        }

        Ok(())
    }.await {
        Ok(_) => {
            tx.commit().await?;
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    }

    fetch_pressing_dispatch_dto(pool, envoi_id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Envoi introuvable après règlement : {}", envoi_id)))
}

pub async fn execute_list_pressing_dispatches(
    pool: &SqlitePool,
    statut: Option<String>,
    prestataire_id: Option<String>,
    variante_id: Option<String>,
    date_debut: Option<String>,
    date_fin: Option<String>,
) -> Result<Vec<PressingDispatchDto>, AppError> {
    let mut sql = String::from(
        "SELECT e.id, e.numero_envoi, e.variante_id, e.prestataire_id, e.location_id,
                e.type_traitement, e.motif, e.cout_centimes, e.statut_paiement_prestataire,
                e.date_paiement_prestataire, e.date_envoi, e.date_retour_prevue,
                e.date_retour_effective, e.statut, e.notes, e.utilisateur_id,
                e.created_at, e.updated_at,
                p.nom as prestataire_nom,
                l.numero_location,
                v.article_id, v.taille,
                a.nom as article_nom, a.reference as article_ref,
                (SELECT COUNT(*) FROM pressing_envoi_photos ep WHERE ep.envoi_id = e.id) as photos_count
         FROM pressing_envois e
         LEFT JOIN pressing_prestataires p ON e.prestataire_id = p.id
         LEFT JOIN locations l ON e.location_id = l.id
         JOIN variantes_stock v ON e.variante_id = v.id
         JOIN articles a ON v.article_id = a.id
         WHERE 1=1"
    );

    if let Some(ref s) = statut {
        if !s.is_empty() && s != "all" {
            sql.push_str(&format!(" AND e.statut = '{}'", s));
        }
    }
    if let Some(ref p) = prestataire_id {
        if !p.is_empty() && p != "all" {
            if p == "interne" {
                sql.push_str(" AND e.prestataire_id IS NULL");
            } else {
                sql.push_str(&format!(" AND e.prestataire_id = '{}'", p));
            }
        }
    }
    if let Some(ref v) = variante_id {
        if !v.is_empty() {
            sql.push_str(&format!(" AND e.variante_id = '{}'", v));
        }
    }
    if let Some(ref d1) = date_debut {
        if !d1.is_empty() {
            sql.push_str(&format!(" AND e.date_envoi >= '{}'", d1));
        }
    }
    if let Some(ref d2) = date_fin {
        if !d2.is_empty() {
            sql.push_str(&format!(" AND e.date_envoi <= '{}'", d2));
        }
    }

    sql.push_str(" ORDER BY e.date_envoi DESC, e.created_at DESC");

    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(map_sqlite_err)?;

    let mut list = Vec::new();
    for row in rows {
        let photos_count: i64 = row.get("photos_count");
        list.push(PressingDispatchDto {
            id: row.get("id"),
            numero_envoi: row.get("numero_envoi"),
            variante_id: row.get("variante_id"),
            article_id: row.get("article_id"),
            article_name: row.get("article_nom"),
            reference: row.get("article_ref"),
            size: row.get("taille"),
            prestataire_id: row.get("prestataire_id"),
            prestataire_nom: row.get("prestataire_nom"),
            location_id: row.get("location_id"),
            numero_location: row.get("numero_location"),
            type_traitement: row.get("type_traitement"),
            motif: row.get("motif"),
            cout_centimes: row.get("cout_centimes"),
            statut_paiement_prestataire: row.get("statut_paiement_prestataire"),
            date_paiement_prestataire: row.get("date_paiement_prestataire"),
            date_envoi: row.get("date_envoi"),
            date_retour_prevue: row.get("date_retour_prevue"),
            date_retour_effective: row.get("date_retour_effective"),
            statut: row.get("statut"),
            notes: row.get("notes"),
            utilisateur_id: row.get("utilisateur_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            has_photo: photos_count > 0,
        });
    }

    Ok(list)
}

pub async fn execute_get_pressing_history_for_variant(
    pool: &SqlitePool,
    variante_id: &str,
) -> Result<Vec<PressingDispatchDto>, AppError> {
    execute_list_pressing_dispatches(pool, None, None, Some(variante_id.to_string()), None, None).await
}

pub async fn fetch_pressing_dispatch_dto(
    pool: &SqlitePool,
    envoi_id: &str,
) -> Result<Option<PressingDispatchDto>, AppError> {
    let row = sqlx::query(
        "SELECT e.id, e.numero_envoi, e.variante_id, e.prestataire_id, e.location_id,
                e.type_traitement, e.motif, e.cout_centimes, e.statut_paiement_prestataire,
                e.date_paiement_prestataire, e.date_envoi, e.date_retour_prevue,
                e.date_retour_effective, e.statut, e.notes, e.utilisateur_id,
                e.created_at, e.updated_at,
                p.nom as prestataire_nom,
                l.numero_location,
                v.article_id, v.taille,
                a.nom as article_nom, a.reference as article_ref,
                (SELECT COUNT(*) FROM pressing_envoi_photos ep WHERE ep.envoi_id = e.id) as photos_count
         FROM pressing_envois e
         LEFT JOIN pressing_prestataires p ON e.prestataire_id = p.id
         LEFT JOIN locations l ON e.location_id = l.id
         JOIN variantes_stock v ON e.variante_id = v.id
         JOIN articles a ON v.article_id = a.id
         WHERE e.id = ?"
    )
    .bind(envoi_id)
    .fetch_optional(pool)
    .await
    .map_err(map_sqlite_err)?;

    if let Some(row) = row {
        let photos_count: i64 = row.get("photos_count");
        Ok(Some(PressingDispatchDto {
            id: row.get("id"),
            numero_envoi: row.get("numero_envoi"),
            variante_id: row.get("variante_id"),
            article_id: row.get("article_id"),
            article_name: row.get("article_nom"),
            reference: row.get("article_ref"),
            size: row.get("taille"),
            prestataire_id: row.get("prestataire_id"),
            prestataire_nom: row.get("prestataire_nom"),
            location_id: row.get("location_id"),
            numero_location: row.get("numero_location"),
            type_traitement: row.get("type_traitement"),
            motif: row.get("motif"),
            cout_centimes: row.get("cout_centimes"),
            statut_paiement_prestataire: row.get("statut_paiement_prestataire"),
            date_paiement_prestataire: row.get("date_paiement_prestataire"),
            date_envoi: row.get("date_envoi"),
            date_retour_prevue: row.get("date_retour_prevue"),
            date_retour_effective: row.get("date_retour_effective"),
            statut: row.get("statut"),
            notes: row.get("notes"),
            utilisateur_id: row.get("utilisateur_id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            has_photo: photos_count > 0,
        }))
    } else {
        Ok(None)
    }
}

// ── Fonctions Photos Pressing ──────────────────────────────────────────────

pub async fn execute_set_pressing_photo(
    pool: &SqlitePool,
    dto: SetPressingPhotoDto,
) -> Result<(), AppError> {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;

    let data_bytes = engine
        .decode(&dto.data_base64)
        .map_err(|e| AppError::Validation(format!("Données photo base64 invalides : {}", e)))?;
    let thumb_bytes = engine
        .decode(&dto.thumb_base64)
        .map_err(|e| AppError::Validation(format!("Miniature base64 invalide : {}", e)))?;

    let photo_id = format!("prs-pht-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let now = chrono::Utc::now().to_rfc3339();
    let mime = dto.mime.unwrap_or_else(|| "image/webp".to_string());

    let mut tx = ImmediateTx::begin(pool).await?;

    // Remplacement photo
    sqlx::query("DELETE FROM pressing_envoi_photos WHERE envoi_id = ?")
        .bind(&dto.envoi_id)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

    sqlx::query(
        "INSERT INTO pressing_envoi_photos (id, envoi_id, mime, data, thumb, created_at)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&photo_id)
    .bind(&dto.envoi_id)
    .bind(&mime)
    .bind(&data_bytes)
    .bind(&thumb_bytes)
    .bind(&now)
    .execute(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    tx.commit().await?;
    Ok(())
}

pub async fn execute_get_pressing_photo_thumb(
    pool: &SqlitePool,
    envoi_id: &str,
) -> Result<Option<String>, AppError> {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;

    let row = sqlx::query("SELECT thumb FROM pressing_envoi_photos WHERE envoi_id = ? LIMIT 1")
        .bind(envoi_id)
        .fetch_optional(pool)
        .await
        .map_err(map_sqlite_err)?;

    if let Some(r) = row {
        let bytes: Vec<u8> = r.get("thumb");
        Ok(Some(engine.encode(bytes)))
    } else {
        Ok(None)
    }
}

pub async fn execute_get_pressing_photo_full(
    pool: &SqlitePool,
    envoi_id: &str,
) -> Result<Option<String>, AppError> {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;

    let row = sqlx::query("SELECT data FROM pressing_envoi_photos WHERE envoi_id = ? LIMIT 1")
        .bind(envoi_id)
        .fetch_optional(pool)
        .await
        .map_err(map_sqlite_err)?;

    if let Some(r) = row {
        let bytes: Vec<u8> = r.get("data");
        Ok(Some(engine.encode(bytes)))
    } else {
        Ok(None)
    }
}

// ── Fonctions Activation Module Pressing ───────────────────────────────────

pub async fn execute_get_pressing_module_active(pool: &SqlitePool) -> Result<bool, AppError> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT valeur FROM app_meta WHERE cle = 'pressing_module_actif'"
    )
    .fetch_optional(pool)
    .await
    .map_err(map_sqlite_err)?;

    if let Some((val,)) = row {
        Ok(val == "1" || val.to_lowercase() == "true")
    } else {
        Ok(true)
    }
}

pub async fn execute_set_pressing_module_active(pool: &SqlitePool, actif: bool) -> Result<(), AppError> {
    let val = if actif { "1" } else { "0" };
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO app_meta (cle, valeur, updated_at) VALUES ('pressing_module_actif', ?, ?)
         ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at"
    )
    .bind(val)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(map_sqlite_err)?;

    Ok(())
}

// ── Tauri Commands ─────────────────────────────────────────────────────────

#[command]
pub async fn create_pressing_provider(
    dto: CreatePressingProviderDto,
    state: State<'_, DbState>,
) -> Result<PressingProvider, AppError> {
    execute_create_pressing_provider(&state.pool, dto).await
}

#[command]
pub async fn update_pressing_provider(
    dto: UpdatePressingProviderDto,
    state: State<'_, DbState>,
) -> Result<PressingProvider, AppError> {
    execute_update_pressing_provider(&state.pool, dto).await
}

#[command]
pub async fn deactivate_pressing_provider(
    id: String,
    state: State<'_, DbState>,
) -> Result<(), AppError> {
    execute_set_pressing_provider_active(&state.pool, &id, false).await
}

#[command]
pub async fn reactivate_pressing_provider(
    id: String,
    state: State<'_, DbState>,
) -> Result<(), AppError> {
    execute_set_pressing_provider_active(&state.pool, &id, true).await
}

#[command]
pub async fn list_pressing_providers(
    only_active: Option<bool>,
    state: State<'_, DbState>,
) -> Result<Vec<PressingProvider>, AppError> {
    execute_list_pressing_providers(&state.pool, only_active.unwrap_or(false)).await
}

#[command]
pub async fn create_pressing_dispatch(
    dto: CreatePressingDispatchDto,
    state: State<'_, DbState>,
) -> Result<Vec<PressingDispatchDto>, AppError> {
    execute_create_pressing_dispatch(&state.pool, dto).await
}

#[command]
pub async fn receive_pressing_dispatch(
    envoi_id: String,
    date_retour_effective: Option<String>,
    notes: Option<String>,
    state: State<'_, DbState>,
) -> Result<PressingDispatchDto, AppError> {
    execute_receive_pressing_dispatch(&state.pool, &envoi_id, date_retour_effective, notes).await
}

#[command]
pub async fn mark_pressing_problem(
    envoi_id: String,
    notes: Option<String>,
    state: State<'_, DbState>,
) -> Result<PressingDispatchDto, AppError> {
    execute_mark_pressing_problem(&state.pool, &envoi_id, notes).await
}

#[command]
pub async fn cancel_pressing_dispatch(
    envoi_id: String,
    state: State<'_, DbState>,
) -> Result<PressingDispatchDto, AppError> {
    execute_cancel_pressing_dispatch(&state.pool, &envoi_id).await
}

#[command]
pub async fn pay_pressing_provider(
    envoi_id: String,
    date_paiement: Option<String>,
    state: State<'_, DbState>,
) -> Result<PressingDispatchDto, AppError> {
    execute_pay_pressing_provider(&state.pool, &envoi_id, date_paiement).await
}

#[command]
pub async fn list_pressing_dispatches(
    statut: Option<String>,
    prestataire_id: Option<String>,
    variante_id: Option<String>,
    date_debut: Option<String>,
    date_fin: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<PressingDispatchDto>, AppError> {
    execute_list_pressing_dispatches(&state.pool, statut, prestataire_id, variante_id, date_debut, date_fin).await
}

#[command]
pub async fn get_pressing_history_for_variant(
    variante_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<PressingDispatchDto>, AppError> {
    execute_get_pressing_history_for_variant(&state.pool, &variante_id).await
}

#[command]
pub async fn set_pressing_photo(
    dto: SetPressingPhotoDto,
    state: State<'_, DbState>,
) -> Result<(), AppError> {
    execute_set_pressing_photo(&state.pool, dto).await
}

#[command]
pub async fn get_pressing_photo_thumb(
    envoi_id: String,
    state: State<'_, DbState>,
) -> Result<Option<String>, AppError> {
    execute_get_pressing_photo_thumb(&state.pool, &envoi_id).await
}

#[command]
pub async fn get_pressing_photo_full(
    envoi_id: String,
    state: State<'_, DbState>,
) -> Result<Option<String>, AppError> {
    execute_get_pressing_photo_full(&state.pool, &envoi_id).await
}

#[command]
pub async fn get_pressing_module_active(
    state: State<'_, DbState>,
) -> Result<bool, AppError> {
    execute_get_pressing_module_active(&state.pool).await
}

#[command]
pub async fn set_pressing_module_active(
    actif: bool,
    state: State<'_, DbState>,
) -> Result<(), AppError> {
    execute_set_pressing_module_active(&state.pool, actif).await
}
