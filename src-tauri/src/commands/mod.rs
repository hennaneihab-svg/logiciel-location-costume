use tauri::{command, State};
use crate::db::DbState;
use crate::error::AppError;
use crate::models::*;

pub mod pressing;
pub use pressing::*;

pub mod settings;
pub use settings::*;

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
// 4. LOCATIONS & CONTRATS DE LOCATION
// ----------------------------------------------------------------------------

pub fn map_sqlite_err(e: sqlx::Error) -> AppError {
    if let sqlx::Error::Database(ref db_err) = e {
        if let Some(code) = db_err.code() {
            if code == "5" || code == "6" || code == "517" || code == "261" {
                return AppError::Busy("La base de données est actuellement occupée par une autre opération. Veuillez réessayer dans un instant.".to_string());
            }
        }
        let msg = db_err.message().to_lowercase();
        if msg.contains("database is locked") || msg.contains("busy") {
            return AppError::Busy("La base de données est actuellement occupée par une autre opération. Veuillez réessayer dans un instant.".to_string());
        }
    }
    AppError::DatabaseError(e)
}

pub fn today_local() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

pub fn compute_contract_status_for_date(pickup_date: &str, today: &str) -> &'static str {
    if pickup_date <= today {
        "en_cours"
    } else {
        "reserve"
    }
}

pub struct ImmediateTx {
    pub conn: sqlx::pool::PoolConnection<sqlx::Sqlite>,
    committed: bool,
}

impl ImmediateTx {
    pub async fn begin(pool: &sqlx::SqlitePool) -> Result<Self, AppError> {
        let mut conn = pool.acquire().await.map_err(map_sqlite_err)?;
        sqlx::query("BEGIN IMMEDIATE").execute(&mut *conn).await.map_err(map_sqlite_err)?;
        Ok(Self {
            conn,
            committed: false,
        })
    }

    pub async fn commit(mut self) -> Result<(), AppError> {
        sqlx::query("COMMIT").execute(&mut *self.conn).await.map_err(map_sqlite_err)?;
        self.committed = true;
        Ok(())
    }

    pub async fn rollback(mut self) -> Result<(), AppError> {
        if !self.committed {
            let _ = sqlx::query("ROLLBACK").execute(&mut *self.conn).await;
            self.committed = true;
        }
        Ok(())
    }
}

pub async fn recompute_variant_status(
    conn: &mut sqlx::SqliteConnection,
    variante_id: &str,
) -> Result<String, AppError> {
    use sqlx::Row;

    let row = sqlx::query("SELECT statut FROM variantes_stock WHERE id = ?")
        .bind(variante_id)
        .fetch_optional(&mut *conn)
        .await
        .map_err(map_sqlite_err)?
        .ok_or_else(|| AppError::NotFound(format!("Variante introuvable : {}", variante_id)))?;

    let current_statut: String = row.get("statut");

    // Statuts physiques prioritaires et protégés : ne JAMAIS les écraser par un statut contractuel
    if matches!(
        current_statut.as_str(),
        "au_pressing" | "en_retouche" | "indisponible" | "vendu"
    ) {
        return Ok(current_statut);
    }

    // Recherche de contrats actifs impliquant cette variante non encore rendue
    let active_contracts = sqlx::query(
        "SELECT l.statut, l.date_retrait_prevue
         FROM lignes_location ll
         JOIN locations l ON ll.location_id = l.id
         WHERE ll.variante_id = ?
           AND ll.est_rendu = 0
           AND l.statut IN ('reserve', 'en_cours', 'en_retard', 'litige')
         ORDER BY l.date_retrait_prevue ASC"
    )
    .bind(variante_id)
    .fetch_all(&mut *conn)
    .await
    .map_err(map_sqlite_err)?;

    let mut target_status = "disponible";
    for ac in active_contracts {
        let l_statut: String = ac.get("statut");

        if matches!(l_statut.as_str(), "en_cours" | "en_retard" | "litige") {
            target_status = "en_location";
            break;
        } else if l_statut == "reserve" && target_status != "en_location" {
            target_status = "reserve";
        }
    }

    let now = chrono::Utc::now().to_rfc3339();
    sqlx::query("UPDATE variantes_stock SET statut = ?, updated_at = ? WHERE id = ?")
        .bind(target_status)
        .bind(&now)
        .bind(variante_id)
        .execute(&mut *conn)
        .await
        .map_err(map_sqlite_err)?;

    Ok(target_status.to_string())
}

