use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::fs;
use crate::error::AppError;

pub const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial_schema.sql");
pub const MIGRATION_0002: &str = include_str!("../../migrations/0002_seed_demo_data.sql");
pub const MIGRATION_0003: &str = include_str!("../../migrations/0003_articles_mode_gestion_et_packs.sql");
pub const MIGRATION_0004: &str = include_str!("../../migrations/0004_article_photos.sql");
pub const MIGRATION_0005: &str = include_str!("../../migrations/0005_rental_caisse_sqlite_tables.sql");
pub const MIGRATION_0006: &str = include_str!("../../migrations/0006_fix_lignes_location_fk_restrict.sql");
pub const MIGRATION_0007: &str = include_str!("../../migrations/0007_annual_numbering_counters.sql");
pub const MIGRATION_0008: &str = include_str!("../../migrations/0008_pressing.sql");
pub const MIGRATION_0009: &str = include_str!("../../migrations/0009_rename_sessions_caisse_totals_centimes.sql");
pub const MIGRATION_0010: &str = include_str!("../../migrations/0010_restore_sessions_caisse_french_column_names.sql");
pub const MIGRATION_0011: &str = include_str!("../../migrations/0011_settings_and_parameters.sql");
pub const MIGRATION_0012: &str = include_str!("../../migrations/0012_performance_indexes.sql");
pub const MIGRATION_0013: &str = include_str!("../../migrations/0013_add_pack_id_to_lignes_location.sql");

pub struct DbState {
    pub pool: SqlitePool,
}

