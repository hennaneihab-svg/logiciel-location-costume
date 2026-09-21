use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Erreur de base de données : {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Ressource introuvable : {0}")]
    NotFound(String),

    #[error("Erreur de validation : {0}")]
    Validation(String),

    #[error("Base occupée : {0}")]
    Busy(String),

    #[error("Erreur interne : {0}")]
    Internal(String),
}

// Sérialisation automatique en chaîne d'erreur exploitable par l'IPC Tauri
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
