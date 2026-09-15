pub mod commands;
pub mod db;
pub mod error;
pub mod models;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Initialisation de la base SQLite et des migrations dans le répertoire de données de l'application
            let app_data_dir = app.path().app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            tauri::async_runtime::block_on(async {
                let pool = db::init_db(&app_data_dir).await
                    .expect("Échec critique lors de l'initialisation de la base SQLite et des migrations");
                app.manage(db::DbState { pool });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Articles
            commands::list_articles,
            commands::get_article,
            commands::create_article,
            commands::delete_article,
            // Variantes
            commands::list_variantes,
            commands::update_variante_statut,
            // Clients
            commands::list_clients,
            commands::get_client,
            commands::create_client,
            commands::delete_client,
            // Locations
            commands::list_locations,
            commands::get_location,
            commands::update_location_statut,
            // Paiements
            commands::list_paiements,
            commands::create_paiement,
            // Alertes
            commands::list_alertes,
            commands::traiter_alerte,
            // Dashboard
            commands::get_dashboard_stats,
            commands::get_full_dashboard_stats,
            // Sauvegarde & Restauration
            commands::backup_database,
            commands::restore_database,
            commands::restart_app,
            // Packs
            commands::list_packs,
            commands::reserve_pack,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur fatale lors du lancement de l'application Tauri");
}
