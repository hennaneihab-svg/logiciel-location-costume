use sqlx::{SqlitePool, Row};
use serde::{Deserialize, Serialize};
use tauri::{command, State};
use crate::error::AppError;
use crate::db::DbState;
use crate::models::{
    ClientMensurations, CreateMensurationsDto, MensurationSearchFilterDto,
    EssaiCabineDetailDto, CreateEssaiCabineDto, FinishEssaiCabineDto,
};

use crate::commands::{ImmediateTx, recompute_variant_status, today_local, map_sqlite_err};
use crate::commands::pressing::next_pressing_number_for_date;

// ============================================================================
// MOD-2 : MENSURATIONS CLIENT STRUCTURÉES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientWithActiveMensurationsDto {
    pub id: String,
    pub prenom: String,
    pub nom: String,
    pub email: Option<String>,
    pub telephone: String,
    pub ville: Option<String>,
    pub tour_poitrine: Option<f64>,
    pub tour_taille: Option<f64>,
    pub tour_hanches: Option<f64>,
    pub stature: Option<f64>,
    pub pointure: Option<f64>,
    pub date_mesure: Option<String>,
}

pub async fn execute_create_client_mensurations(
    pool: &SqlitePool,
    client_id: &str,
    dto: CreateMensurationsDto,
) -> Result<ClientMensurations, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    // 1. Vérifier que le client existe
    let client_exists: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM clients WHERE id = ?"
    )
    .bind(client_id)
    .fetch_optional(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    if client_exists.is_none() {
        return Err(AppError::NotFound(format!("Client introuvable : {}", client_id)));
    }

    // 2. Archiver les anciennes mensurations pour ce client
    sqlx::query(
        "UPDATE client_mensurations SET est_actuel = 0 WHERE client_id = ?"
    )
    .bind(client_id)
    .execute(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    // 3. Insérer la nouvelle mensuration active
    let id = format!("men-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let now = chrono::Utc::now().to_rfc3339();
    let date_mesure = dto.date_mesure.unwrap_or_else(today_local);

    sqlx::query(
        "INSERT INTO client_mensurations (
            id, client_id, tour_poitrine, tour_taille, tour_hanches,
            longueur_bras, longueur_jambe, tour_cou, pointure, stature,
            notes_mensurations, date_mesure, est_actuel, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)"
    )
    .bind(&id)
    .bind(client_id)
    .bind(dto.tour_poitrine)
    .bind(dto.tour_taille)
    .bind(dto.tour_hanches)
    .bind(dto.longueur_bras)
    .bind(dto.longueur_jambe)
    .bind(dto.tour_cou)
    .bind(dto.pointure)
    .bind(dto.stature)
    .bind(&dto.notes_mensurations)
    .bind(&date_mesure)
    .bind(&now)
    .execute(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    tx.commit().await?;

    Ok(ClientMensurations {
        id,
        client_id: client_id.to_string(),
        tour_poitrine: dto.tour_poitrine,
        tour_taille: dto.tour_taille,
        tour_hanches: dto.tour_hanches,
        longueur_bras: dto.longueur_bras,
        longueur_jambe: dto.longueur_jambe,
        tour_cou: dto.tour_cou,
        pointure: dto.pointure,
        stature: dto.stature,
        notes_mensurations: dto.notes_mensurations,
        date_mesure,
        est_actuel: 1,
        created_at: now,
    })
}

pub async fn execute_get_client_mensurations_active(
    pool: &SqlitePool,
    client_id: &str,
) -> Result<Option<ClientMensurations>, AppError> {
    let row = sqlx::query_as::<_, ClientMensurations>(
        "SELECT id, client_id, tour_poitrine, tour_taille, tour_hanches,
                longueur_bras, longueur_jambe, tour_cou, pointure, stature,
                notes_mensurations, date_mesure, est_actuel, created_at
         FROM client_mensurations
         WHERE client_id = ? AND est_actuel = 1
         LIMIT 1"
    )
    .bind(client_id)
    .fetch_optional(pool)
    .await
    .map_err(map_sqlite_err)?;

    Ok(row)
}

pub async fn execute_get_client_mensurations_history(
    pool: &SqlitePool,
    client_id: &str,
) -> Result<Vec<ClientMensurations>, AppError> {
    let rows = sqlx::query_as::<_, ClientMensurations>(
        "SELECT id, client_id, tour_poitrine, tour_taille, tour_hanches,
                longueur_bras, longueur_jambe, tour_cou, pointure, stature,
                notes_mensurations, date_mesure, est_actuel, created_at
         FROM client_mensurations
         WHERE client_id = ?
         ORDER BY date_mesure DESC, created_at DESC"
    )
    .bind(client_id)
    .fetch_all(pool)
    .await
    .map_err(map_sqlite_err)?;

    Ok(rows)
}

pub async fn execute_search_clients_by_mensurations(
    pool: &SqlitePool,
    filters: MensurationSearchFilterDto,
) -> Result<Vec<ClientWithActiveMensurationsDto>, AppError> {
    let mut sql = String::from(
        "SELECT c.id, c.prenom, c.nom, c.email, c.telephone, c.ville,
                m.tour_poitrine, m.tour_taille, m.tour_hanches, m.stature, m.pointure, m.date_mesure
         FROM clients c
         JOIN client_mensurations m ON c.id = m.client_id AND m.est_actuel = 1
         WHERE 1=1"
    );

    if let Some(min_tp) = filters.min_tour_poitrine {
        sql.push_str(&format!(" AND m.tour_poitrine >= {}", min_tp));
    }
    if let Some(max_tp) = filters.max_tour_poitrine {
        sql.push_str(&format!(" AND m.tour_poitrine <= {}", max_tp));
    }
    if let Some(min_tt) = filters.min_tour_taille {
        sql.push_str(&format!(" AND m.tour_taille >= {}", min_tt));
    }
    if let Some(max_tt) = filters.max_tour_taille {
        sql.push_str(&format!(" AND m.tour_taille <= {}", max_tt));
    }
    if let Some(min_th) = filters.min_tour_hanches {
        sql.push_str(&format!(" AND m.tour_hanches >= {}", min_th));
    }
    if let Some(max_th) = filters.max_tour_hanches {
        sql.push_str(&format!(" AND m.tour_hanches <= {}", max_th));
    }
    if let Some(min_st) = filters.min_stature {
        sql.push_str(&format!(" AND m.stature >= {}", min_st));
    }
    if let Some(max_st) = filters.max_stature {
        sql.push_str(&format!(" AND m.stature <= {}", max_st));
    }
    if let Some(min_pt) = filters.min_pointure {
        sql.push_str(&format!(" AND m.pointure >= {}", min_pt));
    }
    if let Some(max_pt) = filters.max_pointure {
        sql.push_str(&format!(" AND m.pointure <= {}", max_pt));
    }

    sql.push_str(" ORDER BY c.nom ASC, c.prenom ASC LIMIT 100");

    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(map_sqlite_err)?;

    let mut result = Vec::new();
    for r in rows {
        result.push(ClientWithActiveMensurationsDto {
            id: r.get("id"),
            prenom: r.get("prenom"),
            nom: r.get("nom"),
            email: r.get("email"),
            telephone: r.get("telephone"),
            ville: r.get("ville"),
            tour_poitrine: r.get("tour_poitrine"),
            tour_taille: r.get("tour_taille"),
            tour_hanches: r.get("tour_hanches"),
            stature: r.get("stature"),
            pointure: r.get("pointure"),
            date_mesure: r.get("date_mesure"),
        });
    }

    Ok(result)
}

// ============================================================================
// MOD-3 : ÉTAPE ESSAYAGE EN CABINE
// ============================================================================

pub async fn next_essai_number_for_date(
    conn: &mut sqlx::SqliteConnection,
    date_str: &str,
) -> Result<(String, i64), AppError> {
    let year = if date_str.len() >= 4 {
        &date_str[0..4]
    } else {
        "2026"
    };

    let key = format!("dernier_numero_essai_{}", year);
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

    let row = sqlx::query("SELECT CAST(valeur AS INTEGER) as seq FROM app_meta WHERE cle = ?")
        .bind(&key)
        .fetch_one(&mut *conn)
        .await
        .map_err(map_sqlite_err)?;

    let seq: i64 = row.get("seq");
    let num = format!("ESS-{}-{:04}", year, seq);
    Ok((num, seq))
}

pub async fn execute_create_essai_cabine(
    pool: &SqlitePool,
    dto: CreateEssaiCabineDto,
) -> Result<EssaiCabineDetailDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    // 1. Vérifier que la variante existe et récupérer les détails
    let var_row = sqlx::query(
        "SELECT v.id, v.article_id, v.taille, v.statut, a.nom as article_nom, a.reference as article_ref
         FROM variantes_stock v
         JOIN articles a ON v.article_id = a.id
         WHERE v.id = ?"
    )
    .bind(&dto.variante_id)
    .fetch_optional(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?
    .ok_or_else(|| AppError::NotFound(format!("Variante introuvable : {}", dto.variante_id)))?;

    let article_id: String = var_row.get("article_id");
    let article_nom: String = var_row.get("article_nom");
    let article_ref: String = var_row.get("article_ref");
    let taille: String = var_row.get("taille");
    let current_var_statut: String = var_row.get("statut");

    if current_var_statut == "vendu" || current_var_statut == "perdu" || current_var_statut == "reforme" {
        return Err(AppError::Validation(format!(
            "La pièce '{}' ne peut pas être essayée (statut physique : {}).",
            article_nom, current_var_statut
        )));
    }

    // 2. Refuser si la pièce est déjà en cours d'essayage
    let active_essai: Option<(String,)> = sqlx::query_as(
        "SELECT numero_essai FROM essais_cabine WHERE variante_id = ? AND statut = 'en_cours' LIMIT 1"
    )
    .bind(&dto.variante_id)
    .fetch_optional(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    if let Some((num,)) = active_essai {
        return Err(AppError::Validation(format!(
            "La pièce '{}' est déjà en cours d'essayage sous le numéro {}.",
            article_nom, num
        )));
    }

    // 3. Refuser si la pièce est sortie en location
    let active_rental = sqlx::query(
        "SELECT l.numero_location
         FROM lignes_location ll
         JOIN locations l ON ll.location_id = l.id
         WHERE ll.variante_id = ? AND ll.est_rendu = 0 AND l.statut IN ('en_cours', 'en_retard', 'litige')
         LIMIT 1"
    )
    .bind(&dto.variante_id)
    .fetch_optional(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    if let Some(ar) = active_rental {
        let num_loc: String = ar.get("numero_location");
        return Err(AppError::Validation(format!(
            "La pièce '{}' est sortie en location sur le contrat {}. Essayage impossible.",
            article_nom, num_loc
        )));
    }

    // 4. Résolution du client
    let mut resolved_client_nom = dto.client_nom_libre.clone();
    if let Some(ref cid) = dto.client_id {
        let c_row = sqlx::query("SELECT prenom, nom FROM clients WHERE id = ?")
            .bind(cid)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        if let Some(crow) = c_row {
            let p: String = crow.get("prenom");
            let n: String = crow.get("nom");
            resolved_client_nom = Some(format!("{} {}", p, n));
        }
    }

    let today = today_local();
    let now = chrono::Utc::now().to_rfc3339();
    let date_debut = dto.date_debut.clone().unwrap_or_else(|| now.clone());
    let date_fin_prevue = dto.date_fin_prevue.clone().unwrap_or_else(|| {
        // Par défaut aujourd'hui ou dans 2 heures
        now.clone()
    });

    let (numero_essai, _) = next_essai_number_for_date(&mut *tx.conn, &today).await?;
    let essai_id = format!("ess-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));

    let user_id = dto.utilisateur_id.clone().unwrap_or_else(|| "usr-001".to_string());

    sqlx::query(
        "INSERT INTO essais_cabine (
            id, numero_essai, variante_id, client_id, client_nom_libre,
            date_debut, date_fin_prevue, date_fin_effective, statut, resultat,
            pressing_envoi_id, notes, utilisateur_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'en_cours', NULL, NULL, ?, ?, ?, ?)"
    )
    .bind(&essai_id)
    .bind(&numero_essai)
    .bind(&dto.variante_id)
    .bind(&dto.client_id)
    .bind(&dto.client_nom_libre)
    .bind(&date_debut)
    .bind(&date_fin_prevue)
    .bind(&dto.notes)
    .bind(&user_id)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    tx.commit().await?;

    Ok(EssaiCabineDetailDto {
        id: essai_id,
        numero_essai,
        variante_id: dto.variante_id,
        article_id,
        article_nom,
        article_reference: article_ref,
        taille,
        client_id: dto.client_id,
        client_nom: resolved_client_nom,
        date_debut,
        date_fin_prevue,
        date_fin_effective: None,
        statut: "en_cours".to_string(),
        resultat: None,
        pressing_envoi_id: None,
        notes: dto.notes,
        created_at: now,
    })
}

pub async fn execute_finish_essai_cabine(
    pool: &SqlitePool,
    dto: FinishEssaiCabineDto,
) -> Result<EssaiCabineDetailDto, AppError> {
    if !["convient", "retouche_necessaire", "refuse"].contains(&dto.resultat.as_str()) {
        return Err(AppError::Validation(format!(
            "Résultat d'essayage invalide : '{}'. Valeurs acceptées : convient, retouche_necessaire, refuse.",
            dto.resultat
        )));
    }

    let mut tx = ImmediateTx::begin(pool).await?;

    // 1. Récupérer l'essai
    let essai_row = sqlx::query(
        "SELECT ec.id, ec.numero_essai, ec.variante_id, ec.client_id, ec.client_nom_libre,
                ec.date_debut, ec.date_fin_prevue, ec.statut, ec.utilisateur_id,
                v.article_id, v.taille, a.nom as article_nom, a.reference as article_ref
         FROM essais_cabine ec
         JOIN variantes_stock v ON ec.variante_id = v.id
         JOIN articles a ON v.article_id = a.id
         WHERE ec.id = ?"
    )
    .bind(&dto.essai_id)
    .fetch_optional(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?
    .ok_or_else(|| AppError::NotFound(format!("Essayage introuvable : {}", dto.essai_id)))?;

    let current_statut: String = essai_row.get("statut");
    if current_statut != "en_cours" {
        return Err(AppError::Validation(format!(
            "Cet essayage est déjà clôturé (statut actuel : {}).",
            current_statut
        )));
    }

    let numero_essai: String = essai_row.get("numero_essai");
    let variante_id: String = essai_row.get("variante_id");
    let client_id: Option<String> = essai_row.get("client_id");
    let client_nom_libre: Option<String> = essai_row.get("client_nom_libre");
    let date_debut: String = essai_row.get("date_debut");
    let date_fin_prevue: String = essai_row.get("date_fin_prevue");
    let user_id: String = essai_row.get("utilisateur_id");
    let article_id: String = essai_row.get("article_id");
    let article_nom: String = essai_row.get("article_nom");
    let article_ref: String = essai_row.get("article_ref");
    let taille: String = essai_row.get("taille");

    let now = chrono::Utc::now().to_rfc3339();
    let today = today_local();

    let mut pressing_envoi_id: Option<String> = None;

    // 2. Si retouche nécessaire et envoi atelier/pressing demandé
    if dto.resultat == "retouche_necessaire" && dto.envoyer_retouche.unwrap_or(false) {
        let (num_envoi, _) = next_pressing_number_for_date(&mut *tx.conn, &today).await?;
        let envoi_id = format!("prs-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));

        let motif = dto.retouche_motif.unwrap_or_else(|| {
            format!("Retouche suite à essayage cabine {}", numero_essai)
        });

        // Date de retour prévue : + 3 jours par défaut si non spécifié
        let ret_date = dto.retouche_date_retour_prevue.unwrap_or_else(|| {
            let nd = chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d").unwrap_or_else(|_| chrono::Utc::now().date_naive());
            (nd + chrono::Duration::days(3)).format("%Y-%m-%d").to_string()
        });

        let cout = dto.retouche_cout_centimes.unwrap_or(0);

        sqlx::query(
            "INSERT INTO pressing_envois (
                id, numero_envoi, variante_id, prestataire_id, location_id,
                type_traitement, motif, cout_centimes, statut_paiement_prestataire,
                date_paiement_prestataire, date_envoi, date_retour_prevue,
                date_retour_effective, statut, notes, utilisateur_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, NULL, 'retouche', ?, ?, 'a_payer', NULL, ?, ?, NULL, 'envoye', ?, ?, ?, ?)"
        )
        .bind(&envoi_id)
        .bind(&num_envoi)
        .bind(&variante_id)
        .bind(&dto.retouche_prestataire_id)
        .bind(&motif)
        .bind(cout)
        .bind(&today)
        .bind(&ret_date)
        .bind(&dto.notes)
        .bind(&user_id)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        // Passage immédiat de la variante à 'en_retouche'
        sqlx::query("UPDATE variantes_stock SET statut = 'en_retouche', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(&variante_id)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        pressing_envoi_id = Some(envoi_id);
    } else {
        // Recompter le statut standard de la variante
        recompute_variant_status(&mut *tx.conn, &variante_id).await?;
    }

    // 3. Mettre à jour l'essai cabine
    sqlx::query(
        "UPDATE essais_cabine
         SET statut = 'termine', resultat = ?, date_fin_effective = ?,
             pressing_envoi_id = ?, notes = coalesce(?, notes), updated_at = ?
         WHERE id = ?"
    )
    .bind(&dto.resultat)
    .bind(&now)
    .bind(&pressing_envoi_id)
    .bind(&dto.notes)
    .bind(&now)
    .bind(&dto.essai_id)
    .execute(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    tx.commit().await?;

    // Résolution client nom
    let mut resolved_client_nom = client_nom_libre;
    if let Some(ref cid) = client_id {
        let c_row = sqlx::query("SELECT prenom, nom FROM clients WHERE id = ?")
            .bind(cid)
            .fetch_optional(pool)
            .await
            .map_err(map_sqlite_err)?;

        if let Some(crow) = c_row {
            let p: String = crow.get("prenom");
            let n: String = crow.get("nom");
            resolved_client_nom = Some(format!("{} {}", p, n));
        }
    }

    Ok(EssaiCabineDetailDto {
        id: dto.essai_id,
        numero_essai,
        variante_id,
        article_id,
        article_nom,
        article_reference: article_ref,
        taille,
        client_id,
        client_nom: resolved_client_nom,
        date_debut,
        date_fin_prevue,
        date_fin_effective: Some(now.clone()),
        statut: "termine".to_string(),
        resultat: Some(dto.resultat),
        pressing_envoi_id,
        notes: dto.notes,
        created_at: now,
    })
}

pub async fn execute_cancel_essai_cabine(
    pool: &SqlitePool,
    essai_id: &str,
) -> Result<EssaiCabineDetailDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    let essai_row = sqlx::query(
        "SELECT ec.id, ec.numero_essai, ec.variante_id, ec.client_id, ec.client_nom_libre,
                ec.date_debut, ec.date_fin_prevue, ec.statut, ec.notes,
                v.article_id, v.taille, a.nom as article_nom, a.reference as article_ref
         FROM essais_cabine ec
         JOIN variantes_stock v ON ec.variante_id = v.id
         JOIN articles a ON v.article_id = a.id
         WHERE ec.id = ?"
    )
    .bind(essai_id)
    .fetch_optional(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?
    .ok_or_else(|| AppError::NotFound(format!("Essayage introuvable : {}", essai_id)))?;

    let current_statut: String = essai_row.get("statut");
    if current_statut != "en_cours" {
        return Err(AppError::Validation(format!(
            "Seul un essayage en cours peut être annulé (statut : {}).",
            current_statut
        )));
    }

    let numero_essai: String = essai_row.get("numero_essai");
    let variante_id: String = essai_row.get("variante_id");
    let client_id: Option<String> = essai_row.get("client_id");
    let client_nom_libre: Option<String> = essai_row.get("client_nom_libre");
    let date_debut: String = essai_row.get("date_debut");
    let date_fin_prevue: String = essai_row.get("date_fin_prevue");
    let notes: Option<String> = essai_row.get("notes");
    let article_id: String = essai_row.get("article_id");
    let article_nom: String = essai_row.get("article_nom");
    let article_ref: String = essai_row.get("article_ref");
    let taille: String = essai_row.get("taille");

    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE essais_cabine SET statut = 'annule', date_fin_effective = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&now)
    .bind(&now)
    .bind(essai_id)
    .execute(&mut *tx.conn)
    .await
    .map_err(map_sqlite_err)?;

    // Recompter statut variante
    recompute_variant_status(&mut *tx.conn, &variante_id).await?;

    tx.commit().await?;

    // Résolution client nom
    let mut resolved_client_nom = client_nom_libre;
    if let Some(ref cid) = client_id {
        let c_row = sqlx::query("SELECT prenom, nom FROM clients WHERE id = ?")
            .bind(cid)
            .fetch_optional(pool)
            .await
            .map_err(map_sqlite_err)?;

        if let Some(crow) = c_row {
            let p: String = crow.get("prenom");
            let n: String = crow.get("nom");
            resolved_client_nom = Some(format!("{} {}", p, n));
        }
    }

    Ok(EssaiCabineDetailDto {
        id: essai_id.to_string(),
        numero_essai,
        variante_id,
        article_id,
        article_nom,
        article_reference: article_ref,
        taille,
        client_id,
        client_nom: resolved_client_nom,
        date_debut,
        date_fin_prevue,
        date_fin_effective: Some(now.clone()),
        statut: "annule".to_string(),
        resultat: None,
        pressing_envoi_id: None,
        notes,
        created_at: now,
    })
}

pub async fn execute_list_essais_cabine(
    pool: &SqlitePool,
    variante_id: Option<String>,
    client_id: Option<String>,
    statut: Option<String>,
) -> Result<Vec<EssaiCabineDetailDto>, AppError> {
    let mut sql = String::from(
        "SELECT ec.id, ec.numero_essai, ec.variante_id, ec.client_id, ec.client_nom_libre,
                ec.date_debut, ec.date_fin_prevue, ec.date_fin_effective, ec.statut,
                ec.resultat, ec.pressing_envoi_id, ec.notes, ec.created_at,
                v.article_id, v.taille, a.nom as article_nom, a.reference as article_ref,
                c.prenom as client_prenom, c.nom as client_nom
         FROM essais_cabine ec
         JOIN variantes_stock v ON ec.variante_id = v.id
         JOIN articles a ON v.article_id = a.id
         LEFT JOIN clients c ON ec.client_id = c.id
         WHERE 1=1"
    );

    if let Some(ref vid) = variante_id {
        sql.push_str(&format!(" AND ec.variante_id = '{}'", vid.replace('\'', "''")));
    }
    if let Some(ref cid) = client_id {
        sql.push_str(&format!(" AND ec.client_id = '{}'", cid.replace('\'', "''")));
    }
    if let Some(ref st) = statut {
        sql.push_str(&format!(" AND ec.statut = '{}'", st.replace('\'', "''")));
    }

    sql.push_str(" ORDER BY ec.created_at DESC LIMIT 200");

    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(map_sqlite_err)?;

    let mut result = Vec::new();
    for r in rows {
        let cid: Option<String> = r.get("client_id");
        let client_libre: Option<String> = r.get("client_nom_libre");
        let cp: Option<String> = r.get("client_prenom");
        let cn: Option<String> = r.get("client_nom");

        let resolved_nom = if let (Some(p), Some(n)) = (cp, cn) {
            Some(format!("{} {}", p, n))
        } else {
            client_libre
        };

        result.push(EssaiCabineDetailDto {
            id: r.get("id"),
            numero_essai: r.get("numero_essai"),
            variante_id: r.get("variante_id"),
            article_id: r.get("article_id"),
            article_nom: r.get("article_nom"),
            article_reference: r.get("article_ref"),
            taille: r.get("taille"),
            client_id: cid,
            client_nom: resolved_nom,
            date_debut: r.get("date_debut"),
            date_fin_prevue: r.get("date_fin_prevue"),
            date_fin_effective: r.get("date_fin_effective"),
            statut: r.get("statut"),
            resultat: r.get("resultat"),
            pressing_envoi_id: r.get("pressing_envoi_id"),
            notes: r.get("notes"),
            created_at: r.get("created_at"),
        });
    }

    Ok(result)
}

// ============================================================================
// COMMANDES TAURI IPC EXPOSÉES
// ============================================================================

#[command]
pub async fn create_client_mensurations(
    client_id: String,
    dto: CreateMensurationsDto,
    state: State<'_, DbState>,
) -> Result<ClientMensurations, AppError> {
    execute_create_client_mensurations(&state.pool, &client_id, dto).await
}

#[command]
pub async fn get_client_mensurations_active(
    client_id: String,
    state: State<'_, DbState>,
) -> Result<Option<ClientMensurations>, AppError> {
    execute_get_client_mensurations_active(&state.pool, &client_id).await
}

#[command]
pub async fn get_client_mensurations_history(
    client_id: String,
    state: State<'_, DbState>,
) -> Result<Vec<ClientMensurations>, AppError> {
    execute_get_client_mensurations_history(&state.pool, &client_id).await
}

#[command]
pub async fn search_clients_by_mensurations(
    filters: MensurationSearchFilterDto,
    state: State<'_, DbState>,
) -> Result<Vec<ClientWithActiveMensurationsDto>, AppError> {
    execute_search_clients_by_mensurations(&state.pool, filters).await
}

#[command]
pub async fn create_essai_cabine(
    dto: CreateEssaiCabineDto,
    state: State<'_, DbState>,
) -> Result<EssaiCabineDetailDto, AppError> {
    execute_create_essai_cabine(&state.pool, dto).await
}

#[command]
pub async fn finish_essai_cabine(
    dto: FinishEssaiCabineDto,
    state: State<'_, DbState>,
) -> Result<EssaiCabineDetailDto, AppError> {
    execute_finish_essai_cabine(&state.pool, dto).await
}

#[command]
pub async fn cancel_essai_cabine(
    essai_id: String,
    state: State<'_, DbState>,
) -> Result<EssaiCabineDetailDto, AppError> {
    execute_cancel_essai_cabine(&state.pool, &essai_id).await
}

#[command]
pub async fn list_essais_cabine(
    variante_id: Option<String>,
    client_id: Option<String>,
    statut: Option<String>,
    state: State<'_, DbState>,
) -> Result<Vec<EssaiCabineDetailDto>, AppError> {
    execute_list_essais_cabine(&state.pool, variante_id, client_id, statut).await
}
