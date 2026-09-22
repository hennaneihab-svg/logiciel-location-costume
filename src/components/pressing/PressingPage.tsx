import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePressingStore } from "@/store/pressingStore";
import { formatDA } from "@/lib/utils";
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  Check,
  AlertTriangle,
  CreditCard,
  Building2,
  Clock,
  Camera,
  X,
} from "lucide-react";
import { NewPressingDispatchModal } from "./NewPressingDispatchModal";
import type { PressingDispatch } from "@/types/pressing";

export const PressingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const {
    dispatches,
    providers,
    isLoading,
    loadDispatches,
    loadProviders,
    receiveDispatch,
    markProblem,
    cancelDispatch,
    payProvider,
    getDispatchPhotoFull,
    setDispatchPhoto,
  } = usePressingStore();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") === "en_cours" ? "en_cours" : "all"
  );
  const [providerFilter, setProviderFilter] = useState<string>("all");

  useEffect(() => {
    const q = searchParams.get("search");
    if (q !== null) setSearchQuery(q);
    const s = searchParams.get("status");
    if (s === "en_cours") setStatusFilter("en_cours");
  }, [searchParams]);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [receiveModalDispatch, setReceiveModalDispatch] = useState<PressingDispatch | null>(null);
  const [problemModalDispatch, setProblemModalDispatch] = useState<PressingDispatch | null>(null);
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);

  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [problemNotes, setProblemNotes] = useState("");

  useEffect(() => {
    loadDispatches();
    loadProviders(false);
  }, [loadDispatches, loadProviders]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Calcul des KPIs
  const kpis = useMemo(() => {
    let enCours = 0;
    let enRetard = 0;
    let coutTotal = 0;

    for (const d of dispatches) {
      if (d.statut === "envoye" || d.statut === "en_traitement") {
        enCours++;
        if (d.date_retour_prevue < today) {
          enRetard++;
        }
      }
      if (d.statut !== "annule") {
        coutTotal += d.cout_centimes;
      }
    }

    return { enCours, enRetard, coutTotal };
  }, [dispatches, today]);

  // Filtrage des envois
  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      if (statusFilter !== "all" && d.statut !== statusFilter) return false;
      if (providerFilter !== "all") {
        if (providerFilter === "interne" && d.prestataire_id !== null) return false;
        if (providerFilter !== "interne" && d.prestataire_id !== providerFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          d.numero_envoi.toLowerCase().includes(q) ||
          d.article_name.toLowerCase().includes(q) ||
          d.reference.toLowerCase().includes(q) ||
          (d.prestataire_nom && d.prestataire_nom.toLowerCase().includes(q)) ||
          (d.notes && d.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [dispatches, statusFilter, providerFilter, searchQuery]);

  const handleOpenReceive = (d: PressingDispatch) => {
    setReceiveModalDispatch(d);
    setReceiveDate(today);
    setReceiveNotes("");
  };

  const handleConfirmReceive = async () => {
    if (!receiveModalDispatch) return;
    await receiveDispatch(receiveModalDispatch.id, receiveDate, receiveNotes.trim() || undefined);
    setReceiveModalDispatch(null);
  };

  const handleOpenProblem = (d: PressingDispatch) => {
    setProblemModalDispatch(d);
    setProblemNotes("");
  };

  const handleConfirmProblem = async () => {
    if (!problemModalDispatch) return;
    await markProblem(problemModalDispatch.id, problemNotes.trim() || undefined);
    setProblemModalDispatch(null);
  };

  const handleViewPhoto = async (d: PressingDispatch) => {
    const full = await getDispatchPhotoFull(d.id);
    if (full) {
      setPhotoViewerUrl(`data:image/webp;base64,${full}`);
    }
  };

  const handleUploadPhoto = async (envoiId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      if (base64) {
        await setDispatchPhoto(envoiId, base64, base64, file.type);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* En-tête Page */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-500" />
            <span>Gestion du Pressing & Atelier</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suivi des nettoyages, retouches et entretiens de pièces en interne ou chez vos prestataires.
          </p>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvel envoi pressing</span>
        </button>
      </div>

      {/* Cartes KPIs Papra */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium">Pièces en cours de traitement</span>
            <div className="text-2xl font-bold text-foreground mt-1">{kpis.enCours}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium">Retards de retour constatés</span>
            <div className={`text-2xl font-bold mt-1 ${kpis.enRetard > 0 ? "text-rose-500" : "text-foreground"}`}>
              {kpis.enRetard}
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              kpis.enRetard > 0 ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-medium">Coût global des prestations</span>
            <div className="text-2xl font-bold text-foreground mt-1">{formatDA(kpis.coutTotal)}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-muted text-foreground flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="p-3.5 rounded-xl border border-border bg-card shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par n° envoi, article, référence..."
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span>Statut :</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            <option value="all">Tous les statuts</option>
            <option value="envoye">Envoyé</option>
            <option value="en_traitement">En traitement</option>
            <option value="recu">Reçu</option>
            <option value="probleme">Problème</option>
            <option value="annule">Annulé</option>
          </select>

          <div className="flex items-center gap-1.5 text-muted-foreground ml-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Prestataire :</span>
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            <option value="all">Tous les prestataires</option>
            <option value="interne">Traitement interne</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau des envois */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-4">N° Envoi</th>
                <th className="py-3 px-4">Article & Taille</th>
                <th className="py-3 px-4">Prestataire / Type</th>
                <th className="py-3 px-4">Dates (Envoi / Prévue)</th>
                <th className="py-3 px-4">Coût & Règlement</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDispatches.map((d) => {
                const isOverdue =
                  (d.statut === "envoye" || d.statut === "en_traitement") &&
                  d.date_retour_prevue < today;

                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    {/* N° Envoi */}
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{d.numero_envoi}</span>
                        {d.has_photo && (
                          <button
                            onClick={() => handleViewPhoto(d)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Voir photo constat"
                          >
                            <Camera className="w-3.5 h-3.5 text-sky-500" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Article & Taille */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{d.article_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Taille : {d.size} | Réf : {d.reference}
                      </div>
                    </td>

                    {/* Prestataire */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">
                        {d.prestataire_nom || "Atelier interne"}
                      </div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {d.type_traitement?.replace("_", " ") || "Standard"} — {d.motif?.replace("_", " ")}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="py-3 px-4">
                      <div className="text-foreground">{d.date_envoi}</div>
                      <div
                        className={`text-[11px] font-medium flex items-center gap-1 mt-0.5 ${
                          isOverdue ? "text-rose-500 font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {isOverdue && <AlertTriangle className="w-3 h-3 shrink-0" />}
                        <span>Retour prévu : {d.date_retour_prevue}</span>
                      </div>
                      {d.date_retour_effective && (
                        <div className="text-[10px] text-emerald-600 font-medium">
                          Reçu le : {d.date_retour_effective}
                        </div>
                      )}
                    </td>

                    {/* Coût & Règlement */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{formatDA(d.cout_centimes)}</div>
                      {d.prestataire_id && (
                        <div className="mt-0.5">
                          {d.statut_paiement_prestataire === "paye" ? (
                            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Réglé
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> À payer
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Statut */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                          d.statut === "envoye"
                            ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                            : d.statut === "recu"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : d.statut === "probleme"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                            : d.statut === "annule"
                            ? "bg-muted text-muted-foreground border border-border"
                            : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                        }`}
                      >
                        {d.statut === "envoye" && "Envoyé"}
                        {d.statut === "en_traitement" && "En cours"}
                        {d.statut === "recu" && "Reçu"}
                        {d.statut === "probleme" && "Problème"}
                        {d.statut === "annule" && "Annulé"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Bouton Réceptionner */}
                        {(d.statut === "envoye" || d.statut === "en_traitement" || d.statut === "probleme") && (
                          <button
                            onClick={() => handleOpenReceive(d)}
                            className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[11px] font-medium transition-colors"
                            title="Réceptionner la pièce"
                          >
                            Réceptionner
                          </button>
                        )}

                        {/* Bouton Signaler Problème */}
                        {(d.statut === "envoye" || d.statut === "en_traitement") && (
                          <button
                            onClick={() => handleOpenProblem(d)}
                            className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-[11px] font-medium transition-colors"
                            title="Signaler une anomalie"
                          >
                            Problème
                          </button>
                        )}

                        {/* Bouton Annuler */}
                        {d.statut === "envoye" && (
                          <button
                            onClick={() => cancelDispatch(d.id)}
                            className="px-2 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-medium transition-colors"
                            title="Annuler l'envoi"
                          >
                            Annuler
                          </button>
                        )}

                        {/* Bouton Marquer Payé */}
                        {d.prestataire_id && d.statut_paiement_prestataire === "a_payer" && (
                          <button
                            onClick={() => payProvider(d.id)}
                            className="px-2 py-1 rounded bg-foreground text-background hover:bg-foreground/90 text-[11px] font-medium transition-colors"
                            title="Marquer le prestataire comme payé"
                          >
                            Payer
                          </button>
                        )}

                        {/* Ajout de photo */}
                        <label className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer">
                          <Camera className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleUploadPhoto(d.id, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                    Chargement des envois en cours...
                  </td>
                </tr>
              )}
              {!isLoading && filteredDispatches.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                    Aucun envoi au pressing ne correspond aux critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Réception */}
      {receiveModalDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <span className="font-semibold text-sm text-foreground">
                Réception de la pièce — {receiveModalDispatch.numero_envoi}
              </span>
              <button
                onClick={() => setReceiveModalDispatch(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/60">
                <div className="font-semibold text-foreground">{receiveModalDispatch.article_name}</div>
                <div className="text-muted-foreground text-[11px]">
                  Taille : {receiveModalDispatch.size} | Réf : {receiveModalDispatch.reference}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Date de retour effective *</label>
                <input
                  type="date"
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Contrôle qualité & Notes de retour</label>
                <textarea
                  rows={3}
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="État constaté après nettoyage, propreté, pressing impeccable..."
                  className="w-full p-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setReceiveModalDispatch(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-foreground text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceive}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium"
                >
                  Valider la réception
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Signalement Problème */}
      {problemModalDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Signaler un problème — {problemModalDispatch.numero_envoi}</span>
              </span>
              <button
                onClick={() => setProblemModalDispatch(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400">
                <p className="font-medium">
                  Attention : cette action marquera la pièce comme « indisponible » en stock pour
                  empêcher toute nouvelle location.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Description de l'anomalie *</label>
                <textarea
                  rows={3}
                  required
                  value={problemNotes}
                  onChange={(e) => setProblemNotes(e.target.value)}
                  placeholder="Détérioration au lavage, décoloration, perte, bouton arraché..."
                  className="w-full p-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setProblemModalDispatch(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-foreground text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirmProblem}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium"
                >
                  Confirmer le blocage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visionneuse Photo */}
      {photoViewerUrl && (
        <div
          onClick={() => setPhotoViewerUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-card rounded-2xl overflow-hidden border border-border p-2">
            <button
              onClick={() => setPhotoViewerUrl(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={photoViewerUrl} alt="Constat pressing" className="max-h-[80vh] w-auto object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* Modale Nouvel Envoi */}
      <NewPressingDispatchModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => loadDispatches()}
      />
    </div>
  );
};
