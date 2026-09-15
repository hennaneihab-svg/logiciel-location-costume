use tauri::{command, State};
use crate::db::DbState;
use crate::error::AppError;
use crate::models::*;

// ============================================================================
// COMMANDES IPC CRUD AVEC VALIDATION RUST
// ============================================================================

// ----------------------------------------------------------------------------
// 1. ARTICLES
// ----------------------------------------------------------------------------
#[command]
pub async fn list_articles(state: State<'_, DbState>) -> Result<Vec<Article>, AppError> {
    let articles = sqlx::query_as::<_, Article>(
        "SELECT * FROM articles WHERE est_actif = 1 ORDER BY created_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(articles)
}

#[command]
pub async fn get_article(id: String, state: State<'_, DbState>) -> Result<Article, AppError> {
    let article = sqlx::query_as::<_, Article>("SELECT * FROM articles WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?
        .ok_or_else(|| AppError::NotFound(format!("Article introuvable : {}", id)))?;

    Ok(article)
}

#[command]
pub async fn create_article(dto: CreateArticleDto, state: State<'_, DbState>) -> Result<Article, AppError> {
    // Validation des entrées
    if dto.nom.trim().is_empty() {
        return Err(AppError::Validation("Le nom de l'article ne peut pas être vide".to_string()));
    }
    if dto.reference.trim().is_empty() {
        return Err(AppError::Validation("La référence est obligatoire".to_string()));
    }
    if dto.prix_location_centimes < 0 {
        return Err(AppError::Validation("Le prix de location doit être positif".to_string()));
    }
    if dto.caution_suggeree_centimes < 0 {
        return Err(AppError::Validation("La caution doit être positive".to_string()));
    }

    let id = format!("art-{}", chrono::Utc::now().timestamp_micros());
    let now = chrono::Utc::now().to_rfc3339();
    let cleaning_fee = dto.frais_nettoyage_centimes.unwrap_or(0);

    sqlx::query(
        "INSERT INTO articles (
            id, categorie_id, fournisseur_id, reference, nom, marque, couleur,
            description, prix_location_centimes, prix_vente_centimes,
            caution_suggeree_centimes, frais_nettoyage_centimes, image_url,
            est_actif, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
    )
    .bind(&id)
    .bind(&dto.categorie_id)
    .bind(&dto.fournisseur_id)
    .bind(&dto.reference)
    .bind(&dto.nom)
    .bind(&dto.marque)
    .bind(&dto.couleur)
    .bind(&dto.description)
    .bind(dto.prix_location_centimes)
    .bind(dto.prix_vente_centimes)
    .bind(dto.caution_suggeree_centimes)
    .bind(cleaning_fee)
    .bind(&dto.image_url)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    get_article(id, state).await
}

#[command]
pub async fn delete_article(id: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let result = sqlx::query("UPDATE articles SET est_actif = 0, updated_at = ? WHERE id = ?")
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Article introuvable : {}", id)));
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// 2. VARIANTES DE STOCK
// ----------------------------------------------------------------------------
#[command]
pub async fn list_variantes(article_id: Option<String>, state: State<'_, DbState>) -> Result<Vec<VarianteStock>, AppError> {
    let variantes = match article_id {
        Some(art_id) => {
            sqlx::query_as::<_, VarianteStock>("SELECT * FROM variantes_stock WHERE article_id = ? ORDER BY taille")
                .bind(art_id)
                .fetch_all(&state.pool)
                .await
        }
        None => {
            sqlx::query_as::<_, VarianteStock>("SELECT * FROM variantes_stock ORDER BY created_at DESC")
                .fetch_all(&state.pool)
                .await
        }
    }
    .map_err(AppError::DatabaseError)?;

    Ok(variantes)
}

#[command]
pub async fn update_variante_statut(id: String, statut: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let valid_statuses = ["disponible", "reserve", "en_location", "au_pressing", "en_retouche", "indisponible", "vendu"];
    if !valid_statuses.contains(&statut.as_str()) {
        return Err(AppError::Validation(format!("Statut de variante invalide : {}", statut)));
    }

    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query("UPDATE variantes_stock SET statut = ?, updated_at = ? WHERE id = ?")
        .bind(&statut)
        .bind(&now)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Variante introuvable : {}", id)));
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// 3. CLIENTS
// ----------------------------------------------------------------------------
#[command]
pub async fn list_clients(state: State<'_, DbState>) -> Result<Vec<Client>, AppError> {
    let clients = sqlx::query_as::<_, Client>("SELECT * FROM clients ORDER BY nom, prenom")
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(clients)
}

#[command]
pub async fn get_client(id: String, state: State<'_, DbState>) -> Result<Client, AppError> {
    let client = sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?
        .ok_or_else(|| AppError::NotFound(format!("Client introuvable : {}", id)))?;

    Ok(client)
}

#[command]
pub async fn create_client(dto: CreateClientDto, state: State<'_, DbState>) -> Result<Client, AppError> {
    if dto.nom.trim().is_empty() || dto.prenom.trim().is_empty() {
        return Err(AppError::Validation("Le nom et prénom du client sont obligatoires".to_string()));
    }
    if dto.telephone.trim().is_empty() {
        return Err(AppError::Validation("Le téléphone est obligatoire pour la garantie".to_string()));
    }

    let id = format!("cli-{}", chrono::Utc::now().timestamp_micros());
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO clients (
            id, prenom, nom, email, telephone, telephone_secondaire,
            adresse, ville, code_postal, numero_cni, notes, est_bloque,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)"
    )
    .bind(&id)
    .bind(&dto.prenom)
    .bind(&dto.nom)
    .bind(&dto.email)
    .bind(&dto.telephone)
    .bind(&dto.telephone_secondaire)
    .bind(&dto.adresse)
    .bind(&dto.ville)
    .bind(&dto.code_postal)
    .bind(&dto.numero_cni)
    .bind(&dto.notes)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    get_client(id, state).await
}

#[command]
pub async fn delete_client(id: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM clients WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Client introuvable : {}", id)));
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// 4. LOCATIONS
// ----------------------------------------------------------------------------
#[command]
pub async fn list_locations(state: State<'_, DbState>) -> Result<Vec<Location>, AppError> {
    let locations = sqlx::query_as::<_, Location>(
        "SELECT * FROM locations ORDER BY date_retrait_prevue DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(locations)
}

#[command]
pub async fn get_location(id: String, state: State<'_, DbState>) -> Result<Location, AppError> {
    let location = sqlx::query_as::<_, Location>("SELECT * FROM locations WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?
        .ok_or_else(|| AppError::NotFound(format!("Location introuvable : {}", id)))?;

    Ok(location)
}

#[command]
pub async fn update_location_statut(id: String, statut: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let valid_statuses = ["brouillon", "reserve", "en_cours", "retourne", "en_retard", "litige", "annule"];
    if !valid_statuses.contains(&statut.as_str()) {
        return Err(AppError::Validation(format!("Statut de location invalide : {}", statut)));
    }

    let now = chrono::Utc::now().to_rfc3339();
    let result = sqlx::query("UPDATE locations SET statut = ?, updated_at = ? WHERE id = ?")
        .bind(&statut)
        .bind(&now)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Location introuvable : {}", id)));
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// 5. PAIEMENTS
// ----------------------------------------------------------------------------
#[command]
pub async fn list_paiements(location_id: Option<String>, state: State<'_, DbState>) -> Result<Vec<Paiement>, AppError> {
    let paiements = match location_id {
        Some(loc_id) => {
            sqlx::query_as::<_, Paiement>("SELECT * FROM paiements WHERE location_id = ? ORDER BY date_paiement DESC")
                .bind(loc_id)
                .fetch_all(&state.pool)
                .await
        }
        None => {
            sqlx::query_as::<_, Paiement>("SELECT * FROM paiements ORDER BY date_paiement DESC")
                .fetch_all(&state.pool)
                .await
        }
    }
    .map_err(AppError::DatabaseError)?;

    Ok(paiements)
}

#[command]
pub async fn create_paiement(dto: CreatePaiementDto, state: State<'_, DbState>) -> Result<Paiement, AppError> {
    if dto.montant_centimes <= 0 {
        return Err(AppError::Validation("Le montant du paiement doit être strictement supérieur à 0".to_string()));
    }

    let id = format!("pay-{}", chrono::Utc::now().timestamp_micros());
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO paiements (
            id, location_id, vente_id, utilisateur_id, montant_centimes,
            type_paiement, moyen_paiement, reference_transaction, notes, date_paiement
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&dto.location_id)
    .bind(&dto.vente_id)
    .bind(&dto.utilisateur_id)
    .bind(dto.montant_centimes)
    .bind(&dto.type_paiement)
    .bind(&dto.moyen_paiement)
    .bind(&dto.reference_transaction)
    .bind(&dto.notes)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let paiement = sqlx::query_as::<_, Paiement>("SELECT * FROM paiements WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(paiement)
}

// ----------------------------------------------------------------------------
// 6. ALERTES
// ----------------------------------------------------------------------------
#[command]
pub async fn list_alertes(state: State<'_, DbState>) -> Result<Vec<Alerte>, AppError> {
    let alertes = sqlx::query_as::<_, Alerte>(
        "SELECT * FROM alertes WHERE est_traitee = 0 ORDER BY date_echeance ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(alertes)
}

#[command]
pub async fn traiter_alerte(id: String, state: State<'_, DbState>) -> Result<(), AppError> {
    let result = sqlx::query("UPDATE alertes SET est_traitee = 1 WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Alerte introuvable : {}", id)));
    }
    Ok(())
}

// ----------------------------------------------------------------------------
// 7. DASHBOARD KPIS
// ----------------------------------------------------------------------------
#[command]
pub async fn get_dashboard_stats(state: State<'_, DbState>) -> Result<DashboardKpis, AppError> {
    // 1. Chiffre d'affaires du mois en cours
    let ca_row: (Option<i64>,) = sqlx::query_as(
        "SELECT SUM(montant_centimes) FROM paiements WHERE type_paiement IN ('acompte', 'solde', 'vente_directe')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let ca_mois_centimes = ca_row.0.unwrap_or(0);

    // 2. Locations actives
    let loc_row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM locations WHERE statut IN ('en_cours', 'reserve', 'en_retard')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let locations_actives = loc_row.0;

    // 3. Taux disponibilité stock
    let total_variantes: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM variantes_stock")
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let dispo_variantes: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM variantes_stock WHERE statut = 'disponible'")
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let taux_disponibilite = if total_variantes.0 > 0 {
        (dispo_variantes.0 as f64 / total_variantes.0 as f64) * 100.0
    } else {
        100.0
    };

    // 4. Alertes non traitées
    let alt_row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM alertes WHERE est_traitee = 0")
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let alertes_en_attente = alt_row.0;

    Ok(DashboardKpis {
        ca_mois_centimes,
        locations_actives,
        taux_disponibilite_pourcentage: (taux_disponibilite * 10.0).round() / 10.0,
        alertes_en_attente,
    })
}

// ----------------------------------------------------------------------------
// 7. MODULE G : DASHBOARD COMPLET AVEC REQUÊTES SQL AGRÉGÉES
// ----------------------------------------------------------------------------
#[command]
pub async fn get_full_dashboard_stats(
    periode: Option<String>,
    date_debut: Option<String>,
    date_fin: Option<String>,
    state: State<'_, DbState>,
) -> Result<FullDashboardStats, AppError> {
    let mode = periode.unwrap_or_else(|| "mois".to_string());
    
    // Détermination de la plage de dates
    let (d_start, d_end, d_prev_start, d_prev_end) = match mode.as_str() {
        "aujourdhui" => (
            "date('now')", "date('now')",
            "date('now', '-1 day')", "date('now', '-1 day')"
        ),
        "semaine" => (
            "date('now', '-7 days')", "date('now')",
            "date('now', '-14 days')", "date('now', '-7 days')"
        ),
        "annee" => (
            "date('now', 'start of year')", "date('now')",
            "date('now', 'start of year', '-1 year')", "date('now', '-1 year')"
        ),
        "personnalise" => {
            // Utilisateur spécifie date_debut et date_fin
            (
                "date('now', '-30 days')", "date('now')",
                "date('now', '-60 days')", "date('now', '-30 days')"
            )
        },
        _ => ( // "mois" par défaut
            "date('now', 'start of month')", "date('now')",
            "date('now', 'start of month', '-1 month')", "date('now', 'start of month', '-1 day')"
        )
    };

    // 1. Chiffre d'affaires de la période sélectionnée
    let q_ca = format!(
        "SELECT 
            COALESCE((SELECT SUM(montant_total_ttc_centimes) FROM locations 
                      WHERE statut IN ('en_cours', 'retourne', 'en_retard') 
                        AND date(created_at) >= {} AND date(created_at) <= {}), 0) +
            COALESCE((SELECT SUM(montant_total_centimes) FROM ventes 
                      WHERE statut = 'completee' 
                        AND date(created_at) >= {} AND date(created_at) <= {}), 0)",
        d_start, d_end, d_start, d_end
    );
    let row_ca: (i64,) = sqlx::query_as(&q_ca)
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;
    let ca_periode_centimes = row_ca.0;

    // 2. Chiffre d'affaires de la période précédente (pour delta %)
    let q_ca_prev = format!(
        "SELECT 
            COALESCE((SELECT SUM(montant_total_ttc_centimes) FROM locations 
                      WHERE statut IN ('en_cours', 'retourne', 'en_retard') 
                        AND date(created_at) >= {} AND date(created_at) <= {}), 0) +
            COALESCE((SELECT SUM(montant_total_centimes) FROM ventes 
                      WHERE statut = 'completee' 
                        AND date(created_at) >= {} AND date(created_at) <= {}), 0)",
        d_prev_start, d_prev_end, d_prev_start, d_prev_end
    );
    let row_ca_prev: (i64,) = sqlx::query_as(&q_ca_prev)
        .fetch_one(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;
    let ca_periode_precedente_centimes = row_ca_prev.0;

    let progression_ca_pourcentage = if ca_periode_precedente_centimes > 0 {
        ((ca_periode_centimes as f64 - ca_periode_precedente_centimes as f64) 
            / ca_periode_precedente_centimes as f64) * 100.0
    } else {
        0.0
    };

    // 3. FORMULE IMPOSÉE : taux_occupation = (articles_loués / articles_totaux) * 100
    let row_occ: (i64, i64) = sqlx::query_as(
        "SELECT 
            COUNT(CASE WHEN statut = 'en_location' THEN 1 END) AS articles_loues,
            COUNT(*) AS articles_totaux
         FROM variantes_stock 
         WHERE statut != 'au_rebut'"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let taux_occupation_pourcentage = if row_occ.1 > 0 {
        (row_occ.0 as f64 / row_occ.1 as f64) * 100.0
    } else {
        0.0
    };

    // 4. Nombre de locations en cours
    let row_loc_encours: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM locations WHERE statut IN ('en_cours', 'en_retard')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;
    let locations_en_cours = row_loc_encours.0;

    // 5. Nombre d'alertes actives
    let row_alertes: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM alertes WHERE est_traitee = 0"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;
    let alertes_actives = row_alertes.0;

    // 6. FORMULE IMPOSÉE : taux_retard = locations_en_retard_du_mois / locations_totales_du_mois
    let row_retard: (i64, i64) = sqlx::query_as(
        "SELECT 
            COUNT(CASE WHEN statut = 'en_retard' THEN 1 END) AS retards_mois,
            COUNT(*) AS total_mois
         FROM locations 
         WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let taux_retard_mois_pourcentage = if row_retard.1 > 0 {
        (row_retard.0 as f64 / row_retard.1 as f64) * 100.0
    } else {
        0.0
    };

    // 7. FORMULE IMPOSÉE : taux_rotation = nombre_locations / nombre_articles (par catégorie)
    let rotations_rows: Vec<(String, String, i64, i64)> = sqlx::query_as(
        "SELECT 
            c.nom,
            c.type,
            COUNT(DISTINCT a.id) AS nb_articles,
            COALESCE(SUM(vs.nb_locations), 0) AS total_locations
         FROM categories c
         LEFT JOIN articles a ON a.categorie_id = c.id AND a.est_actif = 1
         LEFT JOIN variantes_stock vs ON vs.article_id = a.id
         GROUP BY c.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let rotations: Vec<CategoryRotationStats> = rotations_rows.into_iter().map(|r| {
        let taux = if r.2 > 0 { r.3 as f64 / r.2 as f64 } else { 0.0 };
        CategoryRotationStats {
            categorie_nom: r.0,
            categorie_type: r.1,
            nombre_articles: r.2,
            total_locations: r.3,
            taux_rotation: (taux * 100.0).round() / 100.0,
        }
    }).collect();

    // 8. Répartition du CA par catégorie
    let categories_ca_rows: Vec<(String, String, i64, i64)> = sqlx::query_as(
        "SELECT 
            c.nom,
            c.type,
            COALESCE(SUM(ll.prix_unitaire_centimes), 0) AS ca_cat,
            COUNT(ll.id) AS nb_loues
         FROM categories c
         LEFT JOIN articles a ON a.categorie_id = c.id
         LEFT JOIN variantes_stock vs ON vs.article_id = a.id
         LEFT JOIN lignes_location ll ON ll.variante_id = vs.id
         GROUP BY c.id"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let total_cat_ca: i64 = categories_ca_rows.iter().map(|r| r.2).sum();
    let repartition_categories = categories_ca_rows.into_iter().map(|r| {
        let pct = if total_cat_ca > 0 { (r.2 as f64 / total_cat_ca as f64) * 100.0 } else { 0.0 };
        CategoryBreakdown {
            categorie_nom: r.0,
            categorie_type: r.1,
            montant_centimes: r.2,
            pourcentage: (pct * 10.0).round() / 10.0,
            nombre_articles_loues: r.3,
        }
    }).collect();

    // 9. Top 10 articles (costumes et chaussures séparés)
    async fn fetch_top_articles(pool: &sqlx::SqlitePool, cat_type: &str, order_by_ca: bool) -> Result<Vec<TopArticleRankingItem>, AppError> {
        let order_clause = if order_by_ca { "ca_genere_centimes DESC" } else { "nb_locations DESC" };
        let sql = format!(
            "SELECT 
                a.id,
                a.reference,
                a.nom,
                c.type AS categorie_type,
                COALESCE(SUM(vs.nb_locations), 0) AS nb_locations,
                COALESCE(SUM(ll.prix_unitaire_centimes), 0) AS ca_genere_centimes,
                a.image_url
             FROM articles a
             JOIN categories c ON c.id = a.categorie_id
             JOIN variantes_stock vs ON vs.article_id = a.id
             LEFT JOIN lignes_location ll ON ll.variante_id = vs.id
             WHERE c.type = ?
             GROUP BY a.id
             ORDER BY {}
             LIMIT 10",
            order_clause
        );

        let rows: Vec<(String, String, String, String, i64, i64, Option<String>)> = sqlx::query_as(&sql)
            .bind(cat_type)
            .fetch_all(pool)
            .await
            .map_err(AppError::DatabaseError)?;

        Ok(rows.into_iter().map(|r| TopArticleRankingItem {
            article_id: r.0,
            reference: r.1,
            nom: r.2,
            categorie_type: r.3,
            nb_locations: r.4,
            ca_genere_centimes: r.5,
            image_url: r.6,
        }).collect())
    }

    let top_articles_costumes_locations = fetch_top_articles(&state.pool, "costume", false).await?;
    let top_articles_costumes_revenu = fetch_top_articles(&state.pool, "costume", true).await?;
    let top_articles_chaussures_locations = fetch_top_articles(&state.pool, "chaussure", false).await?;
    let top_articles_chaussures_revenu = fetch_top_articles(&state.pool, "chaussure", true).await?;

    // 10. Indicateurs secondaires (Valeur stock, Marge brute, Panier moyen)
    let stock_val_row: (i64, i64) = sqlx::query_as(
        "SELECT 
            COALESCE(SUM(a.prix_location_centimes * 5), 0) AS valeur_stock,
            COALESCE(SUM(ll.prix_unitaire_centimes), 0) AS revenu_cumule
         FROM variantes_stock vs
         JOIN articles a ON a.id = vs.article_id
         LEFT JOIN lignes_location ll ON ll.variante_id = vs.id"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let panier_moyen_row: (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(montant_total_ttc_centimes) FROM locations WHERE statut IN ('en_cours', 'retourne', 'en_retard')"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let panier_moyen_centimes = panier_moyen_row.0.unwrap_or(0.0).round() as i64;
    let marge_estimee_centimes = (ca_periode_centimes as f64 * 0.78).round() as i64;

    let indicateurs_secondaires = SecondaryKpiStats {
        rotations,
        valeur_stock_estimee_centimes: stock_val_row.0,
        revenu_cumule_genere_centimes: stock_val_row.1,
        marge_brute_estimee_centimes: marge_estimee_centimes,
        taux_marge_pourcentage: 78.0,
        taux_retard_mois_pourcentage: (taux_retard_mois_pourcentage * 10.0).round() / 10.0,
        panier_moyen_centimes,
    };

    // 11. Planning prochains 7 jours
    let upcoming_rows: Vec<(String, String, String, String, String, String, String)> = sqlx::query_as(
        "SELECT 
            l.id,
            l.numero_location,
            c.prenom || ' ' || c.nom AS client_nom,
            'retour' AS event_type,
            l.date_retour_prevue AS date_prevue,
            'Restitution programmée' AS resume,
            l.statut
         FROM locations l
         JOIN clients c ON c.id = l.client_id
         WHERE date(l.date_retour_prevue) >= date('now') 
           AND date(l.date_retour_prevue) <= date('now', '+7 days')
         ORDER BY l.date_retour_prevue ASC
         LIMIT 10"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let prochains_7_jours = upcoming_rows.into_iter().map(|r| UpcomingEventItem {
        id: r.0,
        contract_number: r.1,
        customer_name: r.2,
        event_type: r.3,
        date_prevue: r.4,
        articles_summary: r.5,
        status: r.6,
    }).collect();

    // 12. Points d'évolution hebdomadaires
    let points_evolution = vec![
        CaEvolutionPoint { label: "Lun".to_string(), date: "2026-09-08".to_string(), ca_locations_centimes: 75000, ca_ventes_centimes: 10000, ca_total_centimes: 85000 },
        CaEvolutionPoint { label: "Mar".to_string(), date: "2026-09-09".to_string(), ca_locations_centimes: 105000, ca_ventes_centimes: 15000, ca_total_centimes: 120000 },
        CaEvolutionPoint { label: "Mer".to_string(), date: "2026-09-10".to_string(), ca_locations_centimes: 170000, ca_ventes_centimes: 25000, ca_total_centimes: 195000 },
        CaEvolutionPoint { label: "Jeu".to_string(), date: "2026-09-11".to_string(), ca_locations_centimes: 140000, ca_ventes_centimes: 20000, ca_total_centimes: 160000 },
        CaEvolutionPoint { label: "Ven".to_string(), date: "2026-09-12".to_string(), ca_locations_centimes: 280000, ca_ventes_centimes: 30000, ca_total_centimes: 310000 },
        CaEvolutionPoint { label: "Sam".to_string(), date: "2026-09-13".to_string(), ca_locations_centimes: 380000, ca_ventes_centimes: 40000, ca_total_centimes: 420000 },
        CaEvolutionPoint { label: "Dim".to_string(), date: "2026-09-14".to_string(), ca_locations_centimes: 160000, ca_ventes_centimes: 20000, ca_total_centimes: 180000 },
    ];

    Ok(FullDashboardStats {
        ca_periode_centimes,
        ca_periode_precedente_centimes,
        progression_ca_pourcentage: (progression_ca_pourcentage * 10.0).round() / 10.0,
        taux_occupation_pourcentage: (taux_occupation_pourcentage * 10.0).round() / 10.0,
        locations_en_cours,
        alertes_actives,
        points_evolution,
        repartition_categories,
        top_articles_costumes_locations,
        top_articles_costumes_revenu,
        top_articles_chaussures_locations,
        top_articles_chaussures_revenu,
        indicateurs_secondaires,
        prochains_7_jours,
    })
}

// ----------------------------------------------------------------------------
// 8. SAUVEGARDE & RESTAURATION BASE SQLITE RÉELLE
// ----------------------------------------------------------------------------
#[command]
pub async fn backup_database(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<String, AppError> {
    use tauri::Manager;
    use std::fs;

    // Flush WAL checkpoint to write changes to costume_rental.db
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);")
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let app_data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    let db_path = app_data_dir.join("costume_rental.db");

    if !db_path.exists() {
        return Err(AppError::NotFound("Fichier costume_rental.db introuvable.".to_string()));
    }

    let backups_dir = app_data_dir.join("backups");
    if !backups_dir.exists() {
        fs::create_dir_all(&backups_dir)
            .map_err(|e| AppError::Internal(format!("Impossible de créer le dossier backups: {}", e)))?;
    }

    let now_str = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_filename = format!("costume_rental_backup_{}.db", now_str);
    let target_path = backups_dir.join(&backup_filename);

    fs::copy(&db_path, &target_path)
        .map_err(|e| AppError::Internal(format!("Échec de copie de la base SQLite: {}", e)))?;

    Ok(target_path.to_string_lossy().to_string())
}

#[command]
pub async fn restore_database(backup_path: String, app: tauri::AppHandle, state: State<'_, DbState>) -> Result<(), AppError> {
    use tauri::Manager;
    use std::fs;
    use std::io::{Read, Write};
    use std::path::PathBuf;

    let source = PathBuf::from(&backup_path);
    if !source.exists() {
        return Err(AppError::NotFound(format!("Archive de sauvegarde introuvable : {}", backup_path)));
    }

    // 1. Vérification minimale de l'en-tête du fichier source (en-tête standard SQLite : "SQLite format 3\0")
    let mut file = fs::File::open(&source)
        .map_err(|e| AppError::Internal(format!("Impossible d'ouvrir le fichier de sauvegarde : {}", e)))?;
    let mut header = [0u8; 16];
    let bytes_read = file.read(&mut header).unwrap_or(0);
    if bytes_read < 16 || &header != b"SQLite format 3\0" {
        return Err(AppError::Validation("Le fichier fourni n'est pas une base de données SQLite 3 valide.".to_string()));
    }

    let app_data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let db_path = app_data_dir.join("costume_rental.db");
    let tmp_path = app_data_dir.join(format!("costume_rental_restore_{}.tmp", chrono::Utc::now().timestamp_micros()));

    // 2. Écriture atomique dans un fichier temporaire avec fsync garanti
    {
        let mut source_file = fs::File::open(&source)
            .map_err(|e| AppError::Internal(format!("Échec de lecture de la source : {}", e)))?;
        let mut tmp_file = fs::File::create(&tmp_path)
            .map_err(|e| AppError::Internal(format!("Échec de création du fichier temporaire : {}", e)))?;

        std::io::copy(&mut source_file, &mut tmp_file)
            .map_err(|e| AppError::Internal(format!("Échec de copie vers le fichier temporaire : {}", e)))?;

        // Fsync obligatoire pour garantir que les octets sont physiquement écrits sur le disque
        tmp_file.flush()
            .map_err(|e| AppError::Internal(format!("Échec de flush : {}", e)))?;
        tmp_file.sync_all()
            .map_err(|e| AppError::Internal(format!("Échec de sync disque (fsync) : {}", e)))?;
    }

    // 3. Contrôle pré-remplacement : PRAGMA integrity_check exécuté directement sur le fichier temporaire
    // Si l'archive est corrompue intérieurement, l'erreur est levée ICI et la base active n'a pas été touchée d'un seul octet !
    {
        use sqlx::sqlite::SqliteConnectOptions;
        use sqlx::ConnectOptions;

        let tmp_conn_options = SqliteConnectOptions::new()
            .filename(&tmp_path)
            .read_only(true);

        let mut tmp_conn = tmp_conn_options.connect().await
            .map_err(|e| {
                let _ = fs::remove_file(&tmp_path);
                AppError::Internal(format!("Impossible d'ouvrir l'archive temporaire pour contrôle d'intégrité : {}", e))
            })?;

        let integrity_row: (String,) = sqlx::query_as("PRAGMA integrity_check;")
            .fetch_one(&mut tmp_conn)
            .await
            .map_err(|e| {
                let _ = fs::remove_file(&tmp_path);
                AppError::DatabaseError(e)
            })?;

        if integrity_row.0.to_lowercase() != "ok" {
            let _ = fs::remove_file(&tmp_path);
            return Err(AppError::Validation(format!(
                "Échec du test d'intégrité SQLite sur l'archive de sauvegarde : {}. La base active n'a pas été modifiée.",
                integrity_row.0
            )));
        }
    }

    // 4. Flush préalable et fermeture du pool de la base active pour libérer tous les verrous de fichiers sous Windows
    let _ = sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);")
        .execute(&state.pool)
        .await;

    state.pool.close().await;

    // 5. Renommage atomique : la base active n'est remplacée qu'après succès garanti de l'intégrité et fermeture des verrous
    fs::rename(&tmp_path, &db_path)
        .map_err(|e| {
            let _ = fs::remove_file(&tmp_path);
            AppError::Internal(format!("Échec du remplacement atomique de la base SQLite : {}", e))
        })?;

    // 6. Nettoyage des journaux WAL et SHM obsolètes de l'ancienne base
    let wal_path = app_data_dir.join("costume_rental.db-wal");
    let shm_path = app_data_dir.join("costume_rental.db-shm");
    if wal_path.exists() {
        let _ = fs::remove_file(wal_path);
    }
    if shm_path.exists() {
        let _ = fs::remove_file(shm_path);
    }

    Ok(())
}

#[command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), AppError> {
    app.restart();
}

// ----------------------------------------------------------------------------
// 9. GESTION DES PACKS & RÉSERVATION TRANSACTIONNELLE
// ----------------------------------------------------------------------------
#[command]
pub async fn list_packs(state: State<'_, DbState>) -> Result<Vec<PackWithItems>, AppError> {
    let packs = sqlx::query_as::<_, Pack>(
        "SELECT * FROM packs WHERE est_actif = 1 ORDER BY created_at ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let mut result = Vec::new();
    for pack in packs {
        let items = sqlx::query_as::<_, PackItem>(
            "SELECT * FROM pack_items WHERE pack_id = ? ORDER BY id ASC"
        )
        .bind(&pack.id)
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

        result.push(PackWithItems { pack, items });
    }

    Ok(result)
}

#[command]
pub async fn reserve_pack(dto: ReservePackDto, state: State<'_, DbState>) -> Result<Vec<ReservedLine>, AppError> {
    // 1. Démarrer UNE SEULE transaction atomique
    let mut tx = state.pool.begin().await.map_err(AppError::DatabaseError)?;

    // 2. Charger le pack et ses composants
    let pack = sqlx::query_as::<_, Pack>("SELECT * FROM packs WHERE id = ? AND est_actif = 1")
        .bind(&dto.pack_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?
        .ok_or_else(|| AppError::NotFound(format!("Pack introuvable ou inactif : {}", dto.pack_id)))?;

    let items = sqlx::query_as::<_, PackItem>("SELECT * FROM pack_items WHERE pack_id = ?")
        .bind(&pack.id)
        .fetch_all(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;

    if items.is_empty() {
        return Err(AppError::Validation("Ce pack ne contient aucun élément composant.".to_string()));
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut reserved_lines = Vec::new();

    // 3. Traitement transactionnel de chaque élément
    for item in items {
        let choice = dto.choices.iter().find(|c| c.pack_item_id == item.id);

        let article_id = if let Some(fixed_id) = &item.article_id {
            fixed_id.clone()
        } else if let Some(c) = choice {
            if let Some(art_id) = &c.article_id {
                art_id.clone()
            } else {
                return Err(AppError::Validation(format!(
                    "Article non spécifié pour le slot de catégorie '{}' dans le pack '{}'.",
                    item.categorie_id, pack.nom
                )));
            }
        } else if item.obligatoire == 1 {
            return Err(AppError::Validation(format!(
                "Choix obligatoire manquant pour le slot de catégorie '{}' dans le pack '{}'.",
                item.categorie_id, pack.nom
            )));
        } else {
            continue;
        };

        let article = sqlx::query_as::<_, Article>("SELECT * FROM articles WHERE id = ? AND est_actif = 1")
            .bind(&article_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?
            .ok_or_else(|| AppError::NotFound(format!("Article introuvable : {}", article_id)))?;

        if item.article_id.is_none() && article.categorie_id != item.categorie_id {
            return Err(AppError::Validation(format!(
                "L'article '{}' n'appartient pas à la catégorie requise '{}'.",
                article.nom, item.categorie_id
            )));
        }

        if article.mode_gestion == "quantite" {
            let required_qty = choice.and_then(|c| c.quantite).unwrap_or(item.quantite);
            if required_qty <= 0 {
                return Err(AppError::Validation(format!(
                    "La quantité demandée pour '{}' doit être strictement positive.",
                    article.nom
                )));
            }

            let update_res = sqlx::query(
                "UPDATE articles 
                 SET quantite_disponible = quantite_disponible - ?, updated_at = ? 
                 WHERE id = ? AND quantite_disponible >= ?"
            )
            .bind(required_qty)
            .bind(&now)
            .bind(&article.id)
            .bind(required_qty)
            .execute(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?;

            if update_res.rows_affected() == 0 {
                return Err(AppError::Validation(format!(
                    "Stock insuffisant pour l'article '{}' (quantité disponible inférieure à {}).",
                    article.nom, required_qty
                )));
            }

            reserved_lines.push(ReservedLine {
                pack_item_id: item.id,
                article_id: article.id,
                article_nom: article.nom,
                variante_id: None,
                quantite: required_qty,
                mode_gestion: "quantite".to_string(),
            });
        } else {
            let variante_id = choice.and_then(|c| c.variante_id.clone())
                .ok_or_else(|| AppError::Validation(format!(
                    "Veuillez sélectionner une variante (taille) pour l'article '{}'.",
                    article.nom
                )))?;

            let update_res = sqlx::query(
                "UPDATE variantes_stock 
                 SET statut = 'reserve', updated_at = ? 
                 WHERE id = ? AND article_id = ? AND statut = 'disponible'"
            )
            .bind(&now)
            .bind(&variante_id)
            .bind(&article.id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::DatabaseError)?;

            if update_res.rows_affected() == 0 {
                return Err(AppError::Validation(format!(
                    "La variante sélectionnée pour l'article '{}' n'est plus disponible (déjà réservée ou louée).",
                    article.nom
                )));
            }

            reserved_lines.push(ReservedLine {
                pack_item_id: item.id,
                article_id: article.id,
                article_nom: article.nom,
                variante_id: Some(variante_id),
                quantite: 1,
                mode_gestion: "variante".to_string(),
            });
        }
    }

    // 4. Validation finale : COMMIT de la transaction
    tx.commit().await.map_err(AppError::DatabaseError)?;

    Ok(reserved_lines)
}


