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
    pub variante_id: Option<String>,
    pub article_id: Option<String>,
    pub quantite: i64,
    pub type_ligne: String,
    pub prix_unitaire_centimes: i64,
    pub caution_centimes: i64,
    pub etat_depart: Option<String>,
    pub etat_retour: Option<String>,
    pub est_rendu: i64,
    pub date_retour: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RentalArticleItemDto {
    pub variant_id: String,
    pub article_id: String,
    pub article_name: String,
    pub reference: String,
    pub barcode: String,
    pub size: String,
    pub sub_size: Option<String>,
    pub unit_price_cents: i64,
    pub deposit_cents: i64,
    pub cleaning_fee_cents: i64,
    pub pickup_condition: String,
    pub return_condition: Option<String>,
    pub damage_fee_cents: Option<i64>,
    pub damage_notes: Option<String>,
    pub is_returned: bool,
    pub return_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RentalContractDto {
    pub id: String,
    pub contract_number: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub customer_email: Option<String>,
    pub customer_address: Option<String>,
    pub customer_cni: Option<String>,

    pub status: String,
    pub event_date: Option<String>,
    pub pickup_date: String,
    pub return_date_scheduled: String,
    pub return_date_actual: Option<String>,

    pub items: Vec<RentalArticleItemDto>,

    pub total_rental_cents: i64,
    pub cleaning_fee_cents: i64,
    pub discount_cents: i64,
    pub late_fee_cents: i64,
    pub damage_fee_cents: i64,
    pub total_amount_cents: i64,

    pub deposit_amount_cents: i64,
    pub deposit_status: String,
    pub deposit_method: String,
    pub deposit_notes: Option<String>,

    pub paid_amount_cents: i64,
    pub payment_method: String,
    pub remaining_amount_cents: i64,

    pub notes: Option<String>,
    pub pdf_archived_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RentalQuantityItemInput {
    pub article_id: String,
    pub quantite: i64,
}

/// Ligne issue d'un pack (résultat de la sélection PackReservationModal côté frontend).
/// Chaque slot du pack produit une PackLineItemDto distincte, toutes rattachées au même pack_id.
#[derive(Debug, Clone, Deserialize)]
pub struct PackLineItemDto {
    /// ID du pack auquel cette ligne appartient (tracé dans lignes_location.pack_id)
    pub pack_id: String,
    /// ID de la variante choisie (mode_gestion = 'variante')
    pub variante_id: Option<String>,
    /// ID de l'article (mode_gestion = 'quantite', sans variante individuelle)
    pub article_id: Option<String>,
    /// Quantité demandée (1 pour les variantes unitaires, >1 pour accessoires en vrac)
    pub quantite: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateRentalContractDto {
    pub customer_id: String,
    pub utilisateur_id: Option<String>,
    pub pickup_date: String,
    pub return_date_scheduled: String,
    pub event_date: Option<String>,
    pub selected_variant_ids: Vec<String>,
    pub quantity_items: Option<Vec<RentalQuantityItemInput>>,
    /// Lignes issues de packs — chaque ligne porte son pack_id pour la traçabilité
    pub pack_lines: Option<Vec<PackLineItemDto>>,
    pub discount_cents: Option<i64>,
    pub deposit_method: String,
    pub deposit_amount_cents: Option<i64>,
    pub paid_amount_cents: Option<i64>,
    pub payment_method: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReturnItemInputDto {
    pub variant_id: Option<String>,
    pub article_id: Option<String>,
    pub condition: String,
    pub damage_fee_cents: Option<i64>,
    pub damage_notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegisterReturnDto {
    pub contract_id: String,
    pub items: Vec<ReturnItemInputDto>,
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

// ============================================================================
// PHOTOS D'ARTICLES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ArticlePhoto {
    pub id: String,
    pub article_id: String,
    pub mime: String,
    pub data: Vec<u8>,
    pub thumb: Vec<u8>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetArticlePhotoDto {
    pub article_id: String,
    pub mime: String,
    pub data_base64: String,
    pub thumb_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticlePhotoThumbDto {
    pub article_id: String,
    pub photo_id: String,
    pub mime: String,
    pub thumb_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArticlePhotoFullDto {
    pub photo_id: String,
    pub article_id: String,
    pub mime: String,
    pub data_base64: String,
}

// ============================================================================
// VENTES DIRECTES & SESSIONS DE CAISSE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectSalePaymentInput {
    pub method: String, // "especes", "carte_bancaire", "cheque", "virement", "autre"
    pub amount_paid_cents: i64,
    pub cash_received_cents: Option<i64>,
    pub change_returned_cents: Option<i64>,
    pub transaction_ref: Option<String>,
    pub cheque_number: Option<String>,
    pub bank_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectSaleCartItemInput {
    #[serde(default)]
    pub id: String,
    pub article_id: String,
    #[serde(default)]
    pub variant_id: Option<String>,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub reference: String,
    #[serde(default)]
    pub barcode: Option<String>,
    #[serde(default)]
    pub category_name: String,
    #[serde(default)]
    pub size: Option<String>,
    #[serde(default)]
    pub unit_price_cents: i64,
    #[serde(default = "default_item_quantity")]
    pub quantity: i64,
    #[serde(default)]
    pub subtotal_cents: i64,
    #[serde(default)]
    pub photo_url: Option<String>,
}

fn default_item_quantity() -> i64 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDirectSaleDto {
    pub customer_id: Option<String>,
    pub customer_name: Option<String>,
    pub customer_phone: Option<String>,
    pub user_id: String,
    pub items: Vec<DirectSaleCartItemInput>,
    pub payment: DirectSalePaymentInput,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectSaleDto {
    pub id: String,
    pub sale_number: String,
    pub customer_id: Option<String>,
    pub customer_name: String,
    pub customer_phone: Option<String>,
    pub user_id: String,
    pub user_name: String,
    pub total_amount_cents: i64,
    pub tax_rate: f64,
    pub tax_amount_cents: i64,
    pub payment: DirectSalePaymentInput,
    pub items: Vec<DirectSaleCartItemInput>,
    pub notes: Option<String>,
    pub receipt_pdf_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordPaymentDto {
    pub location_id: Option<String>,
    pub vente_id: Option<String>,
    pub utilisateur_id: String,
    pub montant_centimes: i64,
    pub type_paiement: String,
    pub moyen_paiement: String,
    pub reference_transaction: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCashSessionDto {
    pub utilisateur_id: String,
    pub initial_cash_float_cents: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloseCashSessionDto {
    pub session_id: Option<String>,
    pub utilisateur_id: String,
    pub counted_cash_cents: i64,
    pub operator_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CashSessionBreakdownMethod {
    pub total_cents: i64,
    pub transaction_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CashSessionBreakdown {
    pub especes: CashSessionBreakdownMethod,
    pub carte_bancaire: CashSessionBreakdownMethod,
    pub cheque: CashSessionBreakdownMethod,
    pub virement: CashSessionBreakdownMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashSessionDto {
    pub id: String,
    pub cloture_number: String,
    pub date: String,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub closed_by_user_id: Option<String>,
    pub closed_by_user_name: Option<String>,
    pub closed_by_role: Option<String>,
    pub status: String,
    pub initial_cash_float_cents: i64,
    pub sales_total_cents: i64,
    pub rentals_total_cents: i64,
    pub deposits_total_cents: i64,
    pub grand_total_cents: i64,
    pub breakdown: CashSessionBreakdown,
    pub theoretical_cash_cents: i64,
    pub counted_cash_cents: Option<i64>,
    pub discrepancy_cents: Option<i64>,
    pub operator_notes: Option<String>,
}

