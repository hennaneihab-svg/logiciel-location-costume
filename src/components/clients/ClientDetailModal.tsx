import React, { useRef, useState, useEffect } from "react";
import {
  X,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Upload,
  Calendar,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Star,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  MessageCircle,
  Ruler,
  History,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { formatCents } from "@/lib/utils";
import {
  useClientStore,
  getClientTotalSpentCents,
  getClientRentalsCount,
  isClientLoyal,
} from "@/store/clientStore";
import { toast } from "sonner";
import type { CustomerRentalStatus, ClientMensurations, CreateMensurationsDto } from "@/types/customer";
import { ouvrirWhatsApp } from "@/lib/whatsapp";
import { WHATSAPP_TEMPLATES } from "@/lib/whatsappTemplates";

export const ClientDetailModal: React.FC = () => {
  const {
    isDetailModalOpen,
    setDetailModalOpen,
    selectedClient,
    uploadIdentityCard,
    openBlacklistDialog,
    openBlacklistAlertForRental,
  } = useClientStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // MOD-2: État mensurations structurées & historique
  const [activeMensurations, setActiveMensurations] = useState<ClientMensurations | null>(null);
  const [mensurationsHistory, setMensurationsHistory] = useState<ClientMensurations[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isAddingMeasurement, setIsAddingMeasurement] = useState(false);

  // Formulaire d'ajout de prise de mesure
  const [mPoitrine, setMPoitrine] = useState("");
  const [mTaille, setMTaille] = useState("");
  const [mHanches, setMHanches] = useState("");
  const [mStature, setMStature] = useState("");
  const [mBras, setMBras] = useState("");
  const [mJambe, setMJambe] = useState("");
  const [mCou, setMCou] = useState("");
  const [mPointure, setMPointure] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [isSavingM, setIsSavingM] = useState(false);

  const loadMensurations = async (clientId: string) => {
    try {
      const active = await invoke<ClientMensurations | null>("get_client_mensurations_active", { clientId });
      setActiveMensurations(active);
      const hist = await invoke<ClientMensurations[]>("get_client_mensurations_history", { clientId });
      setMensurationsHistory(hist);
    } catch (err) {
      console.warn("Mensurations non disponibles via Tauri :", err);
    }
  };

  useEffect(() => {
    if (selectedClient?.id) {
      loadMensurations(selectedClient.id);
      setIsAddingMeasurement(false);
      setShowHistory(false);
    }
  }, [selectedClient?.id]);


  if (!isDetailModalOpen || !selectedClient) return null;

  const client = selectedClient;
  const totalSpentCents = getClientTotalSpentCents(client);
  const rentalsCount = getClientRentalsCount(client);
  const loyal = isClientLoyal(client);

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Le fichier ne doit pas dépasser 5 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        uploadIdentityCard(client.id, reader.result as string);
        toast.success("Pièce d'identité mise à jour avec succès.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNewRentalClick = () => {
    if (client.is_blacklisted) {
      openBlacklistAlertForRental(client);
    } else {
      toast.info(
        `Préparation d'un contrat de location pour ${client.first_name} ${client.last_name}...`
      );
    }
  };

  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.id) return;
    setIsSavingM(true);
    try {
      await invoke("create_client_mensurations", {
        clientId: client.id,
        dto: {
          tour_poitrine: mPoitrine ? parseFloat(mPoitrine) : null,
          tour_taille: mTaille ? parseFloat(mTaille) : null,
          tour_hanches: mHanches ? parseFloat(mHanches) : null,
          stature: mStature ? parseFloat(mStature) : null,
          longueur_bras: mBras ? parseFloat(mBras) : null,
          longueur_jambe: mJambe ? parseFloat(mJambe) : null,
          tour_cou: mCou ? parseFloat(mCou) : null,
          pointure: mPointure ? parseFloat(mPointure) : null,
          notes_mensurations: mNotes.trim() || null,
        },
      });
      toast.success("Nouvelles mensurations enregistrées avec succès !");
      setIsAddingMeasurement(false);
      setMPoitrine("");
      setMTaille("");
      setMHanches("");
      setMStature("");
      setMBras("");
      setMJambe("");
      setMCou("");
      setMPointure("");
      setMNotes("");
      loadMensurations(client.id);
    } catch (err: any) {
      toast.error(err?.toString() || "Erreur lors de l'enregistrement");
    } finally {
      setIsSavingM(false);
    }
  };

  const getStatusBadge = (status: CustomerRentalStatus) => {

    switch (status) {
      case "en_cours":
        return {
          label: "En cours",
          className: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
          icon: Clock,
        };
      case "retourne":
        return {
          label: "Restitué conforme",
          className:
            "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
          icon: CheckCircle2,
        };
      case "reserve":
        return {
          label: "Réservé",
          className: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
          icon: Calendar,
        };
      case "en_retard":
        return {
          label: "En retard",
          className: "bg-red-500/15 text-red-500 border border-red-500/30",
          icon: AlertTriangle,
        };
      case "litige":
        return {
          label: "En litige",
          className: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
          icon: ShieldAlert,
        };
      default:
        return {
          label: status,
          className: "bg-muted text-muted-foreground",
          icon: Clock,
        };
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setDetailModalOpen(false);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Fiche Client */}
        <div className="h-16 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-black text-sm">
              {client.first_name[0]}
              {client.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">
                  {client.first_name} {client.last_name}
                </h3>

                {/* Badge Client Fidèle (> 5 locations) */}
                {loyal && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-sm animate-pulse">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>Client fidèle</span>
                  </span>
                )}

                {/* Badge Liste Noire */}
                {client.is_blacklisted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-500/20 text-red-500 border border-red-500/40 shadow-sm">
                    <ShieldAlert className="w-3 h-3 text-red-500" />
                    <span>Liste Noire</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Client n° {client.id} • Inscrit le{" "}
                {new Date(client.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewRentalClick}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all ${
                client.is_blacklisted
                  ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer Location</span>
            </button>

            <button
              onClick={() => setDetailModalOpen(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps Fiche Client */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Alerte si le client est en Liste Noire */}
          {client.is_blacklisted && (
            <div className="p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30 space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-red-500 font-bold text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span>CLIENT EN LISTE NOIRE : Vente & Location Restreintes</span>
                </div>
                <button
                  onClick={() => openBlacklistDialog(client)}
                  className="underline hover:text-red-400 font-semibold"
                >
                  Modifier le statut
                </button>
              </div>
              <p className="text-xs text-foreground/90 font-medium italic bg-background/50 p-2.5 rounded-lg border border-red-500/20">
                "{client.blacklist_reason}"
              </p>
              {client.blacklist_date && (
                <p className="text-[10px] text-muted-foreground text-right">
                  Signalé le {new Date(client.blacklist_date).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
          )}

          {/* Section 1 : KPIs Synthèse Financière & Fidélité */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Total Dépensé</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {formatCents(totalSpentCents)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Sur {rentalsCount} contrat(s) au total
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Nombre de Locations</span>
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {rentalsCount}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {loyal
                  ? "Statut Client Fidèle actif (> 5)"
                  : `${5 - rentalsCount} location(s) avant statut Fidèle`}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold">Statut Sécurité</span>
                {client.is_blacklisted ? (
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
              </div>
              <div
                className={`text-xl font-bold mt-1 ${
                  client.is_blacklisted ? "text-red-500" : "text-emerald-500"
                }`}
              >
                {client.is_blacklisted ? "Liste Noire Active" : "Dossier Conforme"}
              </div>
              <button
                type="button"
                onClick={() => openBlacklistDialog(client)}
                className="text-[11px] font-semibold text-primary hover:underline block mt-0.5"
              >
                {client.is_blacklisted
                  ? "Débloquer le client"
                  : "Basculer en Liste Noire"}
              </button>
            </div>
          </div>

          {/* Section 2 : Deux Colonnes : Coordonnées & Pièce d'Identité */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Colonne Coordonnées */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                Coordonnées & Domiciliation
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Phone className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground font-mono font-bold">
                      {client.phone}
                    </span>
                    {client.alternative_phone && (
                      <span className="text-[11px] text-muted-foreground">
                        (Alt : {client.alternative_phone})
                      </span>
                    )}
                  </div>

                  {/* Bouton contacter sur WhatsApp */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!client.phone) {
                        toast.error("Aucun numéro de téléphone pour ce client.");
                        return;
                      }
                      const greeting = WHATSAPP_TEMPLATES.CONTACT_LIBRE(client.first_name);
                      const res = await ouvrirWhatsApp(client.phone, greeting);
                      if (res.success) {
                        toast.success(`Discussion WhatsApp ouverte pour ${client.first_name} ${client.last_name}`);
                      } else {
                        toast.error(res.error || "Impossible d'ouvrir WhatsApp");
                      }
                    }}
                    disabled={!client.phone}
                    title={
                      client.phone
                        ? "Ouvrir une conversation WhatsApp avec ce client"
                        : "Aucun numéro de téléphone pour ce client"
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-xs ${
                      client.phone
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                        : "opacity-40 cursor-not-allowed bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Contacter sur WhatsApp</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-foreground truncate">
                    {client.email || "Aucune adresse e-mail"}
                  </span>
                </div>

                <div className="flex items-start gap-2.5 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">
                      {client.address || "Adresse non précisée"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {client.postal_code} {client.city}
                    </p>
                  </div>
                </div>

                {client.notes && (
                  <div className="pt-2 border-t border-border mt-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
                      Mensurations & Préférences Sartoriales :
                    </span>
                    <p className="text-[11px] text-foreground/90 bg-secondary/40 p-2.5 rounded-lg border border-border">
                      {client.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Colonne Pièce d'identité avec Upload */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pièce d'Identité (Garantie)</span>
                  </h4>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUploadPhoto}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{client.identity_card_photo ? "Remplacer" : "Téléverser"}</span>
                  </button>
                </div>

                <div className="p-2.5 rounded-lg bg-secondary/30 border border-border text-xs mb-3 font-mono">
                  <span className="text-[10px] text-muted-foreground block font-sans">
                    Numéro de document :
                  </span>
                  <span className="font-bold text-foreground">
                    {client.identity_card_number || "Non renseigné"}
                  </span>
                </div>

                {/* Aperçu de la photo de CNI / Passeport */}
                <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-muted/60 border border-border flex items-center justify-center group">
                  {client.identity_card_photo ? (
                    <img
                      src={client.identity_card_photo}
                      alt="Pièce d'identité"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <CreditCard className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                      <p className="text-xs text-muted-foreground">
                        Aucune photo de pièce d'identité enregistrée.
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-xs font-semibold text-primary border border-border inline-flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Téléverser la pièce d'identité</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2.5 : Mensurations & Profil Atelier (MOD-2) */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-status-reserved-bg text-status-reserved border border-status-reserved-border flex items-center justify-center">
                  <Ruler className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                    Mensurations & Profil Atelier
                  </h4>
                  {activeMensurations && (
                    <span className="text-[10px] text-muted-foreground">
                      Dernière prise de mesure : {activeMensurations.date_mesure}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {mensurationsHistory.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted text-[11px] font-medium text-foreground border border-border flex items-center gap-1 transition-colors"
                  >
                    <History className="w-3 h-3 text-muted-foreground" />
                    <span>{showHistory ? "Masquer historique" : `Historique (${mensurationsHistory.length})`}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsAddingMeasurement(!isAddingMeasurement)}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isAddingMeasurement ? "Annuler" : "Nouvelle mesure"}</span>
                </button>
              </div>
            </div>

            {/* Formulaire nouvelle prise de mesure */}
            {isAddingMeasurement && (
              <form onSubmit={handleSaveMeasurement} className="p-3.5 rounded-xl bg-secondary/30 border border-border space-y-3 animate-in fade-in">
                <span className="text-xs font-semibold text-foreground block">
                  Enregistrer un nouveau relevé de mesures (en cm)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Poitrine (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={mPoitrine}
                      onChange={(e) => setMPoitrine(e.target.value)}
                      placeholder="88"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Taille (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={mTaille}
                      onChange={(e) => setMTaille(e.target.value)}
                      placeholder="68"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Hanches (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={mHanches}
                      onChange={(e) => setMHanches(e.target.value)}
                      placeholder="94"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Stature (cm)</label>
                    <input
                      type="number"
                      step="1"
                      value={mStature}
                      onChange={(e) => setMStature(e.target.value)}
                      placeholder="172"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Bras (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={mBras}
                      onChange={(e) => setMBras(e.target.value)}
                      placeholder="60"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Jambe (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={mJambe}
                      onChange={(e) => setMJambe(e.target.value)}
                      placeholder="102"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Cou (cm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={mCou}
                      onChange={(e) => setMCou(e.target.value)}
                      placeholder="36"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Pointure</label>
                    <input
                      type="number"
                      step="0.5"
                      value={mPointure}
                      onChange={(e) => setMPointure(e.target.value)}
                      placeholder="38.5"
                      className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Observations atelier</label>
                  <input
                    type="text"
                    value={mNotes}
                    onChange={(e) => setMNotes(e.target.value)}
                    placeholder="Remarques retouche, cambrure, posture..."
                    className="w-full h-7 px-2 rounded-md bg-card border border-border text-xs text-foreground"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingMeasurement(false)}
                    className="px-3 py-1 rounded-md text-xs border border-border hover:bg-secondary"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingM}
                    className="px-3 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSavingM ? "Enregistrement..." : "Sauvegarder"}
                  </button>
                </div>
              </form>
            )}

            {/* Affichage des mensurations actives */}
            {activeMensurations ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Poitrine</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.tour_poitrine ? `${activeMensurations.tour_poitrine} cm` : "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Taille</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.tour_taille ? `${activeMensurations.tour_taille} cm` : "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Hanches</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.tour_hanches ? `${activeMensurations.tour_hanches} cm` : "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Stature</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.stature ? `${activeMensurations.stature} cm` : "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Longueur bras</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.longueur_bras ? `${activeMensurations.longueur_bras} cm` : "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Longueur jambe</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.longueur_jambe ? `${activeMensurations.longueur_jambe} cm` : "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Tour de cou</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.tour_cou ? `${activeMensurations.tour_cou} cm` : "—"}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/40 border border-border">
                    <span className="text-[10px] text-muted-foreground block">Pointure</span>
                    <span className="font-bold text-foreground">
                      {activeMensurations.pointure ?? "—"}
                    </span>
                  </div>
                </div>

                {activeMensurations.notes_mensurations && (
                  <p className="text-[11px] text-muted-foreground italic bg-secondary/20 p-2 rounded-md border border-border/50">
                    Observation : {activeMensurations.notes_mensurations}
                  </p>
                )}
              </div>
            ) : (
              !isAddingMeasurement && (
                <div className="p-4 rounded-lg bg-secondary/20 border border-dashed border-border text-center text-xs text-muted-foreground">
                  Aucune mensuration structurée enregistrée pour cette cliente.
                </div>
              )
            )}

            {/* Tableau d'historique des anciennes prises de mesure */}
            {showHistory && mensurationsHistory.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                <span className="text-[11px] font-bold text-foreground block">
                  Historique des relevés précédents :
                </span>
                <div className="divide-y divide-border/60 max-h-36 overflow-y-auto rounded-lg border border-border text-[11px]">
                  {mensurationsHistory.map((h) => (
                    <div key={h.id} className="p-2 flex items-center justify-between hover:bg-secondary/30">
                      <div>
                        <span className="font-semibold text-foreground mr-2">{h.date_mesure}</span>
                        <span className="text-muted-foreground">
                          Poitrine: {h.tour_poitrine || "—"} • Taille: {h.tour_taille || "—"} • Hanches: {h.tour_hanches || "—"} • Stature: {h.stature || "—"}
                        </span>
                      </div>
                      {h.est_actuel === 1 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-status-completed-bg text-status-completed font-bold">
                          Actuel
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>


          {/* Section 3 : Historique Complet des Locations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Historique Complet des Locations ({client.rentals.length})</span>
            </h4>

            {client.rentals.length === 0 ? (
              <div className="p-8 rounded-xl bg-secondary/20 border border-border text-center text-xs text-muted-foreground">
                Ce client n'a pas encore effectué de location.
              </div>
            ) : (
              <div className="space-y-2.5">
                {client.rentals.map((rental) => {
                  const badge = getStatusBadge(rental.status);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={rental.id}
                      className="p-3.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">
                            {rental.contract_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${badge.className}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>
                        </div>
                        <p className="font-semibold text-foreground text-xs">
                          {rental.articles_summary}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Retrait : {rental.pickup_date} • Retour : {rental.return_date}
                          {rental.notes && ` • ${rental.notes}`}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-foreground block">
                          {formatCents(rental.total_amount_cents)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Caution : {formatCents(rental.deposit_amount_cents)} (
                          {rental.deposit_status})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
          <button
            type="button"
            onClick={() => openBlacklistDialog(client)}
            className={`text-xs font-semibold hover:underline flex items-center gap-1.5 ${
              client.is_blacklisted ? "text-emerald-500" : "text-red-500"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {client.is_blacklisted
                ? "Retirer de la liste noire"
                : "Mettre en liste noire"}
            </span>
          </button>

          <button
            onClick={() => setDetailModalOpen(false)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border"
          >
            Fermer la Fiche
          </button>
        </div>
      </div>
    </div>
  );
};
