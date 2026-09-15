use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============================================================================
// MODÈLES DE DONNÉES RUST (DTOs & Entités SQLite)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Utilisateur {
    pub id: String,
    pub nom_utilisateur: String,
    pub nom_complet: String,
    pub role: String,
    pub est_actif: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Fournisseur {
    pub id: String,
    pub nom: String,
    pub contact_nom: Option<String>,
    pub telephone: Option<String>,
    pub email: Option<String>,
    pub adresse: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Categorie {
    pub id: String,
    pub nom: String,
    pub r#type: String,
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Article {
    pub id: String,
    pub categorie_id: String,
    pub fournisseur_id: Option<String>,
    pub reference: String,
    pub nom: String,
    pub marque: Option<String>,
    pub couleur: Option<String>,
    pub description: Option<String>,
    pub prix_location_centimes: i64,
    pub prix_vente_centimes: Option<i64>,
    pub caution_suggeree_centimes: i64,
    pub frais_nettoyage_centimes: i64,
    pub image_url: Option<String>,
    pub est_actif: i64,
    pub mode_gestion: String,
    pub quantite_stock: Option<i64>,
    pub quantite_disponible: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateArticleDto {
    pub categorie_id: String,
    pub fournisseur_id: Option<String>,
    pub reference: String,
    pub nom: String,
    pub marque: Option<String>,
    pub couleur: Option<String>,
    pub description: Option<String>,
    pub prix_location_centimes: i64,
    pub prix_vente_centimes: Option<i64>,
    pub caution_suggeree_centimes: i64,
    pub frais_nettoyage_centimes: Option<i64>,
    pub image_url: Option<String>,
    pub mode_gestion: Option<String>,
    pub quantite_stock: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct VarianteStock {
    pub id: String,
    pub article_id: String,
    pub code_barre: String,
    pub taille: String,
    pub sous_taille: Option<String>,
    pub etat_usure: String,
    pub statut: String,
    pub nb_locations: i64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateVarianteDto {
    pub article_id: String,
    pub code_barre: String,
    pub taille: String,
    pub sous_taille: Option<String>,
    pub etat_usure: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Client {
    pub id: String,
    pub prenom: String,
    pub nom: String,
    pub email: Option<String>,
    pub telephone: String,
    pub telephone_secondaire: Option<String>,
    pub adresse: Option<String>,
    pub ville: Option<String>,
    pub code_postal: Option<String>,
    pub numero_cni: Option<String>,
    pub notes: Option<String>,
    pub est_bloque: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateClientDto {
    pub prenom: String,
    pub nom: String,
    pub email: Option<String>,
    pub telephone: String,
    pub telephone_secondaire: Option<String>,
    pub adresse: Option<String>,
    pub ville: Option<String>,
    pub code_postal: Option<String>,
    pub numero_cni: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Location {
    pub id: String,
    pub numero_location: String,
    pub client_id: String,
    pub utilisateur_id: String,
    pub statut: String,
    pub date_evenement: Option<String>,
    pub date_retrait_prevue: String,
    pub date_retrait_effective: Option<String>,
    pub date_retour_prevue: String,
    pub date_retour_effective: Option<String>,
    pub montant_total_ht_centimes: i64,
    pub tva_taux: f64,
    pub montant_total_ttc_centimes: i64,
    pub frais_nettoyage_centimes: i64,
    pub frais_retard_centimes: i64,
    pub frais_degradation_centimes: i64,
    pub remise_centimes: i64,
    pub montant_caution_centimes: i64,
    pub statut_caution: String,
    pub notes_caution: Option<String>,
    pub notes: Option<String>,
    pub chemin_pdf: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateLocationDto {
    pub client_id: String,
    pub utilisateur_id: String,
    pub date_evenement: Option<String>,
    pub date_retrait_prevue: String,
    pub date_retour_prevue: String,
    pub montant_total_ttc_centimes: i64,
    pub montant_caution_centimes: i64,
    pub statut_caution: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LigneLocation {
    pub id: String,
    pub location_id: String,
    pub variante_id: String,
    pub type_ligne: String,
    pub prix_unitaire_centimes: i64,
    pub caution_centimes: i64,
    pub etat_depart: Option<String>,
    pub etat_retour: Option<String>,
    pub est_rendu: i64,
    pub date_retour: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Paiement {
    pub id: String,
    pub location_id: Option<String>,
    pub vente_id: Option<String>,
    pub utilisateur_id: String,
    pub montant_centimes: i64,
    pub type_paiement: String,
    pub moyen_paiement: String,
    pub reference_transaction: Option<String>,
    pub notes: Option<String>,
    pub date_paiement: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreatePaiementDto {
    pub location_id: Option<String>,
    pub vente_id: Option<String>,
    pub utilisateur_id: String,
    pub montant_centimes: i64,
    pub type_paiement: String,
    pub moyen_paiement: String,
    pub reference_transaction: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Alerte {
    pub id: String,
    pub location_id: String,
    pub client_id: String,
    pub type_alerte: String,
    pub date_echeance: String,
    pub est_declenchee: i64,
    pub date_declenchement: Option<String>,
    pub est_traitee: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardKpis {
    pub ca_mois_centimes: i64,
    pub locations_actives: i64,
    pub taux_disponibilite_pourcentage: f64,
    pub alertes_en_attente: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaEvolutionPoint {
    pub label: String,
    pub date: String,
    pub ca_locations_centimes: i64,
    pub ca_ventes_centimes: i64,
    pub ca_total_centimes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryBreakdown {
    pub categorie_nom: String,
    pub categorie_type: String,
    pub montant_centimes: i64,
    pub pourcentage: f64,
    pub nombre_articles_loues: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopArticleRankingItem {
    pub article_id: String,
    pub reference: String,
    pub nom: String,
    pub categorie_type: String,
    pub nb_locations: i64,
    pub ca_genere_centimes: i64,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRotationStats {
    pub categorie_nom: String,
    pub categorie_type: String,
    pub nombre_articles: i64,
    pub total_locations: i64,
    pub taux_rotation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecondaryKpiStats {
    pub rotations: Vec<CategoryRotationStats>,
    pub valeur_stock_estimee_centimes: i64,
    pub revenu_cumule_genere_centimes: i64,
    pub marge_brute_estimee_centimes: i64,
    pub taux_marge_pourcentage: f64,
    pub taux_retard_mois_pourcentage: f64,
    pub panier_moyen_centimes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpcomingEventItem {
    pub id: String,
    pub contract_number: String,
    pub customer_name: String,
    pub event_type: String, // "retrait" ou "retour"
    pub date_prevue: String,
    pub articles_summary: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullDashboardStats {
    pub ca_periode_centimes: i64,
    pub ca_periode_precedente_centimes: i64,
    pub progression_ca_pourcentage: f64,
    pub taux_occupation_pourcentage: f64,
    pub locations_en_cours: i64,
    pub alertes_actives: i64,
    pub points_evolution: Vec<CaEvolutionPoint>,
    pub repartition_categories: Vec<CategoryBreakdown>,
    pub top_articles_costumes_locations: Vec<TopArticleRankingItem>,
    pub top_articles_costumes_revenu: Vec<TopArticleRankingItem>,
    pub top_articles_chaussures_locations: Vec<TopArticleRankingItem>,
    pub top_articles_chaussures_revenu: Vec<TopArticleRankingItem>,
    pub indicateurs_secondaires: SecondaryKpiStats,
    pub prochains_7_jours: Vec<UpcomingEventItem>,
}

// ----------------------------------------------------------------------------
// PACKS & COMPOSITIONS DE PRESTATIONS
// ----------------------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Pack {
    pub id: String,
    pub nom: String,
    pub cible: String,
    pub prix_forfait_centimes: Option<i64>,
    pub est_actif: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PackItem {
    pub id: String,
    pub pack_id: String,
    pub categorie_id: String,
    pub article_id: Option<String>,
    pub quantite: i64,
    pub obligatoire: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackWithItems {
    pub pack: Pack,
    pub items: Vec<PackItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackItemChoice {
    pub pack_item_id: String,
    pub article_id: Option<String>,
    pub variante_id: Option<String>,
    pub quantite: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReservePackDto {
    pub pack_id: String,
    pub choices: Vec<PackItemChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReservedLine {
    pub pack_item_id: String,
    pub article_id: String,
    pub article_nom: String,
    pub variante_id: Option<String>,
    pub quantite: i64,
    pub mode_gestion: String,
}