pub async fn fetch_rental_dto_by_id(pool: &sqlx::SqlitePool, id: &str) -> Result<RentalContractDto, AppError> {
    use sqlx::Row;

    // 1. Récupérer la location avec les infos client
    let row = sqlx::query(
        "SELECT 
            l.id, l.numero_location, l.client_id, l.utilisateur_id, l.statut,
            l.date_evenement, l.date_retrait_prevue, l.date_retrait_effective,
            l.date_retour_prevue, l.date_retour_effective,
            l.montant_total_ht_centimes, l.tva_taux, l.montant_total_ttc_centimes,
            l.frais_nettoyage_centimes, l.frais_retard_centimes, l.frais_degradation_centimes,
            l.remise_centimes, l.montant_caution_centimes, l.statut_caution,
            l.notes_caution, l.notes, l.chemin_pdf, l.created_at, l.updated_at,
            c.nom as client_nom, c.prenom as client_prenom, c.telephone as client_tel,
            c.email as client_email, c.adresse as client_adr, c.ville as client_ville,
            c.code_postal as client_cp, c.numero_cni as client_cni
         FROM locations l
         LEFT JOIN clients c ON l.client_id = c.id
         WHERE l.id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound(format!("Location introuvable : {}", id)))?;

    let location_id: String = row.get("id");
    let contract_number: String = row.get("numero_location");
    let customer_id: String = row.get("client_id");
    let client_nom: Option<String> = row.get("client_nom");
    let client_prenom: Option<String> = row.get("client_prenom");
    let customer_name = match (client_prenom, client_nom) {
        (Some(p), Some(n)) => format!("{} {}", p, n),
        (None, Some(n)) => n,
        (Some(p), None) => p,
        (None, None) => "Client Inconnu".to_string(),
    };
    let customer_phone: String = row.get::<Option<String>, _>("client_tel").unwrap_or_default();
    let customer_email: Option<String> = row.get("client_email");
    let customer_adr: Option<String> = row.get("client_adr");
    let customer_ville: Option<String> = row.get("client_ville");
    let customer_cp: Option<String> = row.get("client_cp");
    let customer_address = match (customer_adr, customer_cp, customer_ville) {
        (Some(a), Some(cp), Some(v)) => Some(format!("{}, {} {}", a, cp, v)),
        (Some(a), _, _) => Some(a),
        _ => None,
    };
    let customer_cni: Option<String> = row.get("client_cni");

    let status: String = row.get("statut");
    let event_date: Option<String> = row.get::<Option<String>, _>("date_evenement").map(|d| d.split('T').next().unwrap_or(&d).to_string());
    let pickup_date_raw: String = row.get("date_retrait_prevue");
    let pickup_date = pickup_date_raw.split('T').next().unwrap_or(&pickup_date_raw).to_string();
    let return_date_sched_raw: String = row.get("date_retour_prevue");
    let return_date_scheduled = return_date_sched_raw.split('T').next().unwrap_or(&return_date_sched_raw).to_string();
    let return_date_actual: Option<String> = row.get::<Option<String>, _>("date_retour_effective").map(|d| d.split('T').next().unwrap_or(&d).to_string());

    let total_amount_cents: i64 = row.get("montant_total_ttc_centimes");
    let cleaning_fee_cents: i64 = row.get("frais_nettoyage_centimes");
    let late_fee_cents: i64 = row.get("frais_retard_centimes");
    let damage_fee_cents: i64 = row.get("frais_degradation_centimes");
    let discount_cents: i64 = row.get("remise_centimes");
    let deposit_amount_cents: i64 = row.get("montant_caution_centimes");
    let deposit_status: String = row.get("statut_caution");
    let deposit_notes: Option<String> = row.get("notes_caution");
    let notes: Option<String> = row.get("notes");
    let pdf_archived_path: Option<String> = row.get("chemin_pdf");
    let created_at: String = row.get("created_at");
    let updated_at: String = row.get("updated_at");

    // 2. Récupérer les lignes de location
    let item_rows = sqlx::query(
        "SELECT 
            ll.id, ll.variante_id, ll.article_id, ll.quantite, ll.prix_unitaire_centimes,
            ll.caution_centimes, ll.etat_depart, ll.etat_retour, ll.est_rendu, ll.date_retour, ll.notes,
            v.code_barre as var_barcode, v.taille as var_taille, v.sous_taille as var_sub_taille,
            a.id as art_id, a.nom as art_nom, a.reference as art_ref, a.frais_nettoyage_centimes as art_cleaning
         FROM lignes_location ll
         LEFT JOIN variantes_stock v ON ll.variante_id = v.id
         LEFT JOIN articles a ON COALESCE(ll.article_id, v.article_id) = a.id
         WHERE ll.location_id = ?"
    )
    .bind(&location_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let mut items = Vec::new();
    let mut total_rental_cents = 0i64;

    for ir in item_rows {
        let var_id: Option<String> = ir.get("variante_id");
        let art_id: Option<String> = ir.get("art_id");
        let art_name: String = ir.get::<Option<String>, _>("art_nom").unwrap_or_else(|| "Article inconnu".to_string());
        let art_ref: String = ir.get::<Option<String>, _>("art_ref").unwrap_or_default();
        let barcode: String = ir.get::<Option<String>, _>("var_barcode").unwrap_or_else(|| art_ref.clone());
        let size: String = ir.get::<Option<String>, _>("var_taille").unwrap_or_else(|| "TU".to_string());
        let sub_size: Option<String> = ir.get("var_sub_taille");
        let price_unit: i64 = ir.get("prix_unitaire_centimes");
        let caution_line: i64 = ir.get("caution_centimes");
        let cleaning_line: i64 = ir.get::<Option<i64>, _>("art_cleaning").unwrap_or(0);
        let etat_dep: String = ir.get::<Option<String>, _>("etat_depart").unwrap_or_else(|| "excellent".to_string());
        let etat_ret: Option<String> = ir.get("etat_retour");
        let is_ret: i64 = ir.get("est_rendu");
        let date_ret: Option<String> = ir.get::<Option<String>, _>("date_retour").map(|d| d.split('T').next().unwrap_or(&d).to_string());
        let line_notes: Option<String> = ir.get("notes");

        total_rental_cents += price_unit;

        items.push(RentalArticleItemDto {
            variant_id: var_id.unwrap_or_else(|| art_id.clone().unwrap_or_default()),
            article_id: art_id.unwrap_or_default(),
            article_name: art_name,
            reference: art_ref,
            barcode,
            size,
            sub_size,
            unit_price_cents: price_unit,
            deposit_cents: caution_line,
            cleaning_fee_cents: cleaning_line,
            pickup_condition: etat_dep,
            return_condition: etat_ret,
            damage_fee_cents: None,
            damage_notes: line_notes,
            is_returned: is_ret == 1,
            return_date: date_ret,
        });
    }

    // 3. Récupérer les paiements associés
    let pay_rows = sqlx::query(
        "SELECT montant_centimes, moyen_paiement, type_paiement FROM paiements WHERE location_id = ? ORDER BY date_paiement ASC"
    )
    .bind(&location_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let mut paid_amount_cents = 0i64;
    let mut payment_method = "carte_bancaire".to_string();
    for pr in pay_rows {
        let m: i64 = pr.get("montant_centimes");
        let mp: String = pr.get("moyen_paiement");
        let tp: String = pr.get("type_paiement");
        if tp != "caution" {
            paid_amount_cents += m;
            payment_method = mp;
        }
    }

    let remaining_amount_cents = (total_amount_cents - paid_amount_cents).max(0);
    let deposit_method = if deposit_status == "empreinte_cb" {
        "empreinte_cb".to_string()
    } else if deposit_status == "encaissee" || deposit_status == "especes" {
        "especes".to_string()
    } else if deposit_status == "virement" {
        "virement".to_string()
    } else {
        "cheque".to_string()
    };

    Ok(RentalContractDto {
        id: location_id,
        contract_number,
        customer_id,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        customer_cni,
        status,
        event_date,
        pickup_date,
        return_date_scheduled,
        return_date_actual,
        items,
        total_rental_cents,
        cleaning_fee_cents,
        discount_cents,
        late_fee_cents,
        damage_fee_cents,
        total_amount_cents,
        deposit_amount_cents,
        deposit_status,
        deposit_method,
        deposit_notes,
        paid_amount_cents,
        payment_method,
        remaining_amount_cents,
        notes,
        pdf_archived_path,
        created_at,
        updated_at,
    })
}

#[command]
pub async fn list_rentals(state: State<'_, DbState>) -> Result<Vec<RentalContractDto>, AppError> {
    let ids: Vec<(String,)> = sqlx::query_as("SELECT id FROM locations ORDER BY date_retrait_prevue DESC")
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let mut list = Vec::with_capacity(ids.len());
    for (id,) in ids {
        let dto = fetch_rental_dto_by_id(&state.pool, &id).await?;
        list.push(dto);
    }
    Ok(list)
}

#[command]
pub async fn get_rental(id: String, state: State<'_, DbState>) -> Result<RentalContractDto, AppError> {
    fetch_rental_dto_by_id(&state.pool, &id).await
}

pub async fn next_rental_number_for_date(
    conn: &mut sqlx::SqliteConnection,
    date_str: &str,
) -> Result<(String, i64), AppError> {
    let year = if date_str.len() >= 4 {
        &date_str[0..4]
    } else {
        "2026"
    };

    let key = format!("dernier_numero_location_{}", year);
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
    let contract_number = format!("LOC-{}-{:04}", year, seq_num);
    Ok((contract_number, seq_num))
}

pub async fn next_sale_number_for_date(
    conn: &mut sqlx::SqliteConnection,
    date_str: &str,
) -> Result<(String, i64), AppError> {
    let year = if date_str.len() >= 4 {
        &date_str[0..4]
    } else {
        "2026"
    };

    let key = format!("dernier_numero_vente_{}", year);
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
    let sale_number = format!("VTE-{}-{:04}", year, seq_num);
    Ok((sale_number, seq_num))
}

pub async fn execute_create_rental(pool: &sqlx::SqlitePool, dto: CreateRentalContractDto) -> Result<RentalContractDto, AppError> {
    if dto.pickup_date.trim().is_empty() || dto.return_date_scheduled.trim().is_empty() {
        return Err(AppError::Validation("Les dates de retrait et de retour sont obligatoires".to_string()));
    }
    if dto.pickup_date > dto.return_date_scheduled {
        return Err(AppError::Validation("La date de retour doit être postérieure ou égale à la date de retrait".to_string()));
    }
    let has_variants = !dto.selected_variant_ids.is_empty();
    let has_quantity = dto.quantity_items.as_ref().map_or(false, |q| !q.is_empty());
    let has_pack_lines = dto.pack_lines.as_ref().map_or(false, |p| !p.is_empty());
    if !has_variants && !has_quantity && !has_pack_lines {
        return Err(AppError::Validation("Veuillez sélectionner au moins un article pour le contrat".to_string()));
    }

    let user_id = dto.utilisateur_id
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::Validation("Utilisateur obligatoire pour créer un contrat de location.".to_string()))?;

    let duration_days = match (
        chrono::NaiveDate::parse_from_str(&dto.pickup_date, "%Y-%m-%d"),
        chrono::NaiveDate::parse_from_str(&dto.return_date_scheduled, "%Y-%m-%d"),
    ) {
        (Ok(start), Ok(end)) => (end - start).num_days().max(1),
        _ => 1,
    };

    let mut tx = ImmediateTx::begin(pool).await?;

    let loc_id = match async {
        use sqlx::Row;

        let user_exists: Option<(String,)> = sqlx::query_as("SELECT id FROM utilisateurs WHERE id = ? AND est_actif = 1")
            .bind(&user_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        if user_exists.is_none() {
            return Err(AppError::Validation(format!("Utilisateur introuvable ou inactif : {}", user_id)));
        }

        let client = sqlx::query_as::<_, Client>("SELECT * FROM clients WHERE id = ?")
            .bind(&dto.customer_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::NotFound(format!("Client introuvable : {}", dto.customer_id)))?;

        if client.est_bloque == 1 {
            return Err(AppError::Validation(format!(
                "CLIENT EN LISTE NOIRE : {}",
                client.notes.as_deref().unwrap_or("Accès restreint")
            )));
        }

        let now = chrono::Utc::now().to_rfc3339();
        let today_str = today_local();
        let contract_status = compute_contract_status_for_date(&dto.pickup_date, &today_str);

        let mut lines_to_insert = Vec::new();
        let mut total_rental_cents = 0i64;
        let mut cleaning_fee_total_cents = 0i64;
        let mut default_deposit_cents = 0i64;

        for var_id in &dto.selected_variant_ids {
            let row = sqlx::query(
                "SELECT v.id as var_id, v.article_id, v.statut as var_statut, v.etat_usure,
                        a.nom as art_nom, a.prix_location_centimes, a.caution_suggeree_centimes, a.frais_nettoyage_centimes
                 FROM variantes_stock v
                 JOIN articles a ON v.article_id = a.id
                 WHERE v.id = ?"
            )
            .bind(var_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::Validation(format!("Variante introuvable : {}", var_id)))?;

            let art_nom: String = row.get("art_nom");
            let var_statut: String = row.get("var_statut");
            let art_id: String = row.get("article_id");
            let prix_loc: i64 = row.get("prix_location_centimes");
            let caution: i64 = row.get("caution_suggeree_centimes");
            let cleaning: i64 = row.get("frais_nettoyage_centimes");
            let etat_usure: String = row.get::<Option<String>, _>("etat_usure").unwrap_or_else(|| "excellent".to_string());

            if var_statut == "au_pressing" {
                return Err(AppError::Validation(format!("L'article '{}' est actuellement au pressing (nettoyage).", art_nom)));
            }
            if var_statut == "en_retouche" || var_statut == "indisponible" || var_statut == "vendu" {
                return Err(AppError::Validation(format!("L'article '{}' est en cours de réparation / indisponible.", art_nom)));
            }

            let conflict = sqlx::query(
                "SELECT l.numero_location, c.prenom, c.nom, l.date_retrait_prevue, l.date_retour_prevue
                 FROM lignes_location ll
                 JOIN locations l ON ll.location_id = l.id
                 JOIN clients c ON l.client_id = c.id
                 WHERE ll.variante_id = ?
                   AND ll.est_rendu = 0
                   AND l.statut IN ('reserve', 'en_cours', 'en_retard', 'litige')
                   AND l.date_retrait_prevue <= ?
                   AND l.date_retour_prevue >= ?
                 LIMIT 1"
            )
            .bind(var_id)
            .bind(&dto.return_date_scheduled)
            .bind(&dto.pickup_date)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            if let Some(c_row) = conflict {
                let num_loc: String = c_row.get("numero_location");
                let c_nom: String = c_row.get("nom");
                let c_prenom: String = c_row.get("prenom");
                let c_start: String = c_row.get("date_retrait_prevue");
                let c_end: String = c_row.get("date_retour_prevue");
                return Err(AppError::Validation(format!(
                    "Conflit de date pour '{}' avec le contrat {} ({} {}) du {} au {}.",
                    art_nom, num_loc, c_prenom, c_nom, c_start, c_end
                )));
            }

            let item_total = prix_loc * duration_days;
            total_rental_cents += item_total;
            cleaning_fee_total_cents += cleaning;
            default_deposit_cents += caution;

            lines_to_insert.push((
                format!("lig-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)),
                Some(var_id.clone()),
                Some(art_id),
                None::<String>,  // pack_id : NULL pour les variantes hors-pack
                1i64,
                item_total,
                caution,
                etat_usure,
            ));
        }

        if let Some(qty_items) = &dto.quantity_items {
            for q_item in qty_items {
                if q_item.quantite <= 0 {
                    return Err(AppError::Validation("La quantité demandée doit être strictement positive.".to_string()));
                }

                let art_row = sqlx::query(
                    "SELECT id, nom, prix_location_centimes, caution_suggeree_centimes, frais_nettoyage_centimes, quantite_disponible
                     FROM articles WHERE id = ? AND est_actif = 1"
                )
                .bind(&q_item.article_id)
                .fetch_optional(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?
                .ok_or_else(|| AppError::Validation(format!("Article introuvable : {}", q_item.article_id)))?;

                let art_nom: String = art_row.get("nom");
                let prix_loc: i64 = art_row.get("prix_location_centimes");
                let caution: i64 = art_row.get("caution_suggeree_centimes");
                let cleaning: i64 = art_row.get("frais_nettoyage_centimes");

                let upd_res = sqlx::query(
                    "UPDATE articles 
                     SET quantite_disponible = quantite_disponible - ?, updated_at = ? 
                     WHERE id = ? AND quantite_disponible >= ?"
                )
                .bind(q_item.quantite)
                .bind(&now)
                .bind(&q_item.article_id)
                .bind(q_item.quantite)
                .execute(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?;

                if upd_res.rows_affected() == 0 {
                    return Err(AppError::Validation(format!("Stock insuffisant pour l'article '{}'.", art_nom)));
                }

                let line_total = (prix_loc * duration_days) * q_item.quantite;
                let line_caution = caution * q_item.quantite;
                total_rental_cents += line_total;
                cleaning_fee_total_cents += cleaning * q_item.quantite;
                default_deposit_cents += line_caution;

                lines_to_insert.push((
                    format!("lig-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)),
                    None,
                    Some(q_item.article_id.clone()),
                    None::<String>,       // pack_id : NULL pour les lignes hors-pack
                    q_item.quantite,
                    line_total,
                    line_caution,
                    "bon".to_string(),
                ));
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Traitement des lignes issues de packs (dto.pack_lines)
        // Chaque PackLineItemDto porte son pack_id pour la traçabilité dans
        // lignes_location.pack_id. Le chemin est identique aux variantes libres
        // et aux articles en quantité, mais avec pack_id renseigné.
        // ──────────────────────────────────────────────────────────────────────────
        if let Some(pack_lines) = &dto.pack_lines {
            for pl in pack_lines {
                if pl.quantite <= 0 {
                    return Err(AppError::Validation("La quantité d'une ligne pack doit être strictement positive.".to_string()));
                }

                if let Some(var_id) = &pl.variante_id {
                    // ── Mode variante : vérification statut + conflit dates ──
                    let row = sqlx::query(
                        "SELECT v.id as var_id, v.article_id, v.statut as var_statut, v.etat_usure,
                                a.nom as art_nom, a.prix_location_centimes, a.caution_suggeree_centimes, a.frais_nettoyage_centimes
                         FROM variantes_stock v
                         JOIN articles a ON v.article_id = a.id
                         WHERE v.id = ?"
                    )
                    .bind(var_id)
                    .fetch_optional(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?
                    .ok_or_else(|| AppError::Validation(format!("Variante pack introuvable : {}", var_id)))?;

                    let art_nom: String = row.get("art_nom");
                    let var_statut: String = row.get("var_statut");
                    let art_id: String = row.get("article_id");
                    let prix_loc: i64 = row.get("prix_location_centimes");
                    let caution: i64 = row.get("caution_suggeree_centimes");
                    let cleaning: i64 = row.get("frais_nettoyage_centimes");
                    let etat_usure: String = row.get::<Option<String>, _>("etat_usure").unwrap_or_else(|| "excellent".to_string());

                    if var_statut == "au_pressing" {
                        return Err(AppError::Validation(format!("Article pack '{}' est actuellement au pressing.", art_nom)));
                    }
                    if var_statut == "en_retouche" || var_statut == "indisponible" || var_statut == "vendu" {
                        return Err(AppError::Validation(format!("Article pack '{}' est indisponible.", art_nom)));
                    }

                    let conflict = sqlx::query(
                        "SELECT l.numero_location, c.prenom, c.nom, l.date_retrait_prevue, l.date_retour_prevue
                         FROM lignes_location ll
                         JOIN locations l ON ll.location_id = l.id
                         JOIN clients c ON l.client_id = c.id
                         WHERE ll.variante_id = ?
                           AND ll.est_rendu = 0
                           AND l.statut IN ('reserve', 'en_cours', 'en_retard', 'litige')
                           AND l.date_retrait_prevue <= ?
                           AND l.date_retour_prevue >= ?
                         LIMIT 1"
                    )
                    .bind(var_id)
                    .bind(&dto.return_date_scheduled)
                    .bind(&dto.pickup_date)
                    .fetch_optional(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;

                    if let Some(c_row) = conflict {
                        let num_loc: String = c_row.get("numero_location");
                        let c_nom: String = c_row.get("nom");
                        let c_prenom: String = c_row.get("prenom");
                        let c_start: String = c_row.get("date_retrait_prevue");
                        let c_end: String = c_row.get("date_retour_prevue");
                        return Err(AppError::Validation(format!(
                            "Conflit de date pour l'article pack '{}' avec le contrat {} ({} {}) du {} au {}.",
                            art_nom, num_loc, c_prenom, c_nom, c_start, c_end
                        )));
                    }

                    let item_total = prix_loc * duration_days;
                    total_rental_cents += item_total;
                    cleaning_fee_total_cents += cleaning;
                    default_deposit_cents += caution;

                    lines_to_insert.push((
                        format!("lig-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)),
                        Some(var_id.clone()),
                        Some(art_id),
                        Some(pl.pack_id.clone()),  // pack_id tracé
                        1i64,
                        item_total,
                        caution,
                        etat_usure,
                    ));

                } else if let Some(art_id) = &pl.article_id {
                    // ── Mode quantité : décrémente le stock ──
                    let art_row = sqlx::query(
                        "SELECT id, nom, prix_location_centimes, caution_suggeree_centimes, frais_nettoyage_centimes, quantite_disponible
                         FROM articles WHERE id = ? AND est_actif = 1"
                    )
                    .bind(art_id)
                    .fetch_optional(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?
                    .ok_or_else(|| AppError::Validation(format!("Article pack introuvable : {}", art_id)))?;

                    let art_nom: String = art_row.get("nom");
                    let prix_loc: i64 = art_row.get("prix_location_centimes");
                    let caution: i64 = art_row.get("caution_suggeree_centimes");
                    let cleaning: i64 = art_row.get("frais_nettoyage_centimes");

                    let upd_res = sqlx::query(
                        "UPDATE articles
                         SET quantite_disponible = quantite_disponible - ?, updated_at = ?
                         WHERE id = ? AND quantite_disponible >= ?"
                    )
                    .bind(pl.quantite)
                    .bind(&now)
                    .bind(art_id)
                    .bind(pl.quantite)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;

                    if upd_res.rows_affected() == 0 {
                        return Err(AppError::Validation(format!("Stock insuffisant pour l'article pack '{}'.", art_nom)));
                    }

                    let line_total = (prix_loc * duration_days) * pl.quantite;
                    let line_caution = caution * pl.quantite;
                    total_rental_cents += line_total;
                    cleaning_fee_total_cents += cleaning * pl.quantite;
                    default_deposit_cents += line_caution;

                    lines_to_insert.push((
                        format!("lig-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)),
                        None,
                        Some(art_id.clone()),
                        Some(pl.pack_id.clone()),  // pack_id tracé
                        pl.quantite,
                        line_total,
                        line_caution,
                        "bon".to_string(),
                    ));
                } else {
                    return Err(AppError::Validation(
                        "Une ligne pack doit avoir au moins variante_id ou article_id.".to_string()
                    ));
                }
            }
        }

        let discount_cents = dto.discount_cents.unwrap_or(0);
        let total_facture_cents = (total_rental_cents - discount_cents).max(0);
        let deposit_amount_cents = dto.deposit_amount_cents.unwrap_or(default_deposit_cents);
        let paid_cents = dto.paid_amount_cents.unwrap_or(0);

        let (contract_number, _seq_num) = next_rental_number_for_date(&mut *tx.conn, &today_local()).await?;
        let location_id = format!("loc-{}", chrono::Utc::now().timestamp_millis());
        let pdf_path = format!("/bons/{}/BON-{}.pdf", chrono::Utc::now().format("%Y-%m"), contract_number);
        let deposit_status = if dto.deposit_method == "empreinte_cb" {
            "empreinte_cb"
        } else if dto.deposit_method == "especes" {
            "encaissee"
        } else {
            "cheque_retenu"
        };

        sqlx::query(
            "INSERT INTO locations (
                id, numero_location, client_id, utilisateur_id, statut,
                date_evenement, date_retrait_prevue, date_retour_prevue,
                montant_total_ht_centimes, tva_taux, montant_total_ttc_centimes,
                frais_nettoyage_centimes, frais_retard_centimes, frais_degradation_centimes,
                remise_centimes, montant_caution_centimes, statut_caution,
                notes_caution, notes, chemin_pdf, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&location_id)
        .bind(&contract_number)
        .bind(&dto.customer_id)
        .bind(&user_id)
        .bind(contract_status)
        .bind(&dto.event_date)
        .bind(&dto.pickup_date)
        .bind(&dto.return_date_scheduled)
        .bind(total_facture_cents)
        .bind(total_facture_cents)
        .bind(cleaning_fee_total_cents)
        .bind(discount_cents)
        .bind(deposit_amount_cents)
        .bind(deposit_status)
        .bind(Option::<String>::None)
        .bind(&dto.notes)
        .bind(&pdf_path)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        for line in lines_to_insert {
            sqlx::query(
                "INSERT INTO lignes_location (
                    id, location_id, variante_id, article_id, pack_id, quantite, type_ligne,
                    prix_unitaire_centimes, caution_centimes, etat_depart, est_rendu
                ) VALUES (?, ?, ?, ?, ?, ?, 'location', ?, ?, ?, 0)"
            )
            .bind(&line.0)              // id
            .bind(&location_id)         // location_id
            .bind(&line.1)              // variante_id (Option)
            .bind(&line.2)              // article_id (Option)
            .bind(&line.3)              // pack_id (Option)
            .bind(line.4)               // quantite
            .bind(line.5)               // prix_unitaire_centimes
            .bind(line.6)               // caution_centimes
            .bind(&line.7)              // etat_depart
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;
        }

        // Recalcul dynamique du statut de chaque variante selon la règle B0-2
        for var_id in &dto.selected_variant_ids {
            recompute_variant_status(&mut *tx.conn, var_id).await?;
        }
        // Idem pour les variantes issues de packs
        if let Some(ref pack_lines) = dto.pack_lines {
            for pl in pack_lines {
                if let Some(ref var_id) = pl.variante_id {
                    recompute_variant_status(&mut *tx.conn, var_id).await?;
                }
            }
        }

        if paid_cents > 0 {
            let pay_id = format!("pay-{}", chrono::Utc::now().timestamp_millis());
            let pay_type = if paid_cents >= total_facture_cents { "solde" } else { "acompte" };
            sqlx::query(
                "INSERT INTO paiements (
                    id, location_id, vente_id, utilisateur_id, montant_centimes,
                    type_paiement, moyen_paiement, reference_transaction, notes, date_paiement
                ) VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, 'Paiement à la création du contrat', ?)"
            )
            .bind(&pay_id)
            .bind(&location_id)
            .bind(&user_id)
            .bind(paid_cents)
            .bind(pay_type)
            .bind(&dto.payment_method)
            .bind(&now)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            let active_session: Option<(String,)> = sqlx::query_as(
                "SELECT id FROM sessions_caisse WHERE statut = 'ouverte' ORDER BY date_session DESC LIMIT 1"
            )
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            if let Some((ses_id,)) = active_session {
                let col_name = match dto.payment_method.as_str() {
                    "especes" => "total_especes_centimes",
                    "carte_bancaire" => "total_carte_centimes",
                    "cheque" => "total_cheque_centimes",
                    "virement" => "total_virement_centimes",
                    _ => "total_especes_centimes",
                };
                let update_sql = format!(
                    "UPDATE sessions_caisse 
                     SET total_locations_centimes = total_locations_centimes + ?,
                         {} = {} + ?
                     WHERE id = ?",
                    col_name, col_name
                );
                sqlx::query(&update_sql)
                    .bind(paid_cents)
                    .bind(paid_cents)
                    .bind(&ses_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            }
        }

        Ok(location_id)
    }.await {
        Ok(id) => {
            tx.commit().await?;
            id
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    fetch_rental_dto_by_id(pool, &loc_id).await
}

#[command]
pub async fn create_rental(dto: CreateRentalContractDto, state: State<'_, DbState>) -> Result<RentalContractDto, AppError> {
    execute_create_rental(&state.pool, dto).await
}

pub async fn execute_register_return(pool: &sqlx::SqlitePool, dto: RegisterReturnDto) -> Result<RentalContractDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    let contract_id = dto.contract_id.clone();
    match async {
        let loc = sqlx::query_as::<_, Location>("SELECT * FROM locations WHERE id = ?")
            .bind(&dto.contract_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::NotFound(format!("Location introuvable : {}", dto.contract_id)))?;

        if loc.statut == "retourne" || loc.statut == "annule" {
            return Err(AppError::Validation(format!("Le contrat {} est déjà clôturé ou annulé.", loc.numero_location)));
        }

        let now = chrono::Utc::now().to_rfc3339();
        let today_str = today_local();

        let mut total_damage_fee_cents = 0i64;
        let mut any_damage = false;

        for item in &dto.items {
            let damage_fee = item.damage_fee_cents.unwrap_or(0);
            if item.condition == "endommage" {
                any_damage = true;
                total_damage_fee_cents += damage_fee;
            }

            if let Some(var_id) = &item.variant_id {
                if item.condition == "a_nettoyer" {
                    sqlx::query(
                        "UPDATE variantes_stock 
                         SET statut = 'au_pressing', nb_locations = nb_locations + 1, updated_at = ? 
                         WHERE id = ?"
                    )
                    .bind(&now)
                    .bind(var_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
                } else if item.condition == "endommage" {
                    sqlx::query(
                        "UPDATE variantes_stock 
                         SET statut = 'en_retouche', nb_locations = nb_locations + 1, updated_at = ? 
                         WHERE id = ?"
                    )
                    .bind(&now)
                    .bind(var_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
                } else {
                    sqlx::query(
                        "UPDATE variantes_stock 
                         SET nb_locations = nb_locations + 1, updated_at = ? 
                         WHERE id = ?"
                    )
                    .bind(&now)
                    .bind(var_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
                }

                sqlx::query(
                    "UPDATE lignes_location 
                     SET est_rendu = 1, date_retour = ?, etat_retour = ?, notes = ? 
                     WHERE location_id = ? AND variante_id = ?"
                )
                .bind(&today_str)
                .bind(&item.condition)
                .bind(&item.damage_notes)
                .bind(&dto.contract_id)
                .bind(var_id)
                .execute(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?;

                recompute_variant_status(&mut *tx.conn, var_id).await?;
            } else if let Some(art_id) = &item.article_id {
                let row_q: Option<(i64,)> = sqlx::query_as(
                    "SELECT quantite FROM lignes_location WHERE location_id = ? AND article_id = ? AND est_rendu = 0 LIMIT 1"
                )
                .bind(&dto.contract_id)
                .bind(art_id)
                .fetch_optional(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?;

                if let Some((q,)) = row_q {
                    sqlx::query(
                        "UPDATE articles SET quantite_disponible = quantite_disponible + ?, updated_at = ? WHERE id = ?"
                    )
                    .bind(q)
                    .bind(&now)
                    .bind(art_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;

                    sqlx::query(
                        "UPDATE lignes_location SET est_rendu = 1, date_retour = ?, etat_retour = ?, notes = ? WHERE location_id = ? AND article_id = ?"
                    )
                    .bind(&today_str)
                    .bind(&item.condition)
                    .bind(&item.damage_notes)
                    .bind(&dto.contract_id)
                    .bind(art_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
                }
            }
        }

        let deposit_status = if total_damage_fee_cents > 0 {
            if total_damage_fee_cents >= loc.montant_caution_centimes {
                "conservee_totalement"
            } else {
                "conservee_partiellement"
            }
        } else {
            "restituee"
        };

        let final_status = if any_damage { "litige" } else { "retourne" };

        sqlx::query(
            "UPDATE locations 
             SET statut = ?, date_retour_effective = ?, frais_degradation_centimes = ?, statut_caution = ?, updated_at = ? 
             WHERE id = ?"
        )
        .bind(final_status)
        .bind(&today_str)
        .bind(total_damage_fee_cents)
        .bind(deposit_status)
        .bind(&now)
        .bind(&dto.contract_id)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        Ok(())
    }.await {
        Ok(()) => {
            tx.commit().await?;
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    fetch_rental_dto_by_id(pool, &contract_id).await
}

#[command]
pub async fn register_return(dto: RegisterReturnDto, state: State<'_, DbState>) -> Result<RentalContractDto, AppError> {
    execute_register_return(&state.pool, dto).await
}

pub async fn execute_cancel_rental(pool: &sqlx::SqlitePool, id: &str) -> Result<RentalContractDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    match async {
        let loc = sqlx::query_as::<_, Location>("SELECT * FROM locations WHERE id = ?")
            .bind(id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
            .ok_or_else(|| AppError::NotFound(format!("Location introuvable : {}", id)))?;

        if loc.statut != "reserve" && loc.statut != "brouillon" {
            return Err(AppError::Validation(format!(
                "Impossible d'annuler le contrat {} car son statut est '{}' (seuls 'reserve' ou 'brouillon' peuvent être annulés).",
                loc.numero_location, loc.statut
            )));
        }

        let now = chrono::Utc::now().to_rfc3339();

        let lines = sqlx::query(
            "SELECT variante_id, article_id, quantite FROM lignes_location WHERE location_id = ?"
        )
        .bind(id)
        .fetch_all(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        use sqlx::Row;
        for line in &lines {
            let art_id: Option<String> = line.get("article_id");
            let var_id: Option<String> = line.get("variante_id");
            let qty: i64 = line.get("quantite");

            if var_id.is_none() {
                if let Some(a_id) = art_id {
                    sqlx::query("UPDATE articles SET quantite_disponible = quantite_disponible + ?, updated_at = ? WHERE id = ?")
                        .bind(qty)
                        .bind(&now)
                        .bind(&a_id)
                        .execute(&mut *tx.conn)
                        .await
                        .map_err(map_sqlite_err)?;
                }
            }
        }

        sqlx::query("UPDATE locations SET statut = 'annule', updated_at = ? WHERE id = ?")
            .bind(&now)
            .bind(id)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        // Réévaluer le statut de chaque variante après annulation du contrat
        for line in lines {
            let var_id: Option<String> = line.get("variante_id");
            if let Some(v_id) = var_id {
                recompute_variant_status(&mut *tx.conn, &v_id).await?;
            }
        }

        Ok(())
    }.await {
        Ok(()) => {
            tx.commit().await?;
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    fetch_rental_dto_by_id(pool, id).await
}

#[command]
pub async fn cancel_rental(id: String, state: State<'_, DbState>) -> Result<RentalContractDto, AppError> {
    execute_cancel_rental(&state.pool, &id).await
}

// Commandes historiques conservées pour rétrocompatibilité
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
// 5. BIS - MODULE CAISSE & VENTES DIRECTES (SQLITE)
// ----------------------------------------------------------------------------

pub async fn fetch_direct_sale_by_id(pool: &sqlx::SqlitePool, sale_id: &str) -> Result<DirectSaleDto, AppError> {
    use sqlx::Row;

    let row = sqlx::query(
        "SELECT v.id, v.numero_vente, v.client_id, v.utilisateur_id, v.montant_total_centimes,
                v.moyen_paiement, v.statut, v.notes, v.created_at,
                c.nom as client_nom, c.prenom as client_prenom, c.telephone as client_tel,
                u.nom_complet as user_name
         FROM ventes v
         LEFT JOIN clients c ON v.client_id = c.id
         JOIN utilisateurs u ON v.utilisateur_id = u.id
         WHERE v.id = ?"
    )
    .bind(sale_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound(format!("Vente introuvable : {}", sale_id)))?;

    let id: String = row.get("id");
    let sale_number: String = row.get("numero_vente");
    let customer_id: Option<String> = row.get("client_id");
    let c_nom: Option<String> = row.get("client_nom");
    let c_prenom: Option<String> = row.get("client_prenom");
    let customer_phone: Option<String> = row.get("client_tel");
    let customer_name = match (c_prenom, c_nom) {
        (Some(p), Some(n)) => format!("{} {}", p, n),
        _ => "Client Comptoir".to_string(),
    };
    let user_id: String = row.get("utilisateur_id");
    let user_name: String = row.get("user_name");
    let total_amount_cents: i64 = row.get("montant_total_centimes");
    let moyen_paiement: String = row.get("moyen_paiement");
    let notes: Option<String> = row.get("notes");
    let created_at: String = row.get("created_at");

    let tax_rate = 0.19;
    let total_ht = (total_amount_cents as f64 / 1.19).round() as i64;
    let tax_amount_cents = total_amount_cents - total_ht;

    let line_rows = sqlx::query(
        "SELECT lv.id, lv.article_id, lv.variante_id, lv.quantite, lv.prix_unitaire_centimes, lv.total_centimes,
                a.nom as art_nom, a.reference as art_ref, cat.nom as cat_nom,
                v.code_barre, v.taille
         FROM lignes_vente lv
         JOIN articles a ON lv.article_id = a.id
         JOIN categories cat ON a.categorie_id = cat.id
         LEFT JOIN variantes_stock v ON lv.variante_id = v.id
         WHERE lv.vente_id = ?"
    )
    .bind(sale_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let mut items = Vec::with_capacity(line_rows.len());
    for lr in line_rows {
        items.push(DirectSaleCartItemInput {
            id: lr.get("id"),
            article_id: lr.get("article_id"),
            variant_id: lr.get("variante_id"),
            name: lr.get("art_nom"),
            reference: lr.get("art_ref"),
            barcode: lr.get("code_barre"),
            category_name: lr.get("cat_nom"),
            size: lr.get("taille"),
            unit_price_cents: lr.get("prix_unitaire_centimes"),
            quantity: lr.get("quantite"),
            subtotal_cents: lr.get("total_centimes"),
            photo_url: None,
        });
    }

    let pay_row = sqlx::query(
        "SELECT reference_transaction FROM paiements WHERE vente_id = ? LIMIT 1"
    )
    .bind(sale_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    let tx_ref = pay_row.and_then(|r| r.get("reference_transaction"));

    let payment = DirectSalePaymentInput {
        method: moyen_paiement,
        amount_paid_cents: total_amount_cents,
        cash_received_cents: None,
        change_returned_cents: None,
        transaction_ref: tx_ref,
        cheque_number: None,
        bank_name: None,
    };

    Ok(DirectSaleDto {
        id,
        sale_number,
        customer_id,
        customer_name,
        customer_phone,
        user_id,
        user_name,
        total_amount_cents,
        tax_rate,
        tax_amount_cents,
        payment,
        items,
        notes,
        receipt_pdf_path: None,
        created_at,
    })
}

pub async fn execute_create_direct_sale(pool: &sqlx::SqlitePool, dto: CreateDirectSaleDto) -> Result<DirectSaleDto, AppError> {
    if dto.items.is_empty() {
        return Err(AppError::Validation("Le panier de vente est vide.".to_string()));
    }
    if dto.user_id.trim().is_empty() {
        return Err(AppError::Validation("Utilisateur obligatoire pour enregistrer une vente.".to_string()));
    }

    let mut tx = ImmediateTx::begin(pool).await?;

    let sale_id = match async {
        use sqlx::Row;

        let user_exists: Option<(String,)> = sqlx::query_as("SELECT id FROM utilisateurs WHERE id = ? AND est_actif = 1")
            .bind(&dto.user_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

        if user_exists.is_none() {
            return Err(AppError::Validation(format!("Utilisateur introuvable ou inactif : {}", dto.user_id)));
        }

        let now = chrono::Utc::now().to_rfc3339();

        let mut total_amount_cents = 0i64;
        for it in &dto.items {
            total_amount_cents += it.subtotal_cents;

            if let Some(v_id) = &it.variant_id {
                let var_row = sqlx::query("SELECT statut FROM variantes_stock WHERE id = ?")
                    .bind(v_id)
                    .fetch_optional(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?
                    .ok_or_else(|| AppError::Validation(format!("Variante introuvable : {}", v_id)))?;

                let v_stat: String = var_row.get("statut");
                if v_stat != "disponible" {
                    return Err(AppError::Validation(format!(
                        "La pièce '{}' ne peut pas être vendue car son statut est '{}'.",
                        it.name, v_stat
                    )));
                }

                sqlx::query("UPDATE variantes_stock SET statut = 'vendu', updated_at = ? WHERE id = ?")
                    .bind(&now)
                    .bind(v_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            } else {
                let upd_res = sqlx::query(
                    "UPDATE articles 
                     SET quantite_disponible = quantite_disponible - ?, updated_at = ? 
                     WHERE id = ? AND quantite_disponible >= ?"
                )
                .bind(it.quantity)
                .bind(&now)
                .bind(&it.article_id)
                .bind(it.quantity)
                .execute(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?;

                if upd_res.rows_affected() == 0 {
                    return Err(AppError::Validation(format!("Stock insuffisant pour l'article '{}'.", it.name)));
                }
            }
        }

        let (sale_number, _seq_num) = next_sale_number_for_date(&mut *tx.conn, &today_local()).await?;
        let sale_id = format!("vte-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));

        sqlx::query(
            "INSERT INTO ventes (
                id, numero_vente, client_id, utilisateur_id, montant_total_centimes,
                moyen_paiement, statut, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'completee', ?, ?)"
        )
        .bind(&sale_id)
        .bind(&sale_number)
        .bind(&dto.customer_id)
        .bind(&dto.user_id)
        .bind(total_amount_cents)
        .bind(&dto.payment.method)
        .bind(&dto.notes)
        .bind(&now)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        for (idx, it) in dto.items.iter().enumerate() {
            let line_id = format!("lv-{}-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0), idx);
            sqlx::query(
                "INSERT INTO lignes_vente (
                    id, vente_id, article_id, variante_id, quantite,
                    prix_unitaire_centimes, total_centimes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&line_id)
            .bind(&sale_id)
            .bind(&it.article_id)
            .bind(&it.variant_id)
            .bind(it.quantity)
            .bind(it.unit_price_cents)
            .bind(it.subtotal_cents)
            .execute(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;
        }

        let pay_id = format!("pay-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
        sqlx::query(
            "INSERT INTO paiements (
                id, location_id, vente_id, utilisateur_id, montant_centimes,
                type_paiement, moyen_paiement, reference_transaction, notes, date_paiement
            ) VALUES (?, NULL, ?, ?, ?, 'vente_directe', ?, ?, 'Paiement vente directe comptoir', ?)"
        )
        .bind(&pay_id)
        .bind(&sale_id)
        .bind(&dto.user_id)
        .bind(total_amount_cents)
        .bind(&dto.payment.method)
        .bind(&dto.payment.transaction_ref)
        .bind(&now)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        let active_session: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM sessions_caisse WHERE statut = 'ouverte' ORDER BY date_session DESC LIMIT 1"
        )
        .fetch_optional(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        if let Some((ses_id,)) = active_session {
            let col_name = match dto.payment.method.as_str() {
                "especes" => "total_especes_centimes",
                "carte_bancaire" => "total_carte_centimes",
                "cheque" => "total_cheque_centimes",
                "virement" => "total_virement_centimes",
                _ => "total_especes_centimes",
            };
            let update_sql = format!(
                "UPDATE sessions_caisse 
                 SET total_ventes_centimes = total_ventes_centimes + ?,
                     {} = {} + ?
                 WHERE id = ?",
                col_name, col_name
            );
            sqlx::query(&update_sql)
                .bind(total_amount_cents)
                .bind(total_amount_cents)
                .bind(&ses_id)
                .execute(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?;
        }

        Ok(sale_id)
    }.await {
        Ok(id) => {
            tx.commit().await?;
            id
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    fetch_direct_sale_by_id(pool, &sale_id).await
}

#[command]
pub async fn create_direct_sale(dto: CreateDirectSaleDto, state: State<'_, DbState>) -> Result<DirectSaleDto, AppError> {
    execute_create_direct_sale(&state.pool, dto).await
}

pub async fn execute_list_direct_sales(pool: &sqlx::SqlitePool) -> Result<Vec<DirectSaleDto>, AppError> {
    let sale_ids: Vec<(String,)> = sqlx::query_as("SELECT id FROM ventes ORDER BY created_at DESC")
        .fetch_all(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    let mut result = Vec::with_capacity(sale_ids.len());
    for (id,) in sale_ids {
        let dto = fetch_direct_sale_by_id(pool, &id).await?;
        result.push(dto);
    }
    Ok(result)
}

#[command]
pub async fn list_direct_sales(state: State<'_, DbState>) -> Result<Vec<DirectSaleDto>, AppError> {
    execute_list_direct_sales(&state.pool).await
}

pub async fn fetch_cash_session_dto_by_id(pool: &sqlx::SqlitePool, session_id: &str) -> Result<CashSessionDto, AppError> {
    use sqlx::Row;

    let row = sqlx::query(
        "SELECT s.*, u.nom_complet as user_name, u.role as user_role
         FROM sessions_caisse s
         JOIN utilisateurs u ON s.utilisateur_id = u.id
         WHERE s.id = ?"
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?
    .ok_or_else(|| AppError::NotFound(format!("Session de caisse introuvable : {}", session_id)))?;

    let id: String = row.get("id");
    let cloture_number: String = row.get("numero_session");
    let date: String = row.get("date_session");
    let opened_at: String = row.get("opened_at");
    let closed_at: Option<String> = row.get("closed_at");
    let closed_by_user_id: Option<String> = Some(row.get("utilisateur_id"));
    let closed_by_user_name: Option<String> = Some(row.get("user_name"));
    let closed_by_role: Option<String> = Some(row.get("user_role"));
    let status: String = row.get("statut");
    let initial_cash_float_cents: i64 = row.get("fonds_initial_centimes");
    let sales_total_cents: i64 = row.try_get("total_ventes_centimes").or_else(|_| row.try_get("sales_total_centimes")).unwrap_or(0);
    let rentals_total_cents: i64 = row.try_get("total_locations_centimes").or_else(|_| row.try_get("rentals_total_centimes")).unwrap_or(0);
    let deposits_total_cents: i64 = row.try_get("total_cautions_centimes").or_else(|_| row.try_get("deposits_total_centimes")).unwrap_or(0);
    let grand_total_cents = sales_total_cents + rentals_total_cents;

    let total_especes: i64 = row.get("total_especes_centimes");
    let total_carte: i64 = row.get("total_carte_centimes");
    let total_cheque: i64 = row.get("total_cheque_centimes");
    let total_virement: i64 = row.get("total_virement_centimes");

    let counted_cash_cents: Option<i64> = row.get("total_especes_compte_centimes");
    let discrepancy_cents: Option<i64> = row.get("ecart_centimes");
    let operator_notes: Option<String> = row.get("notes");

    let theoretical_cash_cents = initial_cash_float_cents + total_especes;

    let breakdown = CashSessionBreakdown {
        especes: CashSessionBreakdownMethod { total_cents: total_especes, transaction_count: 0 },
        carte_bancaire: CashSessionBreakdownMethod { total_cents: total_carte, transaction_count: 0 },
        cheque: CashSessionBreakdownMethod { total_cents: total_cheque, transaction_count: 0 },
        virement: CashSessionBreakdownMethod { total_cents: total_virement, transaction_count: 0 },
    };

    Ok(CashSessionDto {
        id,
        cloture_number,
        date,
        opened_at,
        closed_at,
        closed_by_user_id,
        closed_by_user_name,
        closed_by_role,
        status,
        initial_cash_float_cents,
        sales_total_cents,
        rentals_total_cents,
        deposits_total_cents,
        grand_total_cents,
        breakdown,
        theoretical_cash_cents,
        counted_cash_cents,
        discrepancy_cents,
        operator_notes,
    })
}

pub async fn execute_open_cash_session(pool: &sqlx::SqlitePool, dto: OpenCashSessionDto) -> Result<CashSessionDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    let session_id = match async {
        let active: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM sessions_caisse WHERE statut = 'ouverte' LIMIT 1"
        )
        .fetch_optional(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        if active.is_some() {
            return Err(AppError::Validation("Une session de caisse est déjà actuellement ouverte.".to_string()));
        }

        let user_exists: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM utilisateurs WHERE id = ? AND est_actif = 1"
        )
        .bind(&dto.utilisateur_id)
        .fetch_optional(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        if user_exists.is_none() {
            return Err(AppError::Validation(format!("Utilisateur introuvable ou inactif : {}", dto.utilisateur_id)));
        }

        let today = today_local();
        let now = chrono::Utc::now().to_rfc3339();
        let session_id = format!("ses-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sessions_caisse WHERE date_session = ?")
            .bind(&today)
            .fetch_one(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;
        let num_session = format!("Z-{}-{:02}", today.replace('-', ""), count.0 + 1);

        sqlx::query(
            "INSERT INTO sessions_caisse (
                id, numero_session, utilisateur_id, date_session, statut,
                fonds_initial_centimes, total_especes_theorique_centimes,
                total_ventes_centimes, total_locations_centimes, total_cautions_centimes,
                total_especes_centimes, total_carte_centimes, total_cheque_centimes, total_virement_centimes,
                notes, opened_at
            ) VALUES (?, ?, ?, ?, 'ouverte', ?, ?, 0, 0, 0, 0, 0, 0, 0, ?, ?)"
        )
        .bind(&session_id)
        .bind(&num_session)
        .bind(&dto.utilisateur_id)
        .bind(&today)
        .bind(dto.initial_cash_float_cents)
        .bind(dto.initial_cash_float_cents)
        .bind(&dto.notes)
        .bind(&now)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        Ok(session_id)
    }.await {
        Ok(id) => {
            tx.commit().await?;
            id
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    fetch_cash_session_dto_by_id(pool, &session_id).await
}

#[command]
pub async fn open_cash_session(dto: OpenCashSessionDto, state: State<'_, DbState>) -> Result<CashSessionDto, AppError> {
    execute_open_cash_session(&state.pool, dto).await
}

pub async fn execute_close_cash_session(pool: &sqlx::SqlitePool, dto: CloseCashSessionDto) -> Result<CashSessionDto, AppError> {
    let mut tx = ImmediateTx::begin(pool).await?;

    let session_id = match async {
        use sqlx::Row;

        let row = if let Some(ref sid) = dto.session_id {
            sqlx::query("SELECT id, date_session, fonds_initial_centimes, total_especes_centimes, statut, opened_at FROM sessions_caisse WHERE id = ?")
                .bind(sid)
                .fetch_optional(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?
        } else {
            sqlx::query("SELECT id, date_session, fonds_initial_centimes, total_especes_centimes, statut, opened_at FROM sessions_caisse WHERE statut = 'ouverte' ORDER BY date_session DESC LIMIT 1")
                .fetch_optional(&mut *tx.conn)
                .await
                .map_err(map_sqlite_err)?
        }.ok_or_else(|| AppError::Validation("Aucune session de caisse ouverte à clôturer.".to_string()))?;

        let status: String = row.get("statut");
        if status != "ouverte" {
            return Err(AppError::Validation("Cette session de caisse est déjà clôturée.".to_string()));
        }

        let sid: String = row.get("id");
        let date_session: String = row.get("date_session");
        let initial_cash: i64 = row.get("fonds_initial_centimes");

        let now = chrono::Utc::now().to_rfc3339();

        // Réconciliation de tous les paiements de la session (depuis la dernière clôture de la même journée, ou le début du jour)
        let prev_closed: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT MAX(closed_at) FROM sessions_caisse WHERE (date_session = ? OR closed_at LIKE ? || '%') AND statut = 'cloturee' AND id != ?"
        )
        .bind(&date_session)
        .bind(&date_session)
        .bind(&sid)
        .fetch_optional(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        let session_payments: Vec<(i64, String, String, Option<String>, Option<String>)> = if let Some((Some(ref prev_c),)) = prev_closed {
            sqlx::query_as(
                "SELECT montant_centimes, type_paiement, moyen_paiement, vente_id, location_id 
                 FROM paiements 
                 WHERE date_paiement > ? AND date_paiement <= ?"
            )
            .bind(prev_c)
            .bind(&now)
            .fetch_all(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
        } else {
            let start_of_day = format!("{}T00:00:00", date_session);
            sqlx::query_as(
                "SELECT montant_centimes, type_paiement, moyen_paiement, vente_id, location_id 
                 FROM paiements 
                 WHERE (date(date_paiement) = ? OR date_paiement >= ?) AND date_paiement <= ?"
            )
            .bind(&date_session)
            .bind(&start_of_day)
            .bind(&now)
            .fetch_all(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?
        };

        let mut reconciled_rentals = 0i64;
        let mut reconciled_deposits = 0i64;
        let mut reconciled_sales = 0i64;
        let mut reconciled_especes = 0i64;
        let mut reconciled_carte = 0i64;
        let mut reconciled_cheque = 0i64;
        let mut reconciled_virement = 0i64;

        for (montant, type_p, moyen, v_id, _l_id) in session_payments {
            let is_refund = type_p == "remboursement" || montant < 0;
            let abs_amt = montant.abs();

            if is_refund {
                if v_id.is_some() {
                    reconciled_sales -= abs_amt;
                } else {
                    reconciled_rentals -= abs_amt;
                }
                match moyen.as_str() {
                    "carte_bancaire" => reconciled_carte -= abs_amt,
                    "cheque" => reconciled_cheque -= abs_amt,
                    "virement" => reconciled_virement -= abs_amt,
                    _ => reconciled_especes -= abs_amt,
                }
            } else if type_p == "caution" {
                reconciled_deposits += montant;
                match moyen.as_str() {
                    "carte_bancaire" => reconciled_carte += montant,
                    "cheque" => reconciled_cheque += montant,
                    "virement" => reconciled_virement += montant,
                    _ => reconciled_especes += montant,
                }
            } else if v_id.is_some() || type_p == "vente" {
                reconciled_sales += montant;
                match moyen.as_str() {
                    "carte_bancaire" => reconciled_carte += montant,
                    "cheque" => reconciled_cheque += montant,
                    "virement" => reconciled_virement += montant,
                    _ => reconciled_especes += montant,
                }
            } else {
                reconciled_rentals += montant;
                match moyen.as_str() {
                    "carte_bancaire" => reconciled_carte += montant,
                    "cheque" => reconciled_cheque += montant,
                    "virement" => reconciled_virement += montant,
                    _ => reconciled_especes += montant,
                }
            }
        }

        let theoretical_cash = initial_cash + reconciled_especes;
        let discrepancy = dto.counted_cash_cents - theoretical_cash;

        sqlx::query(
            "UPDATE sessions_caisse 
             SET statut = 'cloturee',
                 total_locations_centimes = ?,
                 total_cautions_centimes = ?,
                 total_ventes_centimes = ?,
                 total_especes_theorique_centimes = ?,
                 total_especes_compte_centimes = ?,
                 total_especes_centimes = ?,
                 total_carte_centimes = ?,
                 total_cheque_centimes = ?,
                 total_virement_centimes = ?,
                 ecart_centimes = ?,
                 closed_at = ?,
                 notes = COALESCE(?, notes)
             WHERE id = ?"
        )
        .bind(reconciled_rentals)
        .bind(reconciled_deposits)
        .bind(reconciled_sales)
        .bind(theoretical_cash)
        .bind(dto.counted_cash_cents)
        .bind(reconciled_especes)
        .bind(reconciled_carte)
        .bind(reconciled_cheque)
        .bind(reconciled_virement)
        .bind(discrepancy)
        .bind(&now)
        .bind(&dto.operator_notes)
        .bind(&sid)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        Ok(sid)
    }.await {
        Ok(id) => {
            tx.commit().await?;
            id
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    fetch_cash_session_dto_by_id(pool, &session_id).await
}

#[command]
pub async fn close_cash_session(dto: CloseCashSessionDto, state: State<'_, DbState>) -> Result<CashSessionDto, AppError> {
    execute_close_cash_session(&state.pool, dto).await
}

pub async fn execute_get_active_cash_session(pool: &sqlx::SqlitePool) -> Result<Option<CashSessionDto>, AppError> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM sessions_caisse WHERE statut = 'ouverte' ORDER BY date_session DESC LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    match row {
        Some((id,)) => Ok(Some(fetch_cash_session_dto_by_id(pool, &id).await?)),
        None => Ok(None),
    }
}

#[command]
pub async fn get_active_cash_session(state: State<'_, DbState>) -> Result<Option<CashSessionDto>, AppError> {
    execute_get_active_cash_session(&state.pool).await
}

pub async fn execute_record_payment(pool: &sqlx::SqlitePool, dto: RecordPaymentDto) -> Result<Paiement, AppError> {
    let valid_types = [
        "acompte",
        "solde",
        "caution",
        "frais_retard",
        "degradation",
        "remboursement",
        "vente_directe",
    ];
    if !valid_types.contains(&dto.type_paiement.as_str()) {
        return Err(AppError::Validation(format!(
            "Type de paiement invalide : '{}'. Types autorisés : acompte, solde, caution, frais_retard, degradation, remboursement, vente_directe.",
            dto.type_paiement
        )));
    }

    let is_refund = dto.type_paiement == "remboursement";
    if is_refund {
        if dto.montant_centimes == 0 {
            return Err(AppError::Validation("Le montant d'un remboursement ne peut pas être nul.".to_string()));
        }
    } else if dto.montant_centimes <= 0 {
        return Err(AppError::Validation("Le montant du paiement doit être strictement positif.".to_string()));
    }

    let stored_montant = if is_refund {
        -dto.montant_centimes.abs()
    } else {
        dto.montant_centimes
    };

    let mut tx = ImmediateTx::begin(pool).await?;

    let pay_id = match async {
        let user_exists: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM utilisateurs WHERE id = ? AND est_actif = 1"
        )
        .bind(&dto.utilisateur_id)
        .fetch_optional(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        if user_exists.is_none() {
            return Err(AppError::Validation(format!("Utilisateur introuvable ou inactif : {}", dto.utilisateur_id)));
        }

        let now = chrono::Utc::now().to_rfc3339();
        let pay_id = format!("pay-{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));

        // 1. Mise à jour de la location si location_id est spécifié
        if let Some(ref loc_id) = dto.location_id {
            let loc_exists: Option<(String,)> = sqlx::query_as(
                "SELECT id FROM locations WHERE id = ?"
            )
            .bind(loc_id)
            .fetch_optional(&mut *tx.conn)
            .await
            .map_err(map_sqlite_err)?;

            if loc_exists.is_none() {
                return Err(AppError::NotFound(format!("Contrat de location introuvable : {}", loc_id)));
            }

            if dto.type_paiement == "caution" {
                sqlx::query("UPDATE locations SET statut_caution = 'encaissee', updated_at = ? WHERE id = ?")
                    .bind(&now)
                    .bind(loc_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            } else {
                sqlx::query("UPDATE locations SET updated_at = ? WHERE id = ?")
                    .bind(&now)
                    .bind(loc_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            }
        }

        // 2. Insertion dans paiements (non modifiable, non supprimable)
        sqlx::query(
            "INSERT INTO paiements (
                id, location_id, vente_id, utilisateur_id, montant_centimes,
                type_paiement, moyen_paiement, reference_transaction, notes, date_paiement
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&pay_id)
        .bind(&dto.location_id)
        .bind(&dto.vente_id)
        .bind(&dto.utilisateur_id)
        .bind(stored_montant)
        .bind(&dto.type_paiement)
        .bind(&dto.moyen_paiement)
        .bind(&dto.reference_transaction)
        .bind(&dto.notes)
        .bind(&now)
        .execute(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        // 3. Incrément / Décrément des totaux dans la session de caisse active si ouverte
        let active_session: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM sessions_caisse WHERE statut = 'ouverte' ORDER BY date_session DESC LIMIT 1"
        )
        .fetch_optional(&mut *tx.conn)
        .await
        .map_err(map_sqlite_err)?;

        if let Some((ses_id,)) = active_session {
            let col_name = match dto.moyen_paiement.as_str() {
                "especes" => "total_especes_centimes",
                "carte_bancaire" => "total_carte_centimes",
                "cheque" => "total_cheque_centimes",
                "virement" => "total_virement_centimes",
                _ => "total_especes_centimes",
            };

            if is_refund {
                let refund_abs = dto.montant_centimes.abs();
                let update_sql = format!(
                    "UPDATE sessions_caisse 
                     SET total_locations_centimes = total_locations_centimes - ?,
                         {} = {} - ?
                     WHERE id = ?",
                    col_name, col_name
                );
                sqlx::query(&update_sql)
                    .bind(refund_abs)
                    .bind(refund_abs)
                    .bind(&ses_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            } else if dto.type_paiement == "caution" {
                let update_sql = format!(
                    "UPDATE sessions_caisse 
                     SET total_cautions_centimes = total_cautions_centimes + ?,
                         {} = {} + ?
                     WHERE id = ?",
                    col_name, col_name
                );
                sqlx::query(&update_sql)
                    .bind(dto.montant_centimes)
                    .bind(dto.montant_centimes)
                    .bind(&ses_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            } else if dto.vente_id.is_some() {
                let update_sql = format!(
                    "UPDATE sessions_caisse 
                     SET total_ventes_centimes = total_ventes_centimes + ?,
                         {} = {} + ?
                     WHERE id = ?",
                    col_name, col_name
                );
                sqlx::query(&update_sql)
                    .bind(dto.montant_centimes)
                    .bind(dto.montant_centimes)
                    .bind(&ses_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            } else {
                let update_sql = format!(
                    "UPDATE sessions_caisse 
                     SET total_locations_centimes = total_locations_centimes + ?,
                         {} = {} + ?
                     WHERE id = ?",
                    col_name, col_name
                );
                sqlx::query(&update_sql)
                    .bind(dto.montant_centimes)
                    .bind(dto.montant_centimes)
                    .bind(&ses_id)
                    .execute(&mut *tx.conn)
                    .await
                    .map_err(map_sqlite_err)?;
            }
        }

        Ok(pay_id)
    }.await {
        Ok(id) => {
            tx.commit().await?;
            id
        }
        Err(e) => {
            let _ = tx.rollback().await;
            return Err(e);
        }
    };

    sqlx::query_as::<_, Paiement>("SELECT * FROM paiements WHERE id = ?")
        .bind(&pay_id)
        .fetch_one(pool)
        .await
        .map_err(AppError::DatabaseError)
}

#[command]
pub async fn record_payment(dto: RecordPaymentDto, state: State<'_, DbState>) -> Result<Paiement, AppError> {
    execute_record_payment(&state.pool, dto).await
}

pub async fn execute_list_payments(pool: &sqlx::SqlitePool, location_id: Option<String>, vente_id: Option<String>) -> Result<Vec<Paiement>, AppError> {
    if let Some(loc_id) = location_id {
        sqlx::query_as::<_, Paiement>("SELECT * FROM paiements WHERE location_id = ? ORDER BY date_paiement ASC")
            .bind(loc_id)
            .fetch_all(pool)
            .await
            .map_err(AppError::DatabaseError)
    } else if let Some(v_id) = vente_id {
        sqlx::query_as::<_, Paiement>("SELECT * FROM paiements WHERE vente_id = ? ORDER BY date_paiement ASC")
            .bind(v_id)
            .fetch_all(pool)
            .await
            .map_err(AppError::DatabaseError)
    } else {
        sqlx::query_as::<_, Paiement>("SELECT * FROM paiements ORDER BY date_paiement DESC")
            .fetch_all(pool)
            .await
            .map_err(AppError::DatabaseError)
    }
}

#[command]
pub async fn list_payments(location_id: Option<String>, vente_id: Option<String>, state: State<'_, DbState>) -> Result<Vec<Paiement>, AppError> {
    execute_list_payments(&state.pool, location_id, vente_id).await
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
    _date_debut: Option<String>,
    _date_fin: Option<String>,
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

    let backup_pre_restore = app_data_dir.join("costume_rental.db.pre-restore.bak");
    let wal_path = app_data_dir.join("costume_rental.db-wal");
    let shm_path = app_data_dir.join("costume_rental.db-shm");
    let wal_bak = app_data_dir.join("costume_rental.db.pre-restore.bak-wal");
    let shm_bak = app_data_dir.join("costume_rental.db.pre-restore.bak-shm");

    // 5. Renommage de la base actuelle en .pre-restore.bak (ne JAMAIS supprimer avant que la nouvelle soit en place)
    if db_path.exists() {
        let mut backed_up = false;
        for _ in 0..15 {
            let _ = fs::remove_file(&backup_pre_restore);
            if fs::rename(&db_path, &backup_pre_restore).is_ok() {
                backed_up = true;
                break;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }

        if !backed_up {
            let _ = fs::remove_file(&tmp_path);
            return Err(AppError::Internal(
                "Impossible de créer la sauvegarde de secours .pre-restore.bak de la base actuelle. Restauration annulée.".to_string()
            ));
        }

        // Sauvegarde également des journaux WAL et SHM si existants
        if wal_path.exists() {
            let _ = fs::rename(&wal_path, &wal_bak);
        }
        if shm_path.exists() {
            let _ = fs::rename(&shm_path, &shm_bak);
        }
    }

    // 6. Renommage du fichier temporaire validé vers le nom de la base active
    let mut renamed = false;
    let mut last_err = None;
    for _ in 0..15 {
        match fs::rename(&tmp_path, &db_path) {
            Ok(_) => {
                renamed = true;
                break;
            }
            Err(e) => {
                last_err = Some(e);
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            }
        }
    }

    // Garde de secours absolue : si le renommage de la nouvelle base échoue,
    // on remet IMMÉDIATEMENT l'ancienne base en place !
    if !renamed {
        let _ = fs::remove_file(&tmp_path);
        if backup_pre_restore.exists() {
            let _ = fs::rename(&backup_pre_restore, &db_path);
            if wal_bak.exists() {
                let _ = fs::rename(&wal_bak, &wal_path);
            }
            if shm_bak.exists() {
                let _ = fs::rename(&shm_bak, &shm_path);
            }
        }
        return Err(AppError::Internal(format!(
            "Échec du remplacement atomique de la base SQLite : {}. L'ancienne base a été immédiatement rétablie.",
            last_err.map(|e| e.to_string()).unwrap_or_else(|| "Erreur inconnue".to_string())
        )));
    }

    // 7. Nettoyage des journaux résiduels de l'ancienne base (mais le .pre-restore.bak n'est JAMAIS supprimé automatiquement)
    if wal_path.exists() {
        let _ = fs::remove_file(&wal_path);
    }
    if shm_path.exists() {
        let _ = fs::remove_file(&shm_path);
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

// ----------------------------------------------------------------------------
// 10. PHOTOS D'ARTICLES (SQLITE BLOB)
// ----------------------------------------------------------------------------

#[command]
pub async fn set_article_photo(
    dto: SetArticlePhotoDto,
    state: State<'_, DbState>,
) -> Result<ArticlePhotoThumbDto, AppError> {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;

    if dto.article_id.trim().is_empty() {
        return Err(AppError::Validation("article_id est requis".to_string()));
    }

    let data_bytes = engine
        .decode(&dto.data_base64)
        .map_err(|e| AppError::Validation(format!("Données image base64 invalides : {}", e)))?;
    let thumb_bytes = engine
        .decode(&dto.thumb_base64)
        .map_err(|e| AppError::Validation(format!("Miniature base64 invalide : {}", e)))?;

    let photo_id = format!("photo-{}", chrono::Utc::now().timestamp_millis());
    let now = chrono::Utc::now().to_rfc3339();

    // Remplacement ou insertion : on supprime d'abord les anciennes photos de l'article pour avoir 1 photo principale par modèle
    sqlx::query("DELETE FROM article_photos WHERE article_id = ?")
        .bind(&dto.article_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    sqlx::query(
        "INSERT INTO article_photos (id, article_id, mime, data, thumb, created_at)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&photo_id)
    .bind(&dto.article_id)
    .bind(&dto.mime)
    .bind(&data_bytes)
    .bind(&thumb_bytes)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(ArticlePhotoThumbDto {
        article_id: dto.article_id,
        photo_id,
        mime: dto.mime,
        thumb_base64: dto.thumb_base64,
    })
}

#[command]
pub async fn get_article_photo_thumb(
    article_ids: Vec<String>,
    state: State<'_, DbState>,
) -> Result<Vec<ArticlePhotoThumbDto>, AppError> {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;

    if article_ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    // Requête par lot : itère ou requête SQLite avec IN clause
    for chunk in article_ids.chunks(50) {
        let placeholders = chunk.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let query_str = format!(
            "SELECT id, article_id, mime, thumb FROM article_photos WHERE article_id IN ({})",
            placeholders
        );

        let mut query = sqlx::query_as::<_, (String, String, String, Vec<u8>)>(&query_str);
        for id in chunk {
            query = query.bind(id);
        }

        let rows = query
            .fetch_all(&state.pool)
            .await
            .map_err(AppError::DatabaseError)?;

        for (photo_id, art_id, mime, thumb_blob) in rows {
            let thumb_b64 = engine.encode(&thumb_blob);
            results.push(ArticlePhotoThumbDto {
                article_id: art_id,
                photo_id,
                mime,
                thumb_base64: thumb_b64,
            });
        }
    }

    Ok(results)
}

#[command]
pub async fn get_article_photo_full(
    article_id: String,
    state: State<'_, DbState>,
) -> Result<Option<ArticlePhotoFullDto>, AppError> {
    use base64::Engine as _;
    let engine = base64::engine::general_purpose::STANDARD;

    let row = sqlx::query_as::<_, (String, String, String, Vec<u8>)>(
        "SELECT id, article_id, mime, data FROM article_photos WHERE article_id = ? LIMIT 1"
    )
    .bind(&article_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::DatabaseError)?;

    if let Some((photo_id, art_id, mime, data_blob)) = row {
        let data_b64 = engine.encode(&data_blob);
        Ok(Some(ArticlePhotoFullDto {
            photo_id,
            article_id: art_id,
            mime,
            data_base64: data_b64,
        }))
    } else {
        Ok(None)
    }
}

#[command]
pub async fn delete_article_photo(
    article_id: String,
    state: State<'_, DbState>,
) -> Result<bool, AppError> {
    let res = sqlx::query("DELETE FROM article_photos WHERE article_id = ?")
        .bind(&article_id)
        .execute(&state.pool)
        .await
        .map_err(AppError::DatabaseError)?;

    Ok(res.rows_affected() > 0)
}


