import React, { useState } from "react";
import {
  X,
  DollarSign,
  Shirt,
  QrCode,
  Sparkles,
  AlertTriangle,
  History,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { formatCents } from "@/lib/utils";
import { useStockStore } from "@/store/stockStore";
import { getStatusConfig } from "./StockCard";
import type { StockVariant } from "@/types/stock";
import { toast } from "sonner";

export const ArticleDetailModal: React.FC = () => {
  const {
    isDetailModalOpen,
    setDetailModalOpen,
    selectedArticle,
    openQrLabelModal,
    changeVariantStatus,
    rentVariant,
    returnVariant,
  } = useStockStore();

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // État du modal de changement de statut
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [targetVariant, setTargetVariant] = useState<StockVariant | null>(null);
  const [newStatus, setNewStatus] = useState<StockVariant["status"]>("au_pressing");
  const [statusComment, setStatusComment] = useState("");

  if (!isDetailModalOpen || !selectedArticle) return null;

  const article = selectedArticle;

  const handleOpenStatusChange = (variant: StockVariant) => {
    setTargetVariant(variant);
    setNewStatus(variant.status === "disponible" ? "au_pressing" : "disponible");
    setStatusComment("");
    setIsStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusComment.trim()) {
      toast.error("Le commentaire est obligatoire pour justifier ce changement de statut.");
      return;
    }
    if (!targetVariant) return;

    changeVariantStatus(article.id, targetVariant.id, newStatus, statusComment.trim());
    toast.success(
      `Statut de la pièce ${targetVariant.barcode} mis à jour : ${newStatus} avec commentaire enregistré.`
    );
    setIsStatusDialogOpen(false);
  };

  // Simulation Décrémentation de stock (Location)
  const handleSimulateRent = () => {
    const dispoVariant = article.variants.find((v) => v.status === "disponible");
    if (!dispoVariant) {
      toast.error("Aucun exemplaire disponible en stock pour ce modèle !");
      return;
    }

    const dummyContract = `LOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const dummyCustomer = "Client Démo Simulation";

    rentVariant(
      article.id,
      dispoVariant.id,
      dummyContract,
      dummyCustomer,
      article.rental_price_cents
    );

    toast.success(
      `[SIMULATION DÉPART] Exemplaire T.${dispoVariant.size} (${dispoVariant.barcode}) loué ! Le stock disponible est décrémenté.`
    );
  };

  // Simulation Recrémentation de stock (Retour)
  const handleSimulateReturn = () => {
    const rentedVariant = article.variants.find((v) => v.status === "en_location");
    if (!rentedVariant) {
      toast.error("Aucun exemplaire actuellement loué pour ce modèle !");
      return;
    }

    returnVariant(article.id, rentedVariant.id, "excellent");

    toast.success(
      `[SIMULATION RETOUR] Exemplaire T.${rentedVariant.size} (${rentedVariant.barcode}) restitué ! Le stock disponible est recrémenté.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
              {article.reference}
            </span>
            <h3 className="font-bold text-sm text-foreground">{article.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openQrLabelModal(article)}
              className="p-1.5 rounded-lg bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border flex items-center gap-1.5 text-xs font-semibold"
            >
              <QrCode className="w-3.5 h-3.5 text-primary" />
              <span>Étiquette QR</span>
            </button>
            <button
              onClick={() => setDetailModalOpen(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Row : Photos + Key KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Colonne Galerie Photos */}
            <div className="space-y-3">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-muted border border-border">
                <img
                  src={article.photos[activePhotoIdx] || article.photos[0]}
                  alt="Aperçu"
                  className="w-full h-full object-cover"
                />
              </div>

              {article.photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {article.photos.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhotoIdx(i)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                        activePhotoIdx === i
                          ? "border-primary shadow-sm"
                          : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Colonne KPIs & Descriptif */}
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {/* KPI 1 : Total locations */}
                <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold">Total Locations</span>
                    <Shirt className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {article.times_rented_total}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Sur l'ensemble du cycle de vie
                  </p>
                </div>

                {/* KPI 2 : Revenu total généré */}
                <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold">Revenu Généré</span>
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-black text-foreground mt-1">
                    {formatCents(article.total_revenue_cents)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Tarif : {formatCents(article.rental_price_cents)} / contrat
                  </p>
                </div>

                {/* KPI 3 : Exemplaires & Disponibilité */}
                <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-semibold">Disponibilité</span>
                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-black text-foreground mt-1">
                    {
                      article.variants.filter((v) => v.status === "disponible")
                        .length
                    }{" "}
                    / {article.variants.length}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Exemplaires en boutique
                  </p>
                </div>
              </div>

              {/* Barre d'outils de test de décrémentation / recrémentation de stock */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Boutons de Test : Simulation Temps Réel des Mouvements de Stock
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimulateRent}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-secondary hover:bg-muted border border-border text-xs font-semibold flex items-center justify-center gap-1 text-amber-500"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Louer un article (Décrémenter)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateReturn}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-secondary hover:bg-muted border border-border text-xs font-semibold flex items-center justify-center gap-1 text-emerald-500"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Retourner un article (Recrémenter)</span>
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  <strong className="text-foreground">Maison :</strong> {article.brand} •{" "}
                  <strong className="text-foreground">Catégorie :</strong>{" "}
                  {article.category_name} •{" "}
                  <strong className="text-foreground">Couleur :</strong> {article.color}
                </p>
                <p>{article.description}</p>
                <p>
                  <strong className="text-foreground">Caution :</strong>{" "}
                  {formatCents(article.deposit_price_cents)} •{" "}
                  <strong className="text-foreground">Pressing :</strong>{" "}
                  {formatCents(article.cleaning_fee_cents)}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2 : Exemplaires & Gestion de Statut Unitaire */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              Exemplaires Physiques & Gestion des Statuts
            </h4>

            <div className="rounded-xl bg-card border border-border overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-4">Code-barre</th>
                    <th className="py-2.5 px-4">Taille / Coupe</th>
                    <th className="py-2.5 px-4">État d'usure</th>
                    <th className="py-2.5 px-4">Statut Actuel</th>
                    <th className="py-2.5 px-4">Locations</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {article.variants.map((v) => {
                    const stCfg = getStatusConfig(v.status);
                    return (
                      <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-semibold text-primary">
                          {v.barcode}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-foreground">
                          Taille {v.size}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({v.sub_size || "Standard"})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 capitalize text-muted-foreground">
                          {v.condition_state}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}
                          >
                            {stCfg.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-muted-foreground">
                          {v.times_rented} fois
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenStatusChange(v)}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Changer statut
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3 : Historique des Locations Passées */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Historique des Locations de ce Modèle
            </h4>

            {article.rental_history.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-4 rounded-lg bg-secondary/30 text-center">
                Aucune location enregistrée pour l'instant pour ce modèle.
              </p>
            ) : (
              <div className="space-y-2">
                {article.rental_history.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-xl bg-secondary/30 border border-border flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary">
                          {h.contract_number}
                        </span>
                        <span className="font-semibold text-foreground">
                          {h.customer_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted font-mono">
                          {h.variant_size}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Période : {h.pickup_date} au {h.return_date}
                        {h.notes && ` • ${h.notes}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-foreground">
                        {formatCents(h.amount_cents)}
                      </span>
                      {h.return_condition && (
                        <p className="text-[10px] text-emerald-500 font-semibold">
                          Retour : {h.return_condition}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end bg-muted/20">
          <button
            onClick={() => setDetailModalOpen(false)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border"
          >
            Fermer la Fiche
          </button>
        </div>
      </div>

      {/* SOUS-MODAL : Changement de Statut avec Commentaire OBLIGATOIRE */}
      {isStatusDialogOpen && targetVariant && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Changement de Statut ({targetVariant.barcode})
              </div>
              <button
                onClick={() => setIsStatusDialogOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Nouveau Statut
                </label>
                <select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as StockVariant["status"])
                  }
                  className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="disponible">Disponible (Remise en rayon)</option>
                  <option value="au_pressing">Nettoyage / Pressing</option>
                  <option value="en_retouche">Réparation / Atelier Retouche</option>
                  <option value="indisponible">Hors service (Indisponible)</option>
                  <option value="vendu">Rebut / Perte (Sorti de stock)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1">
                  <span>Commentaire obligatoire de justification *</span>
                  <span className="text-[10px] text-amber-500 font-normal">
                    Requis pour l'audit
                  </span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Motif détaillé : bouton décousu, tâche col, retour de pressing conforme..."
                  className="w-full p-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStatusDialogOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  Valider le Changement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
