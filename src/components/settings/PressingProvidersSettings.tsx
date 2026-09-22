import React, { useState, useEffect } from "react";
import { usePressingStore } from "@/store/pressingStore";
import { formatDA } from "@/lib/utils";
import {
  Plus,
  Edit2,
  Building2,
  Clock,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
} from "lucide-react";
import type { PressingProvider, CreatePressingProviderInput } from "@/types/pressing";

export const PressingProvidersSettings: React.FC = () => {
  const {
    providers,
    isModuleActive,
    loadProviders,
    loadModuleActive,
    setModuleActive,
    createProvider,
    updateProvider,
    deactivateProvider,
    reactivateProvider,
  } = usePressingStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<PressingProvider | null>(null);

  const [formNom, setFormNom] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formTel, setFormTel] = useState("");
  const [formAdresse, setFormAdresse] = useState("");
  const [formTarifDA, setFormTarifDA] = useState("");
  const [formDelai, setFormDelai] = useState("3");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    loadModuleActive();
    loadProviders(false);
  }, [loadModuleActive, loadProviders]);

  const openCreateModal = () => {
    setEditingProvider(null);
    setFormNom("");
    setFormContact("");
    setFormTel("");
    setFormAdresse("");
    setFormTarifDA("");
    setFormDelai("3");
    setFormNotes("");
    setModalOpen(true);
  };

  const openEditModal = (p: PressingProvider) => {
    setEditingProvider(p);
    setFormNom(p.nom);
    setFormContact(p.contact_nom || "");
    setFormTel(p.telephone || "");
    setFormAdresse(p.adresse || "");
    setFormTarifDA(p.tarif_defaut_centimes ? String(p.tarif_defaut_centimes) : "");
    setFormDelai(String(p.delai_defaut_jours));
    setFormNotes(p.notes || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNom.trim()) return;

    const tarifCentimes = formTarifDA ? parseInt(formTarifDA, 10) : undefined;
    const delaiJours = parseInt(formDelai, 10) || 3;

    if (editingProvider) {
      await updateProvider({
        id: editingProvider.id,
        nom: formNom.trim(),
        contact_nom: formContact.trim() || undefined,
        telephone: formTel.trim() || undefined,
        adresse: formAdresse.trim() || undefined,
        tarif_defaut_centimes: tarifCentimes,
        delai_defaut_jours: delaiJours,
        notes: formNotes.trim() || undefined,
      });
    } else {
      const input: CreatePressingProviderInput = {
        nom: formNom.trim(),
        contact_nom: formContact.trim() || undefined,
        telephone: formTel.trim() || undefined,
        adresse: formAdresse.trim() || undefined,
        tarif_defaut_centimes: tarifCentimes,
        delai_defaut_jours: delaiJours,
        notes: formNotes.trim() || undefined,
      };
      await createProvider(input);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Activation générale du module */}
      <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground text-sm">Activation du Module Pressing</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Désactivez ce module si votre boutique n'a pas recours aux services de pressing ou d'atelier.
          </p>
        </div>
        <button
          onClick={() => setModuleActive(!isModuleActive)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium transition-colors"
        >
          {isModuleActive ? (
            <>
              <ToggleRight className="w-5 h-5 text-emerald-500" />
              <span className="text-foreground">Module Activé</span>
            </>
          ) : (
            <>
              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
              <span className="text-muted-foreground">Module Désactivé</span>
            </>
          )}
        </button>
      </div>

      {/* En-tête Prestataires */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground text-sm">Prestataires de Pressing Partenaires</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurez vos prestataires externes (ou votre atelier interne) avec leurs délais et tarifs habituels.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter un prestataire</span>
        </button>
      </div>

      {/* Liste des Prestataires */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {providers.map((p) => (
          <div
            key={p.id}
            className={`p-4 rounded-xl border ${
              p.actif ? "border-border bg-card" : "border-border/60 bg-muted/20 opacity-70"
            } flex flex-col justify-between space-y-3 transition-colors`}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{p.nom}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        p.actif
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {p.actif ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5" /> Actif
                        </>
                      ) : (
                        <>
                          <XCircle className="w-2.5 h-2.5" /> Désactivé
                        </>
                      )}
                    </span>
                  </div>
                  {p.contact_nom && (
                    <p className="text-xs text-muted-foreground mt-0.5">Contact : {p.contact_nom}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(p)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Modifier"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {p.actif ? (
                    <button
                      onClick={() => deactivateProvider(p.id)}
                      className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Désactiver
                    </button>
                  ) : (
                    <button
                      onClick={() => reactivateProvider(p.id)}
                      className="px-2 py-1 rounded text-[11px] text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                    >
                      Réactiver
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Délai standard : {p.delai_defaut_jours} j</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Tarif réf. : {p.tarif_defaut_centimes ? formatDA(p.tarif_defaut_centimes) : "Variable"}</span>
                </div>
                {p.telephone && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{p.telephone}</span>
                  </div>
                )}
                {p.adresse && (
                  <div className="flex items-center gap-1.5 col-span-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{p.adresse}</span>
                  </div>
                )}
              </div>
            </div>

            {p.notes && (
              <p className="text-[11px] text-muted-foreground/80 italic border-t border-border/40 pt-1.5 line-clamp-2">
                « {p.notes} »
              </p>
            )}
          </div>
        ))}

        {providers.length === 0 && (
          <div className="col-span-full p-8 text-center rounded-xl border border-dashed border-border bg-card/50">
            <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Aucun prestataire de pressing configuré.</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Ajoutez vos prestataires externes ou configurez votre atelier interne.
            </p>
          </div>
        )}
      </div>

      {/* Modal Création / Modification */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
              <span className="font-semibold text-sm text-foreground">
                {editingProvider ? "Modifier le prestataire" : "Nouveau prestataire de pressing"}
              </span>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Nom de l'établissement / atelier *</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  placeholder="Ex : Pressing Étoile, Teinturerie Centrale..."
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">Personne de contact</label>
                  <input
                    type="text"
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="Nom du responsable"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">Téléphone</label>
                  <input
                    type="text"
                    value={formTel}
                    onChange={(e) => setFormTel(e.target.value)}
                    placeholder="05 50 ..."
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Adresse physique</label>
                <input
                  type="text"
                  value={formAdresse}
                  onChange={(e) => setFormAdresse(e.target.value)}
                  placeholder="Adresse ou quartier"
                  className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">Délai habituel (jours) *</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={formDelai}
                    onChange={(e) => setFormDelai(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-medium text-foreground">Tarif standard (DA)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formTarifDA}
                    onChange={(e) => setFormTarifDA(e.target.value)}
                    placeholder="Optionnel"
                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Notes / Spécialités</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Horaires, spécialités (soie, smoking, détachement complexe)..."
                  className="w-full p-2.5 rounded-lg bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-foreground text-xs font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