pub async fn init_db(app_dir: &Path) -> Result<SqlitePool, AppError> {
    if !app_dir.exists() {
        fs::create_dir_all(app_dir)
            .map_err(|e| AppError::Internal(format!("Impossible de créer le dossier app: {}", e)))?;
    }

    let db_path = app_dir.join("costume_rental.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
    use std::str::FromStr;

    let opts = SqliteConnectOptions::from_str(&db_url)
        .map_err(AppError::DatabaseError)?
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5))
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect_with(opts)
        .await
        .map_err(AppError::DatabaseError)?;

    // Exécution des migrations versionnées
    run_migrations(&pool).await?;

    Ok(pool)
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    // Table de suivi des migrations
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            nom TEXT NOT NULL,
            appliquee_le TEXT NOT NULL
        );"
    )
    .execute(pool)
    .await
    .map_err(AppError::DatabaseError)?;

    // Migration 0001
    let row: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 1")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row.is_none() {
        // Exécution du schéma initial
        for statement in MIGRATION_0001.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt)
                    .execute(pool)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (1, '0001_initial_schema', ?)")
            .bind(now)
            .execute(pool)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    // Migration 0002 (Seed)
    let row2: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 2")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row2.is_none() {
        for statement in MIGRATION_0002.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt)
                    .execute(pool)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (2, '0002_seed_demo_data', ?)")
            .bind(now)
            .execute(pool)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    // Migration 0003 (Mode de gestion & Packs)
    let row3: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 3")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row3.is_none() {
        for statement in MIGRATION_0003.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt)
                    .execute(pool)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (3, '0003_articles_mode_gestion_et_packs', ?)")
            .bind(now)
            .execute(pool)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    // Migration 0004 (Article Photos)
    let row4: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 4")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row4.is_none() {
        for statement in MIGRATION_0004.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt)
                    .execute(pool)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (4, '0004_article_photos', ?)")
            .bind(now)
            .execute(pool)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    // Migration 0005 (Contrats de location, sessions caisse & app_meta)
    let row5: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 5")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row5.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("PRAGMA foreign_keys = OFF;").execute(&mut *conn).await.map_err(AppError::DatabaseError)?;

        for statement in MIGRATION_0005.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
        }

        sqlx::query("PRAGMA foreign_keys = ON;").execute(&mut *conn).await.map_err(AppError::DatabaseError)?;

        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (5, '0005_rental_caisse_sqlite_tables', ?)")
            .bind(now)
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;
    }

    // Migration 0006 (Reconstruction lignes_location avec ON DELETE RESTRICT & ventilation caisse)
    let row6: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 6")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row6.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;

        // 1. Désactiver foreign_keys AVANT d'ouvrir la transaction (le pragma est inopérant au sein d'une transaction)
        sqlx::query("PRAGMA foreign_keys = OFF;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        // 2. Ouvrir la transaction de migration
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            for statement in MIGRATION_0006.split(';') {
                let stmt = statement.trim();
                if !stmt.is_empty() {
                    sqlx::query(stmt)
                        .execute(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;
                }
            }

            // 3. Contrôle de cohérence référentielle AVANT commit
            let fk_violations: Vec<(String, Option<i64>, String, i64)> = sqlx::query_as("PRAGMA foreign_key_check;")
                .fetch_all(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;

            if !fk_violations.is_empty() {
                return Err(AppError::Validation(format!(
                    "Échec migration 0006 : violations de clés étrangères détectées : {:?}",
                    fk_violations
                )));
            }

            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                // 4. Commit puis réactivation des foreign keys
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                sqlx::query("PRAGMA foreign_keys = ON;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (6, '0006_fix_lignes_location_fk_restrict', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                let _ = sqlx::query("PRAGMA foreign_keys = ON;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    // Migration 0007 (Compteurs annuels dans app_meta)
    let row7: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 7")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row7.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            for statement in MIGRATION_0007.split(';') {
                let stmt = statement.trim();
                if !stmt.is_empty() {
                    sqlx::query(stmt)
                        .execute(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;
                }
            }
            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (7, '0007_annual_numbering_counters', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    // Migration 0008 (Module Pressing)
    let row8: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 8")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row8.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            for statement in MIGRATION_0008.split(';') {
                let stmt = statement.trim();
                if !stmt.is_empty() {
                    sqlx::query(stmt)
                        .execute(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;
                }
            }

            // Vérification de l'intégrité référentielle
            let fk_violations: Vec<(String, Option<i64>, String, i64)> =
                sqlx::query_as("PRAGMA foreign_key_check;")
                    .fetch_all(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

            if !fk_violations.is_empty() {
                return Err(AppError::DatabaseError(sqlx::Error::Configuration(
                    format!("Violations de clés étrangères détectées après migration 0008 : {:?}", fk_violations).into()
                )));
            }

            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (8, '0008_pressing', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    // Migration 0009 (Renommage des colonnes sessions_caisse en convention centimes)
    let row9: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 9")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row9.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            let columns: Vec<(String,)> = sqlx::query_as("SELECT name FROM pragma_table_info('sessions_caisse')")
                .fetch_all(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;
            let col_names: Vec<String> = columns.into_iter().map(|c| c.0).collect();

            if col_names.contains(&"total_locations_centimes".to_string()) && !col_names.contains(&"rentals_total_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN total_locations_centimes TO rentals_total_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            } else if col_names.contains(&"rentals_total_cents".to_string()) && !col_names.contains(&"rentals_total_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN rentals_total_cents TO rentals_total_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }

            if col_names.contains(&"total_cautions_centimes".to_string()) && !col_names.contains(&"deposits_total_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN total_cautions_centimes TO deposits_total_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            } else if col_names.contains(&"deposits_total_cents".to_string()) && !col_names.contains(&"deposits_total_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN deposits_total_cents TO deposits_total_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }

            if col_names.contains(&"total_ventes_centimes".to_string()) && !col_names.contains(&"sales_total_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN total_ventes_centimes TO sales_total_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            } else if col_names.contains(&"sales_total_cents".to_string()) && !col_names.contains(&"sales_total_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN sales_total_cents TO sales_total_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }

            // Vérification de l'intégrité référentielle
            let fk_violations: Vec<(String, Option<i64>, String, i64)> =
                sqlx::query_as("PRAGMA foreign_key_check;")
                    .fetch_all(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

            if !fk_violations.is_empty() {
                return Err(AppError::DatabaseError(sqlx::Error::Configuration(
                    format!("Violations de clés étrangères détectées après migration 0009 : {:?}", fk_violations).into()
                )));
            }

            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (9, '0009_rename_sessions_caisse_totals_centimes', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    // Migration 0010 (Rétablissement des noms de colonnes français d'origine pour sessions_caisse)
    let row10: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 10")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row10.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            let columns: Vec<(String,)> = sqlx::query_as("SELECT name FROM pragma_table_info('sessions_caisse')")
                .fetch_all(&mut *conn)
                .await
                .map_err(AppError::DatabaseError)?;
            let col_names: Vec<String> = columns.into_iter().map(|c| c.0).collect();

            if col_names.contains(&"rentals_total_centimes".to_string()) && !col_names.contains(&"total_locations_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN rentals_total_centimes TO total_locations_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            } else if col_names.contains(&"rentals_total_cents".to_string()) && !col_names.contains(&"total_locations_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN rentals_total_cents TO total_locations_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }

            if col_names.contains(&"deposits_total_centimes".to_string()) && !col_names.contains(&"total_cautions_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN deposits_total_centimes TO total_cautions_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            } else if col_names.contains(&"deposits_total_cents".to_string()) && !col_names.contains(&"total_cautions_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN deposits_total_cents TO total_cautions_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }

            if col_names.contains(&"sales_total_centimes".to_string()) && !col_names.contains(&"total_ventes_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN sales_total_centimes TO total_ventes_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            } else if col_names.contains(&"sales_total_cents".to_string()) && !col_names.contains(&"total_ventes_centimes".to_string()) {
                sqlx::query("ALTER TABLE sessions_caisse RENAME COLUMN sales_total_cents TO total_ventes_centimes;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }

            // Vérification de l'intégrité référentielle
            let fk_violations: Vec<(String, Option<i64>, String, i64)> =
                sqlx::query_as("PRAGMA foreign_key_check;")
                    .fetch_all(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

            if !fk_violations.is_empty() {
                return Err(AppError::DatabaseError(sqlx::Error::Configuration(
                    format!("Violations de clés étrangères détectées après migration 0010 : {:?}", fk_violations).into()
                )));
            }

            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (10, '0010_restore_sessions_caisse_french_column_names', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    // Migration 0011 (Table parametres et reglages de l'etablissement)
    let row11: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 11")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row11.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            for stmt in MIGRATION_0011.split(';') {
                let trimmed = stmt.trim();
                if !trimmed.is_empty() {
                    sqlx::query(trimmed)
                        .execute(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;
                }
            }

            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (11, '0011_settings_and_parameters', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    // Migration 0012 (Index de performance sur tables critiques)
    let row12: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 12")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row12.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            for stmt in MIGRATION_0012.split(';') {
                let trimmed = stmt.trim();
                if !trimmed.is_empty() {
                    sqlx::query(trimmed)
                        .execute(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;
                }
            }

            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (12, '0012_performance_indexes', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    // Migration 0013 (Colonne pack_id dans lignes_location)
    let row13: Option<(i64,)> = sqlx::query_as("SELECT version FROM _migrations WHERE version = 13")
        .fetch_optional(pool)
        .await
        .map_err(AppError::DatabaseError)?;

    if row13.is_none() {
        let mut conn = pool.acquire().await.map_err(AppError::DatabaseError)?;
        sqlx::query("BEGIN IMMEDIATE;")
            .execute(&mut *conn)
            .await
            .map_err(AppError::DatabaseError)?;

        let migration_res: Result<(), AppError> = async {
            for stmt in MIGRATION_0013.split(';') {
                let trimmed = stmt.trim();
                if !trimmed.is_empty() {
                    sqlx::query(trimmed)
                        .execute(&mut *conn)
                        .await
                        .map_err(AppError::DatabaseError)?;
                }
            }
            Ok(())
        }.await;

        match migration_res {
            Ok(()) => {
                sqlx::query("COMMIT;")
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;

                let now = chrono::Utc::now().to_rfc3339();
                sqlx::query("INSERT INTO _migrations (version, nom, appliquee_le) VALUES (13, '0013_add_pack_id_to_lignes_location', ?)")
                    .bind(now)
                    .execute(&mut *conn)
                    .await
                    .map_err(AppError::DatabaseError)?;
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK;").execute(&mut *conn).await;
                return Err(e);
            }
        }
    }

    Ok(())
}

