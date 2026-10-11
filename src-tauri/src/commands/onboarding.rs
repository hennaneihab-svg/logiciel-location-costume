use tauri::{command, State};
use crate::db::DbState;
use crate::error::AppError;
use crate::models::{InitialSetupInput, AuthUserDto};
use sqlx::SqlitePool;

pub async fn execute_check_setup_required(pool: &SqlitePool) -> Result<bool, AppError> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM utilisateurs")
        .fetch_one(pool)
        .await
        .map_err(AppError::DatabaseError)?;
    Ok(count.0 == 0)
}

pub async fn execute_complete_initial_setup(pool: &SqlitePool, dto: InitialSetupInput) -> Result<(), AppError> {
    let username = dto.admin_username.trim();
    if username.is_empty() {
        return Err(AppError::Validation("L'identifiant administrateur est requis.".into()));
    }
    if dto.admin_password_hash.trim().is_empty() {
        return Err(AppError::Validation("Le mot de passe administrateur est requis.".into()));
    }
    let boutique_name = dto.boutique_name.trim();
    if boutique_name.is_empty() {
        return Err(AppError::Validation("Le nom de la boutique est requis.".into()));
    }
    let activity = dto.activity_type.trim().to_lowercase();
    if activity != "homme" && activity != "femme" && activity != "mixte" {
        return Err(AppError::Validation("Le type d'activité doit être 'homme', 'femme' ou 'mixte'.".into()));
    }

    let mut tx = pool.begin().await.map_err(AppError::DatabaseError)?;

    // 1. Création du compte administrateur
    let now = chrono::Utc::now().to_rfc3339();
    let admin_id = format!("usr-admin-{}", chrono::Utc::now().timestamp_millis());
    let full_name = if dto.admin_full_name.trim().is_empty() {
        "Administrateur".to_string()
    } else {
        dto.admin_full_name.trim().to_string()
    };

    sqlx::query(
        "INSERT INTO utilisateurs (id, nom_utilisateur, mot_de_passe_hash, nom_complet, role, est_actif, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)"
    )
    .bind(&admin_id)
    .bind(username)
    .bind(&dto.admin_password_hash)
    .bind(&full_name)
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    // 2. Enregistrement des paramètres boutique avec le type d'activité
    let boutique_val = serde_json::json!({
        "name": boutique_name,
        "slogan": "",
        "address": dto.boutique_address.trim(),
        "postal_code": "",
        "city": "",
        "phone": dto.boutique_phone.trim(),
        "email": "",
        "siret": "",
        "rcs": "",
        "website": "",
        "logo_url": "",
        "legal_notice": "TVA algérienne à 19% applicable selon la législation fiscale en vigueur.",
        "activity_type": activity
    }).to_string();

    sqlx::query(
        "INSERT INTO parametres (cle, valeur, updated_at)
         VALUES ('boutique', ?, ?)
         ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at"
    )
    .bind(&boutique_val)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(AppError::DatabaseError)?;

    // 3. Initialisation des catégories adaptées au type d'activité choisi
    let cats = match activity.as_str() {
        "femme" => vec![
            ("cat-fem-01", "Robes de Soirée & Gala", "costume", "Robes longues de soirée et de gala"),
            ("cat-fem-02", "Robes de Mariée & Cérémonie", "costume", "Robes blanches, sirènes et cortège"),
            ("cat-fem-03", "Caftans & Karakous", "costume", "Tenues traditionnelles et broderies"),
            ("cat-fem-04", "Chaussures & Escarpins", "chaussure", "Escarpins et talons de cérémonie"),
            ("cat-fem-05", "Accessoires & Pochettes", "accessoire", "Pochettes, parures et ornements"),
        ],
        "homme" => vec![
            ("cat-01", "Smokings Cérémonie", "costume", "Smokings 1 et 2 boutons pour soirées de gala"),
            ("cat-02", "Costumes 3 Pièces", "costume", "Costumes complets avec gilet assorti"),
            ("cat-03", "Costumes 2 Pièces", "costume", "Costumes business et cocktail"),
            ("cat-04", "Chaussures Richelieu & Derbies", "chaussure", "Chaussures habillées en cuir"),
            ("cat-06", "Accessoires Prestige", "accessoire", "Cravates, nœuds papillon et ceintures"),
        ],
        _ => vec![ // "mixte"
            ("cat-01", "Costumes & Smokings", "costume", "Costumes et smokings hommes"),
            ("cat-fem-01", "Robes de Soirée & Mariée", "costume", "Robes de soirée et mariée femmes"),
            ("cat-fem-03", "Tenues Traditionnelles", "costume", "Caftans, karakous et tenues d'apparat"),
            ("cat-04", "Chaussures Cérémonie", "chaussure", "Chaussures habillées hommes et femmes"),
            ("cat-06", "Accessoires d'Apparat", "accessoire", "Accessoires de cérémonie divers"),
        ],
    };

    for (cid, cnom, ctype, cdesc) in cats {
        sqlx::query(
            "INSERT OR IGNORE INTO categories (id, nom, type, description, created_at)
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind(cid)
        .bind(cnom)
        .bind(ctype)
        .bind(cdesc)
        .bind(&now)
        .execute(&mut *tx)
        .await
        .map_err(AppError::DatabaseError)?;
    }

    tx.commit().await.map_err(AppError::DatabaseError)?;
    Ok(())
}

pub async fn execute_list_auth_users(pool: &SqlitePool) -> Result<Vec<AuthUserDto>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, String, String, i64, String, String)>(
        "SELECT id, nom_utilisateur, nom_complet, role, est_actif, mot_de_passe_hash, created_at FROM utilisateurs"
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    Ok(rows.into_iter().map(|(id, u, f, r, act, h, c)| AuthUserDto {
        id,
        username: u,
        full_name: f,
        role: r,
        is_active: act == 1,
        password_hash: h,
        created_at: c,
        last_login: None,
    }).collect())
}

#[command]
pub async fn check_setup_required(state: State<'_, DbState>) -> Result<bool, AppError> {
    execute_check_setup_required(&state.pool).await
}

#[command]
pub async fn complete_initial_setup(dto: InitialSetupInput, state: State<'_, DbState>) -> Result<(), AppError> {
    execute_complete_initial_setup(&state.pool, dto).await
}

#[command]
pub async fn list_auth_users(state: State<'_, DbState>) -> Result<Vec<AuthUserDto>, AppError> {
    execute_list_auth_users(&state.pool).await
}

#[command]
pub async fn seed_demo_data(state: State<'_, DbState>) -> Result<(), AppError> {
    crate::db::seed_demo_data(&state.pool).await
}
