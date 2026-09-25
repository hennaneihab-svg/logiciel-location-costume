import React, { useState, useRef } from "react";
import { X, UserPlus, Upload, Trash2, CreditCard, Ruler } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useClientStore } from "@/store/clientStore";
import { toast } from "sonner";
import type { CustomerDetailed } from "@/types/customer";

interface QuickCreateClientModalProps {
  onSuccess?: (createdClient: CustomerDetailed) => void;
}

export const QuickCreateClientModal: React.FC<QuickCreateClientModalProps> = ({
  onSuccess,
}) => {
  const { isCreateModalOpen, setCreateModalOpen, addClient } = useClientStore();

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [alternativePhone, setAlternativePhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Paris");
  const [postalCode, setPostalCode] = useState("75008");
  const [address, setAddress] = useState("");
  const [identityCardNumber, setIdentityCardNumber] = useState("");
  const [identityCardPhoto, setIdentityCardPhoto] = useState<string | undefined>(
    undefined
  );
  const [notes, setNotes] = useState("");

  // MOD-2 : Mensurations structurées
  const [tourPoitrine, setTourPoitrine] = useState("");
  const [tourTaille, setTourTaille] = useState("");
  const [tourHanches, setTourHanches] = useState("");
  const [stature, setStature] = useState("");
  const [longueurBras, setLongueurBras] = useState("");
  const [longueurJambe, setLongueurJambe] = useState("");
  const [tourCou, setTourCou] = useState("");
  const [pointure, setPointure] = useState("");


  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isCreateModalOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Le fichier ne doit pas dépasser 5 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setIdentityCardPhoto(reader.result as string);
        toast.success("Photo de pièce d'identité chargée.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetForm = () => {
    setLastName("");
    setFirstName("");
    setPhone("");
    setAlternativePhone("");
    setEmail("");
    setCity("Paris");
    setPostalCode("75008");
    setAddress("");
    setIdentityCardNumber("");
    setIdentityCardPhoto(undefined);
    setNotes("");
    setTourPoitrine("");
    setTourTaille("");
    setTourHanches("");
    setStature("");
    setLongueurBras("");
    setLongueurJambe("");
    setTourCou("");
    setPointure("");
  };

  const handleClose = () => {
    handleResetForm();
    setCreateModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!lastName.trim() || !firstName.trim()) {
      toast.error("Le nom et le prénom sont obligatoires.");
      return;
    }

    if (!phone.trim()) {
      toast.error("Le numéro de téléphone est obligatoire pour la garantie.");
      return;
    }

    const created = addClient({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      alternative_phone: alternativePhone.trim() || undefined,
      email: email.trim(),
      city: city.trim() || "Paris",
      postal_code: postalCode.trim() || "75000",
      address: address.trim(),
      identity_card_number: identityCardNumber.trim(),
      identity_card_photo: identityCardPhoto,
      notes: notes.trim(),
      is_blacklisted: false,
    });

    // Sauvegarde structurée des mensurations si au moins une valeur est saisie
    const hasMeasurements =
      tourPoitrine || tourTaille || tourHanches || stature ||
      longueurBras || longueurJambe || tourCou || pointure;

    if (hasMeasurements) {
      try {
        await invoke("create_client_mensurations", {
          clientId: created.id,
          dto: {
            tour_poitrine: tourPoitrine ? parseFloat(tourPoitrine) : null,
            tour_taille: tourTaille ? parseFloat(tourTaille) : null,
            tour_hanches: tourHanches ? parseFloat(tourHanches) : null,
            stature: stature ? parseFloat(stature) : null,
            longueur_bras: longueurBras ? parseFloat(longueurBras) : null,
            longueur_jambe: longueurJambe ? parseFloat(longueurJambe) : null,
            tour_cou: tourCou ? parseFloat(tourCou) : null,
            pointure: pointure ? parseFloat(pointure) : null,
            notes_mensurations: notes.trim() || null,
          },
        });
      } catch (err) {
        console.warn("Enregistrement mensurations ignoré ou en mode hors-tauri :", err);
      }
    }

    toast.success(
      `Client "${created.first_name} ${created.last_name}" enregistré avec succès !`
    );

    if (onSuccess) {
      onSuccess(created);
    }

    handleClose();
  };


  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <UserPlus className="w-4 h-4 text-primary" />
            <span>Nouveau Client — Enregistrement Rapide</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps formulaire */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section 1 : Identité & Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              1. Identité & Coordonnées
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Nom de famille *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ex : DUPONT"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground uppercase font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ex : Jean-Charles"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Téléphone principal (garantie SMS) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Téléphone secondaire / Conjoint
                </label>
                <input
                  type="tel"
                  value={alternativePhone}
                  onChange={(e) => setAlternativePhone(e.target.value)}
                  placeholder="01 45 67 89 10"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground block mb-1">
                  Adresse e-mail (envoi devis et contrats PDF)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@exemple.fr"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Paris, Neuilly, Versailles..."
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Code Postal
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="75008"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground block mb-1">
                  Adresse de facturation / Domicile
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="14 Rue de la Paix"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section 2 : Pièce d'identité (Garantie de location) */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              2. Pièce d'Identité & Sécurité Caution
            </h4>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Numéro officiel (CNI, Passeport, Permis)
              </label>
              <input
                type="text"
                value={identityCardNumber}
                onChange={(e) => setIdentityCardNumber(e.target.value)}
                placeholder="Ex : CNI-FR-220975102934 ou PASS-FR-19AB89201"
                className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Zone d'upload photo CNI */}
            <div className="p-3.5 rounded-xl border border-dashed border-border bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {identityCardPhoto ? (
                  <div className="relative w-20 h-14 rounded-lg overflow-hidden border border-border bg-muted shrink-0 shadow-sm">
                    <img
                      src={identityCardPhoto}
                      alt="Aperçu CNI"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setIdentityCardPhoto(undefined)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-red-600 text-white hover:bg-red-700"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                    <CreditCard className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    {identityCardPhoto
                      ? "Pièce d'identité jointe"
                      : "Photo de la pièce d'identité (Optionnel)"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Format JPG, PNG ou scan. Recommandé pour les cautions élevées.
                  </p>
                </div>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground border border-border text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-primary" />
                  <span>{identityCardPhoto ? "Changer" : "Sélectionner fichier"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3 : Mensurations structurées & Préférences sartoriales (MOD-2) */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                3. Mensurations Structurées (en cm)
              </h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Poitrine (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="50"
                  max="160"
                  value={tourPoitrine}
                  onChange={(e) => setTourPoitrine(e.target.value)}
                  placeholder="Ex: 88"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Taille (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="40"
                  max="150"
                  value={tourTaille}
                  onChange={(e) => setTourTaille(e.target.value)}
                  placeholder="Ex: 68"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Hanches (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="60"
                  max="170"
                  value={tourHanches}
                  onChange={(e) => setTourHanches(e.target.value)}
                  placeholder="Ex: 94"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Stature (cm)</label>
                <input
                  type="number"
                  step="1"
                  min="120"
                  max="220"
                  value={stature}
                  onChange={(e) => setStature(e.target.value)}
                  placeholder="Ex: 172"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Longueur bras (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="30"
                  max="90"
                  value={longueurBras}
                  onChange={(e) => setLongueurBras(e.target.value)}
                  placeholder="Ex: 60"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Longueur jambe (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="50"
                  max="130"
                  value={longueurJambe}
                  onChange={(e) => setLongueurJambe(e.target.value)}
                  placeholder="Ex: 102"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Tour de cou (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  min="25"
                  max="60"
                  value={tourCou}
                  onChange={(e) => setTourCou(e.target.value)}
                  placeholder="Ex: 36"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Pointure</label>
                <input
                  type="number"
                  step="0.5"
                  min="32"
                  max="52"
                  value={pointure}
                  onChange={(e) => setPointure(e.target.value)}
                  placeholder="Ex: 38.5"
                  className="w-full h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Notes et préférences sartoriales libres</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : Préfère les coupes cintrées, longueur cheville avec talons, événement gala..."
                className="w-full p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </div>
          </div>


          {/* Footer boutons */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Créer et Enregistrer le Client</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
