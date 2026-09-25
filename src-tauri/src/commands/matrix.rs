use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::{command, State};
use crate::db::DbState;
use crate::error::AppError;
use crate::commands::{map_sqlite_err, today_local};

// ============================================================================
// MODÈLES DE CRÉNEAUX ET DE MATRICE DE DISPONIBILITÉ
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SlotNature {
    Location,
    Pressing,
    Retard,
    Essayage,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailabilitySlot {
    pub date_debut: String, // Format YYYY-MM-DD
    pub date_fin: String,   // Format YYYY-MM-DD
    pub nature: SlotNature,
    pub reference_id: Option<String>,
    pub reference_code: Option<String>, // Ex: "LOC-2026-0012" ou "PRS-2026-0004"
    pub description: String,
    pub client_nom: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariantAvailabilityMatrixRow {
    pub variante_id: String,
    pub article_id: String,
    pub article_nom: String,
    pub reference: String,
    pub taille: String,
    pub sous_taille: Option<String>,
    pub statut_actuel: String,
    pub slots: Vec<AvailabilitySlot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailabilityValidationResult {
    pub disponible: bool,
    pub motif_refus: Option<String>,
    pub conflit_nature: Option<SlotNature>,
    pub conflit_reference: Option<String>,
}

// ============================================================================
// A2. ALGORITHME DU TAMPON PRESSING AUTOMATIQUE
// ============================================================================

/// Nombre N d'envois clôturés récents retenus pour le calcul de la moyenne.
pub const PRESSING_SAMPLE_SIZE_N: i64 = 5;
/// Seuil minimal d'envois clôturés pour considérer l'échantillon statistiquement représentatif.
pub const PRESSING_MIN_SAMPLE_THRESHOLD: usize = 3;
/// Tampon par défaut si aucun prestataire ou aucun historique n'est disponible.
pub const DEFAULT_FALLBACK_PRESSING_DAYS: i64 = 3;

/// Parse une chaîne date (YYYY-MM-DD ou ISO 8601) en `chrono::NaiveDate`.
pub fn parse_date_ymd(d_str: &str) -> Option<chrono::NaiveDate> {
    let clean = if d_str.len() >= 10 { &d_str[0..10] } else { d_str };
    chrono::NaiveDate::parse_from_str(clean, "%Y-%m-%d").ok()
}

/// Calcule le tampon pressing en jours pour un prestataire donné (ou global par défaut).
///
/// Formule :
/// - Si `prestataire_id` est fourni, récupère jusqu'à N=5 derniers envois avec statut = 'recu' et date_retour_effective non nulle.
/// - Si au moins 3 envois clôturés existent : moyenne des durées réelles (date_retour_effective - date_envoi), arrondie par excès (ceil).
/// - Sinon, repli sur le `delai_defaut_jours` configuré sur la fiche du prestataire (ou DEFAULT_FALLBACK_PRESSING_DAYS).
pub async fn calculate_pressing_buffer_days(
    pool: &SqlitePool,
    prestataire_id: Option<&str>,
) -> Result<i64, AppError> {
    let Some(p_id) = prestataire_id else {
        // Aucun prestataire spécifié : recherche si un prestataire actif par défaut existe
        let default_prov = sqlx::query(
            "SELECT delai_defaut_jours FROM pressing_prestataires WHERE actif = 1 ORDER BY created_at ASC LIMIT 1"
        )
        .fetch_optional(pool)
        .await
        .map_err(map_sqlite_err)?;

        return Ok(default_prov
            .and_then(|r| r.get::<Option<i64>, _>("delai_defaut_jours"))
            .unwrap_or(DEFAULT_FALLBACK_PRESSING_DAYS));
    };

    // 1. Lire le délai par défaut configuré sur le prestataire
    let provider_row = sqlx::query(
        "SELECT delai_defaut_jours FROM pressing_prestataires WHERE id = ?"
    )
    .bind(p_id)
    .fetch_optional(pool)
    .await
    .map_err(map_sqlite_err)?;

    let provider_default = provider_row
        .and_then(|r| r.get::<Option<i64>, _>("delai_defaut_jours"))
        .unwrap_or(DEFAULT_FALLBACK_PRESSING_DAYS);

    // 2. Extraire les N derniers envois terminés pour ce prestataire
    let rows = sqlx::query(
        "SELECT date_envoi, date_retour_effective
         FROM pressing_envois
         WHERE prestataire_id = ?
           AND statut = 'recu'
           AND date_retour_effective IS NOT NULL
         ORDER BY date_retour_effective DESC
         LIMIT ?"
    )
    .bind(p_id)
    .bind(PRESSING_SAMPLE_SIZE_N)
    .fetch_all(pool)
    .await
    .map_err(map_sqlite_err)?;

    if rows.len() < PRESSING_MIN_SAMPLE_THRESHOLD {
        // Échantillon insuffisant : repli sur le délai contractuel par défaut
        return Ok(provider_default);
    }

    // 3. Calcul de la moyenne des durées réelles
    let mut total_days: i64 = 0;
    let mut count: i64 = 0;

    for row in rows {
        let d_envoi: String = row.get("date_envoi");
        let d_retour: String = row.get("date_retour_effective");

        if let (Some(date_start), Some(date_end)) = (parse_date_ymd(&d_envoi), parse_date_ymd(&d_retour)) {
            let diff = (date_end - date_start).num_days();
            let duration = if diff < 1 { 1 } else { diff };
            total_days += duration;
            count += 1;
        }
    }

    if count < (PRESSING_MIN_SAMPLE_THRESHOLD as i64) {
        return Ok(provider_default);
    }

    // Arrondi par excès (ceil) : (total + count - 1) / count
    let avg_ceil = (total_days + count - 1) / count;
    Ok(std::cmp::max(1, avg_ceil))
}

// ============================================================================
// A3. FONCTION DE VALIDATION DE DISPONIBILITÉ (POUR NOUVELLE LOCATION OU DND)
// ============================================================================

/// Valide si une variante est disponible pour un créneau [pickup_date .. return_date].
///
/// Vérifie :
/// 1. Statut actuel de la pièce (ne doit pas être vendue, en retouche ou indisponible).
/// 2. Absence de chevauchement avec une autre location active ou réservée.
/// 3. Absence de chevauchement avec un envoi pressing en cours ou programmé.
/// 4. Absence de chevauchement avec le **tampon pressing automatique** consécutif à une location précédente.
pub async fn validate_variant_availability(
    pool: &SqlitePool,
    variante_id: &str,
    pickup_date: &str,
    return_date: &str,
    exclude_contract_id: Option<&str>,
) -> Result<AvailabilityValidationResult, AppError> {
    let req_start = parse_date_ymd(pickup_date)
        .ok_or_else(|| AppError::Validation("Format date_debut invalide (attendu YYYY-MM-DD)".to_string()))?;
    let req_end = parse_date_ymd(return_date)
        .ok_or_else(|| AppError::Validation("Format date_fin invalide (attendu YYYY-MM-DD)".to_string()))?;

    if req_start > req_end {
        return Err(AppError::Validation("La date de début doit précéder ou égaler la date de fin".to_string()));
    }

    let req_start_str = req_start.format("%Y-%m-%d").to_string();
    let req_end_str = req_end.format("%Y-%m-%d").to_string();

    // 1. Statut de la variante
    let var_row = sqlx::query(
        "SELECT v.statut, a.nom as art_nom, v.taille
         FROM variantes_stock v
         JOIN articles a ON v.article_id = a.id
         WHERE v.id = ?"
    )
    .bind(variante_id)
    .fetch_optional(pool)
    .await
    .map_err(map_sqlite_err)?
    .ok_or_else(|| AppError::Validation(format!("Variante introuvable : {}", variante_id)))?;

    let art_nom: String = var_row.get("art_nom");
    let taille: String = var_row.get("taille");
    let statut: String = var_row.get("statut");

    if statut == "vendu" || statut == "indisponible" || statut == "en_retouche" {
        return Ok(AvailabilityValidationResult {
            disponible: false,
            motif_refus: Some(format!(
                "La pièce '{} (T.{})' est indisponible (statut actuel : {}).",
                art_nom, taille, statut
            )),
            conflit_nature: None,
            conflit_reference: None,
        });
    }

    // 2. Conflit direct avec les contrats de location existants
    let mut query_builder = String::from(
        "SELECT l.id, l.numero_location, l.date_retrait_prevue, l.date_retour_prevue,
                c.prenom, c.nom
         FROM lignes_location ll
         JOIN locations l ON ll.location_id = l.id
         JOIN clients c ON l.client_id = c.id
         WHERE ll.variante_id = ?
           AND ll.est_rendu = 0
           AND l.statut IN ('reserve', 'en_cours', 'en_retard', 'litige')
           AND l.date_retrait_prevue <= ?
           AND l.date_retour_prevue >= ?"
    );

    if exclude_contract_id.is_some() {
        query_builder.push_str(" AND l.id != ?");
    }

    let mut q = sqlx::query(&query_builder)
        .bind(variante_id)
        .bind(&req_end_str)
        .bind(&req_start_str);

    if let Some(exc_id) = exclude_contract_id {
        q = q.bind(exc_id);
    }

    let loc_conflict = q.fetch_optional(pool).await.map_err(map_sqlite_err)?;

    if let Some(row) = loc_conflict {
        let num: String = row.get("numero_location");
        let start: String = row.get("date_retrait_prevue");
        let end: String = row.get("date_retour_prevue");
        let c_nom: String = row.get("nom");
        let c_prenom: String = row.get("prenom");
        return Ok(AvailabilityValidationResult {
            disponible: false,
            motif_refus: Some(format!(
                "Conflit de date avec la location {} ({} {}) du {} au {}.",
                num, c_prenom, c_nom, start, end
            )),
            conflit_nature: Some(SlotNature::Location),
            conflit_reference: Some(num),
        });
    }

    // 3. Conflit avec les envois pressing en cours
    let pressing_conflict = sqlx::query(
        "SELECT pe.numero_envoi, pe.date_envoi, pe.date_retour_prevue
         FROM pressing_envois pe
         WHERE pe.variante_id = ?
           AND pe.statut IN ('envoye', 'en_traitement')
           AND pe.date_envoi <= ?
           AND pe.date_retour_prevue >= ?
         LIMIT 1"
    )
    .bind(variante_id)
    .bind(&req_end_str)
    .bind(&req_start_str)
    .fetch_optional(pool)
    .await
    .map_err(map_sqlite_err)?;

    if let Some(row) = pressing_conflict {
        let num: String = row.get("numero_envoi");
        let start: String = row.get("date_envoi");
        let end: String = row.get("date_retour_prevue");
        return Ok(AvailabilityValidationResult {
            disponible: false,
            motif_refus: Some(format!(
                "La pièce est envoyée au pressing ({}) du {} au {}.",
                num, start, end
            )),
            conflit_nature: Some(SlotNature::Pressing),
            conflit_reference: Some(num),
        });
    }

    // 4. Conflit avec le tampon pressing automatique post-location
    // Pour toute location antérieure à la plage demandée : date_retour_prevue .. date_retour_prevue + tampon
    let default_buffer = calculate_pressing_buffer_days(pool, None).await?;

    let mut prior_locs_query = String::from(
        "SELECT l.id, l.numero_location, l.date_retour_prevue
         FROM lignes_location ll
         JOIN locations l ON ll.location_id = l.id
         WHERE ll.variante_id = ?
           AND ll.est_rendu = 0
           AND l.statut IN ('reserve', 'en_cours', 'en_retard', 'litige')"
    );

    if exclude_contract_id.is_some() {
        prior_locs_query.push_str(" AND l.id != ?");
    }

    let mut q2 = sqlx::query(&prior_locs_query).bind(variante_id);
    if let Some(exc_id) = exclude_contract_id {
        q2 = q2.bind(exc_id);
    }

    let prior_locs = q2.fetch_all(pool).await.map_err(map_sqlite_err)?;

    for row in prior_locs {
        let d_ret_str: String = row.get("date_retour_prevue");
        let num_loc: String = row.get("numero_location");

        if let Some(d_ret) = parse_date_ymd(&d_ret_str) {
            let buffer_start = d_ret;
            let buffer_end = d_ret + chrono::Duration::days(default_buffer);

            // Vérifier chevauchement entre [req_start .. req_end] et [buffer_start .. buffer_end]
            if req_start <= buffer_end && req_end >= buffer_start {
                return Ok(AvailabilityValidationResult {
                    disponible: false,
                    motif_refus: Some(format!(
                        "La date chevauche le délai de nettoyage/pressing obligatoire ({} jours) consécutif au contrat {} (retour prévu le {}).",
                        default_buffer, num_loc, d_ret_str
                    )),
                    conflit_nature: Some(SlotNature::Pressing),
                    conflit_reference: Some(num_loc),
                });
            }
        }
    }

    // 5. Conflit avec un essayage en cours
    let essai_conflict = sqlx::query(
        "SELECT ec.numero_essai, ec.date_debut, ec.date_fin_prevue
         FROM essais_cabine ec
         WHERE ec.variante_id = ?
           AND ec.statut = 'en_cours'
           AND date(ec.date_debut) <= ?
           AND date(ec.date_fin_prevue) >= ?
         LIMIT 1"
    )
    .bind(variante_id)
    .bind(&req_end_str)
    .bind(&req_start_str)
    .fetch_optional(pool)
    .await
    .map_err(map_sqlite_err)?;

    if let Some(row) = essai_conflict {
        let num: String = row.get("numero_essai");
        let start: String = row.get("date_debut");
        let end: String = row.get("date_fin_prevue");
        return Ok(AvailabilityValidationResult {
            disponible: false,
            motif_refus: Some(format!(
                "La pièce est actuellement en cabine d'essayage ({}) du {} au {}.",
                num, start, end
            )),
            conflit_nature: Some(SlotNature::Essayage),
            conflit_reference: Some(num),
        });
    }

    Ok(AvailabilityValidationResult {
        disponible: true,
        motif_refus: None,
        conflit_nature: None,
        conflit_reference: None,
    })
}


// ============================================================================
// A1. QUERY RUST MATRICE DE DISPONIBILITÉ PAR VARIANTE × PLAGE DE DATES
// ============================================================================

/// Génère la liste des créneaux occupés par variante dans la fenêtre temporelle demandée.
pub async fn get_availability_matrix_internal(
    pool: &SqlitePool,
    date_debut: &str,
    date_fin: &str,
    article_ids: Option<Vec<String>>,
) -> Result<Vec<VariantAvailabilityMatrixRow>, AppError> {
    let window_start = parse_date_ymd(date_debut)
        .ok_or_else(|| AppError::Validation("Format date_debut invalide".to_string()))?;
    let window_end = parse_date_ymd(date_fin)
        .ok_or_else(|| AppError::Validation("Format date_fin invalide".to_string()))?;

    if window_start > window_end {
        return Err(AppError::Validation("date_debut doit être antérieure à date_fin".to_string()));
    }

    let today_str = today_local();
    let today = parse_date_ymd(&today_str).unwrap_or(window_start);

    // 1. Liste des variantes concernées
    let mut var_query = String::from(
        "SELECT v.id as var_id, v.article_id, v.statut as var_statut, v.taille, v.sous_taille,
                a.nom as art_nom, a.reference
         FROM variantes_stock v
         JOIN articles a ON v.article_id = a.id
         WHERE a.est_actif = 1"
    );

    if let Some(ref ids) = article_ids {
        if !ids.is_empty() {
            let placeholders = vec!["?"; ids.len()].join(",");
            var_query.push_str(&format!(" AND a.id IN ({})", placeholders));
        }
    }

    var_query.push_str(" ORDER BY a.nom ASC, v.taille ASC");

    let mut q = sqlx::query(&var_query);
    if let Some(ids) = article_ids {
        for id in ids {
            q = q.bind(id);
        }
    }

    let var_rows = q.fetch_all(pool).await.map_err(map_sqlite_err)?;

    // Tampon pressing calculé une seule fois
    let buffer_days = calculate_pressing_buffer_days(pool, None).await?;

    let mut result: Vec<VariantAvailabilityMatrixRow> = Vec::new();

    for vr in var_rows {
        let var_id: String = vr.get("var_id");
        let art_id: String = vr.get("article_id");
        let art_nom: String = vr.get("art_nom");
        let reference: String = vr.get("reference");
        let taille: String = vr.get("taille");
        let sous_taille: Option<String> = vr.get("sous_taille");
        let statut: String = vr.get("var_statut");

        let mut slots: Vec<AvailabilitySlot> = Vec::new();

        // 2. Extraire les locations pour cette variante
        let loc_rows = sqlx::query(
            "SELECT l.id as loc_id, l.numero_location, l.date_retrait_prevue, l.date_retour_prevue,
                    l.statut as loc_statut, ll.est_rendu, c.prenom, c.nom
             FROM lignes_location ll
             JOIN locations l ON ll.location_id = l.id
             JOIN clients c ON l.client_id = c.id
             WHERE ll.variante_id = ?
               AND l.statut IN ('reserve', 'en_cours', 'en_retard', 'litige')
             ORDER BY l.date_retrait_prevue ASC"
        )
        .bind(&var_id)
        .fetch_all(pool)
        .await
        .map_err(map_sqlite_err)?;

        for lr in loc_rows {
            let loc_id: String = lr.get("loc_id");
            let num_loc: String = lr.get("numero_location");
            let d_retrait_str: String = lr.get("date_retrait_prevue");
            let d_retour_str: String = lr.get("date_retour_prevue");
            let loc_statut: String = lr.get("loc_statut");
            let est_rendu: i64 = lr.get("est_rendu");
            let c_prenom: String = lr.get("prenom");
            let c_nom: String = lr.get("nom");
            let client_fullname = format!("{} {}", c_prenom, c_nom);

            let Some(d_retrait) = parse_date_ymd(&d_retrait_str) else { continue };
            let Some(d_retour) = parse_date_ymd(&d_retour_str) else { continue };

            let is_retard = loc_statut == "en_retard" || (d_retour < today && est_rendu == 0);

            if is_retard {
                // Créneau de retard : de date_retour à aujourd'hui (ou fin de fenêtre)
                let ret_start = d_retour;
                let ret_end = std::cmp::max(today, d_retour);
                if ret_start <= window_end && ret_end >= window_start {
                    slots.push(AvailabilitySlot {
                        date_debut: ret_start.format("%Y-%m-%d").to_string(),
                        date_fin: ret_end.format("%Y-%m-%d").to_string(),
                        nature: SlotNature::Retard,
                        reference_id: Some(loc_id.clone()),
                        reference_code: Some(num_loc.clone()),
                        description: format!("Location en retard ({})", num_loc),
                        client_nom: Some(client_fullname.clone()),
                    });
                }
            }

            // Créneau normal de location
            if d_retrait <= window_end && d_retour >= window_start {
                slots.push(AvailabilitySlot {
                    date_debut: d_retrait.format("%Y-%m-%d").to_string(),
                    date_fin: d_retour.format("%Y-%m-%d").to_string(),
                    nature: SlotNature::Location,
                    reference_id: Some(loc_id.clone()),
                    reference_code: Some(num_loc.clone()),
                    description: format!("Contrat de location {}", num_loc),
                    client_nom: Some(client_fullname.clone()),
                });
            }

            // Créneau pressing consécutif (tampon ou envoi réel)
            // Vérifier d'abord si un envoi pressing réel est lié à ce contrat
            let envoi_reel = sqlx::query(
                "SELECT pe.id, pe.numero_envoi, pe.date_envoi, pe.date_retour_prevue
                 FROM pressing_envois pe
                 WHERE pe.location_id = ? AND pe.variante_id = ?
                   AND pe.statut IN ('envoye', 'en_traitement')
                 LIMIT 1"
            )
            .bind(&loc_id)
            .bind(&var_id)
            .fetch_optional(pool)
            .await
            .map_err(map_sqlite_err)?;

            if let Some(er) = envoi_reel {
                let e_id: String = er.get("id");
                let e_num: String = er.get("numero_envoi");
                let e_start_str: String = er.get("date_envoi");
                let e_end_str: String = er.get("date_retour_prevue");

                if let (Some(es), Some(ee)) = (parse_date_ymd(&e_start_str), parse_date_ymd(&e_end_str)) {
                    if es <= window_end && ee >= window_start {
                        slots.push(AvailabilitySlot {
                            date_debut: es.format("%Y-%m-%d").to_string(),
                            date_fin: ee.format("%Y-%m-%d").to_string(),
                            nature: SlotNature::Pressing,
                            reference_id: Some(e_id),
                            reference_code: Some(e_num.clone()),
                            description: format!("Pressing programmé ({})", e_num),
                            client_nom: None,
                        });
                    }
                }
            } else if est_rendu == 0 {
                // Aucun envoi physique encore créé : application du tampon calculé
                let buf_start = d_retour;
                let buf_end = d_retour + chrono::Duration::days(buffer_days);

                if buf_start <= window_end && buf_end >= window_start {
                    slots.push(AvailabilitySlot {
                        date_debut: buf_start.format("%Y-%m-%d").to_string(),
                        date_fin: buf_end.format("%Y-%m-%d").to_string(),
                        nature: SlotNature::Pressing,
                        reference_id: Some(loc_id.clone()),
                        reference_code: Some(num_loc.clone()),
                        description: format!("Nettoyage pressing estimé ({}j post-{})", buffer_days, num_loc),
                        client_nom: None,
                    });
                }
            }
        }

        // 3. Envois pressing indépendants d'une location
        let direct_pressings = sqlx::query(
            "SELECT pe.id, pe.numero_envoi, pe.date_envoi, pe.date_retour_prevue, pe.motif
             FROM pressing_envois pe
             WHERE pe.variante_id = ?
               AND pe.location_id IS NULL
               AND pe.statut IN ('envoye', 'en_traitement')"
        )
        .bind(&var_id)
        .fetch_all(pool)
        .await
        .map_err(map_sqlite_err)?;

        for dpr in direct_pressings {
            let pid: String = dpr.get("id");
            let pnum: String = dpr.get("numero_envoi");
            let ps_str: String = dpr.get("date_envoi");
            let pe_str: String = dpr.get("date_retour_prevue");

            if let (Some(ps), Some(pe)) = (parse_date_ymd(&ps_str), parse_date_ymd(&pe_str)) {
                if ps <= window_end && pe >= window_start {
                    slots.push(AvailabilitySlot {
                        date_debut: ps.format("%Y-%m-%d").to_string(),
                        date_fin: pe.format("%Y-%m-%d").to_string(),
                        nature: SlotNature::Pressing,
                        reference_id: Some(pid),
                        reference_code: Some(pnum.clone()),
                        description: format!("Pressing atelier ({})", pnum),
                        client_nom: None,
                    });
                }
            }
        }

        // 4. Essais en cabine actifs pour cette variante
        let essais = sqlx::query(
            "SELECT ec.id, ec.numero_essai, ec.date_debut, ec.date_fin_prevue, ec.statut, ec.client_nom_libre,
                    c.prenom as client_prenom, c.nom as client_nom
             FROM essais_cabine ec
             LEFT JOIN clients c ON ec.client_id = c.id
             WHERE ec.variante_id = ?
               AND ec.statut = 'en_cours'
             ORDER BY ec.date_debut ASC"
        )
        .bind(&var_id)
        .fetch_all(pool)
        .await
        .map_err(map_sqlite_err)?;

        for es in essais {
            let eid: String = es.get("id");
            let enum_code: String = es.get("numero_essai");
            let ed_debut_str: String = es.get("date_debut");
            let ed_fin_str: String = es.get("date_fin_prevue");
            let client_libre: Option<String> = es.get("client_nom_libre");
            let cp: Option<String> = es.get("client_prenom");
            let cn: Option<String> = es.get("client_nom");

            let c_name = if let (Some(p), Some(n)) = (cp, cn) {
                Some(format!("{} {}", p, n))
            } else {
                client_libre
            };

            if let (Some(es_date), Some(ee_date)) = (parse_date_ymd(&ed_debut_str), parse_date_ymd(&ed_fin_str)) {
                if es_date <= window_end && ee_date >= window_start {
                    slots.push(AvailabilitySlot {
                        date_debut: es_date.format("%Y-%m-%d").to_string(),
                        date_fin: ee_date.format("%Y-%m-%d").to_string(),
                        nature: SlotNature::Essayage,
                        reference_id: Some(eid),
                        reference_code: Some(enum_code.clone()),
                        description: format!("Essayage cabine ({})", enum_code),
                        client_nom: c_name,
                    });
                }
            }
        }

        // Trier les créneaux par ordre chronologique
        slots.sort_by(|a, b| a.date_debut.cmp(&b.date_debut));


        result.push(VariantAvailabilityMatrixRow {
            variante_id: var_id,
            article_id: art_id,
            article_nom: art_nom,
            reference,
            taille,
            sous_taille,
            statut_actuel: statut,
            slots,
        });
    }

    Ok(result)
}

// ============================================================================
// COMMANDES TAURI IPC EXPOSÉES
// ============================================================================

#[command]
pub async fn get_availability_matrix(
    date_debut: String,
    date_fin: String,
    article_ids: Option<Vec<String>>,
    state: State<'_, DbState>,
) -> Result<Vec<VariantAvailabilityMatrixRow>, AppError> {
    get_availability_matrix_internal(&state.pool, &date_debut, &date_fin, article_ids).await
}

#[command]
pub async fn check_availability_slot(
    variante_id: String,
    pickup_date: String,
    return_date: String,
    exclude_contract_id: Option<String>,
    state: State<'_, DbState>,
) -> Result<AvailabilityValidationResult, AppError> {
    validate_variant_availability(
        &state.pool,
        &variante_id,
        &pickup_date,
        &return_date,
        exclude_contract_id.as_deref(),
    )
    .await
}

// ============================================================================
// C3. ÉCRITURE EN BASE AVEC TRANSACTION ET REVALIDATION STRICTE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RescheduleRentalLineDto {
    pub location_id: String,
    pub current_variant_id: String,
    pub target_variant_id: String,
    pub new_pickup_date: String,
    pub new_return_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RescheduleRentalResult {
    pub success: bool,
    pub location_id: String,
    pub numero_location: String,
    pub current_variant_id: String,
    pub target_variant_id: String,
    pub new_pickup_date: String,
    pub new_return_date: String,
    pub message: String,
}

pub async fn reschedule_rental_line_internal(
    pool: &SqlitePool,
    dto: &RescheduleRentalLineDto,
) -> Result<RescheduleRentalResult, AppError> {
    // 1. Transaction atomique stricte
    let mut tx = pool.begin().await.map_err(map_sqlite_err)?;

    // 2. Vérifier que la location existe et est modifiable
    let loc_row = sqlx::query(
        "SELECT id, numero_location, statut, date_retrait_prevue, date_retour_prevue
         FROM locations
         WHERE id = ?"
    )
    .bind(&dto.location_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(map_sqlite_err)?
    .ok_or_else(|| AppError::NotFound(format!("Contrat de location introuvable : {}", dto.location_id)))?;

    let num_loc: String = loc_row.get("numero_location");
    let statut: String = loc_row.get("statut");

    if statut == "retourne" || statut == "annule" {
        return Err(AppError::Validation(format!(
            "Impossible de reprogrammer une location avec le statut '{}'. Seules les réservations et locations actives peuvent être déplacées.",
            statut
        )));
    }

    // 3. Vérifier que la ligne de contrat actuelle existe
    let ligne_row = sqlx::query(
        "SELECT id FROM lignes_location WHERE location_id = ? AND variante_id = ? AND est_rendu = 0"
    )
    .bind(&dto.location_id)
    .bind(&dto.current_variant_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(map_sqlite_err)?
    .ok_or_else(|| AppError::NotFound(format!(
        "Ligne de location active introuvable pour la variante {} dans le contrat {}.",
        dto.current_variant_id, num_loc
    )))?;

    let ligne_id: String = ligne_row.get("id");

    // 4. Revalidation stricte de disponibilité côté serveur avant écriture
    // Vérification de la disponibilité de la variante cible sur la nouvelle plage
    let validation = validate_variant_availability(
        pool,
        &dto.target_variant_id,
        &dto.new_pickup_date,
        &dto.new_return_date,
        Some(&dto.location_id),
    )
    .await?;

    if !validation.disponible {
        // En cas d'échec de la validation serveur (course concurrente), tx est abandonné
        let motif = validation.motif_refus.unwrap_or_else(|| "Plage cible indisponible".to_string());
        return Err(AppError::Validation(format!(
            "Reprogrammation impossible : conflit de disponibilité détecté sur la pièce cible ({})",
            motif
        )));
    }

    let now = chrono::Utc::now().to_rfc3339();

    // 5. Mise à jour de la variante si changement vertical (autre pièce)
    if dto.current_variant_id != dto.target_variant_id {
        sqlx::query(
            "UPDATE lignes_location SET variante_id = ? WHERE id = ?"
        )
        .bind(&dto.target_variant_id)
        .bind(&ligne_id)
        .execute(&mut *tx)
        .await
        .map_err(map_sqlite_err)?;

        // Recompute statut pour l'ancienne et la nouvelle variante
        crate::commands::recompute_variant_status(&mut tx, &dto.current_variant_id).await?;
        crate::commands::recompute_variant_status(&mut tx, &dto.target_variant_id).await?;
    }

    // 6. Mise à jour des dates du contrat
    sqlx::query(
        "UPDATE locations SET date_retrait_prevue = ?, date_retour_prevue = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&dto.new_pickup_date)
    .bind(&dto.new_return_date)
    .bind(&now)
    .bind(&dto.location_id)
    .execute(&mut *tx)
    .await
    .map_err(map_sqlite_err)?;

    // 7. Commit atomique
    tx.commit().await.map_err(map_sqlite_err)?;

    Ok(RescheduleRentalResult {
        success: true,
        location_id: dto.location_id.clone(),
        numero_location: num_loc,
        current_variant_id: dto.current_variant_id.clone(),
        target_variant_id: dto.target_variant_id.clone(),
        new_pickup_date: dto.new_pickup_date.clone(),
        new_return_date: dto.new_return_date.clone(),
        message: "Reprogrammation de la location effectuée avec succès".to_string(),
    })
}

#[command]
pub async fn reschedule_rental_line(
    dto: RescheduleRentalLineDto,
    state: State<'_, DbState>,
) -> Result<RescheduleRentalResult, AppError> {
    reschedule_rental_line_internal(&state.pool, &dto).await
}

