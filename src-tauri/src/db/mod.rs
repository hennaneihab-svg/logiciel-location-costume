use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::path::Path;
use std::fs;
use crate::error::AppError;

pub const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial_schema.sql");
pub const MIGRATION_0002: &str = include_str!("../../migrations/0002_seed_demo_data.sql");
pub const MIGRATION_0003: &str = include_str!("../../migrations/0003_articles_mode_gestion_et_packs.sql");
pub const MIGRATION_0004: &str = include_str!("../../migrations/0004_article_photos.sql");
pub const MIGRATION_0005: &str = include_str!("../../migrations/0005_rental_caisse_sqlite_tables.sql");

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

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .connect(&db_url)
        .await
        .map_err(AppError::DatabaseError)?;

    // Configuration des pragmas pour l'intégrité, la concurrence et la performance (WAL + busy_timeout)
    sqlx::query("PRAGMA busy_timeout = 5000;")
        .execute(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .map_err(AppError::DatabaseError)?;

    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(&pool)
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

    Ok(())
}
