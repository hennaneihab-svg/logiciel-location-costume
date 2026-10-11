import React, { useState } from "react";
import {
  ShieldCheck,
  Building2,
  CheckCircle2,
  Lock,
  User,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Shirt,
  HeartHandshake,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

export const SetupWizardPage: React.FC = () => {
  const { completeSetup } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Étape 1 : Compte Administrateur (Zéro valeur par défaut)
  const [adminUsername, setAdminUsername] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Étape 2 : Informations Boutique
  const [boutiqueName, setBoutiqueName] = useState("");
  const [boutiqueAddress, setBoutiqueAddress] = useState("");
  const [boutiquePhone, setBoutiquePhone] = useState("");
  const [activityType, setActivityType] = useState<"homme" | "femme" | "mixte">("mixte");

  // Validation étape 1
  const isStep1Valid =
    adminUsername.trim().length >= 3 &&
    adminPassword.length >= 8 &&
    adminPassword === adminPasswordConfirm;

  // Validation étape 2
  const isStep2Valid =
    boutiqueName.trim().length >= 2 &&
    boutiqueAddress.trim().length >= 3 &&
    boutiquePhone.trim().length >= 6;

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername.trim().length < 3) {
      toast.error("L'identifiant doit comporter au moins 3 caractères.");
      return;
    }
    if (adminPassword.length < 8) {
      toast.error("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    if (adminPassword !== adminPasswordConfirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boutiqueName.trim()) {
      toast.error("Le nom de la boutique est obligatoire.");
      return;
    }
    if (!boutiqueAddress.trim()) {
      toast.error("L'adresse de la boutique est obligatoire.");
      return;
    }
    if (!boutiquePhone.trim()) {
      toast.error("Le numéro de téléphone est obligatoire.");
      return;
    }
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    try {
      setIsSubmitting(true);
      const res = await completeSetup({
        adminUsername: adminUsername.trim(),
        adminFullName: adminFullName.trim() || "Administrateur",
        adminPassword,
        boutiqueName: boutiqueName.trim(),
        boutiqueAddress: boutiqueAddress.trim(),
        boutiquePhone: boutiquePhone.trim(),
        activityType,
      });

      if (!res.success) {
        toast.error(res.error || "Erreur lors de la configuration initiale.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Configuration initiale terminée ! Bienvenue sur Atelier Prestige.");
      // App.tsx détecte isSetupRequired=false via Zustand et route automatiquement vers l'app
    } catch (err: any) {
      toast.error(err?.message || "Erreur imprévue lors de l'enregistrement.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-100 flex flex-col justify-center items-center p-4 select-none">
      {/* Container principal */}
      <div className="w-full max-w-2xl bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header avec indicateur d'étapes */}
        <div className="px-8 pt-8 pb-6 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Configuration Initiale — Atelier Prestige
              </h1>
              <p className="text-xs text-muted-foreground">
                Bienvenue ! Veuillez configurer votre établissement avant le premier accès.
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between mt-6 px-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 1
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                1
              </div>
              <span className={`text-xs font-medium ${step >= 1 ? "text-foreground" : "text-muted-foreground"}`}>
                Administrateur
              </span>
            </div>
            <div className={`h-0.5 flex-1 mx-3 transition-colors ${step >= 2 ? "bg-primary" : "bg-border"}`} />
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 2
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                2
              </div>
              <span className={`text-xs font-medium ${step >= 2 ? "text-foreground" : "text-muted-foreground"}`}>
                Boutique
              </span>
            </div>
            <div className={`h-0.5 flex-1 mx-3 transition-colors ${step >= 3 ? "bg-primary" : "bg-border"}`} />
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= 3
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                3
              </div>
              <span className={`text-xs font-medium ${step >= 3 ? "text-foreground" : "text-muted-foreground"}`}>
                Validation
              </span>
            </div>
          </div>
        </div>

        {/* Corps du formulaire */}
        <div className="p-8">
          {/* ÉTAPE 1 : COMPTE ADMINISTRATEUR */}
          {step === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-5">
              <div className="border-b border-border/40 pb-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Création du Compte Administrateur Principal
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ce compte possèdera tous les droits de gestion et de clôture de caisse.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Identifiant de connexion *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: admin ou gerant"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">Au moins 3 caractères</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Nom complet du gérant
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Mourad Benali"
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">Optionnel mais recommandé</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Mot de passe * (min. 8 caractères)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="mt-1 text-[11px]">
                    <span className={adminPassword.length >= 8 ? "text-emerald-500 font-medium" : "text-amber-500"}>
                      {adminPassword.length >= 8 ? "✓ Longueur conforme (≥ 8 caractères)" : "Doit contenir au moins 8 caractères"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Confirmer le mot de passe *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={adminPasswordConfirm}
                      onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="mt-1 text-[11px]">
                    {adminPasswordConfirm && (
                      <span className={adminPassword === adminPasswordConfirm ? "text-emerald-500 font-medium" : "text-destructive"}>
                        {adminPassword === adminPasswordConfirm ? "✓ Mots de passe identiques" : "Les mots de passe diffèrent"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={!isStep1Valid}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium text-xs rounded-xl shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <span>Continuer vers les réglages boutique</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ÉTAPE 2 : INFORMATIONS BOUTIQUE & TYPE D'ACTIVITÉ */}
          {step === 2 && (
            <form onSubmit={handleNextStep2} className="space-y-5">
              <div className="border-b border-border/40 pb-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Informations de l'Établissement
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ces coordonnées apparaîtront sur vos contrats de location et tickets de caisse (DA entiers).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Nom commercial de la boutique *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Maison El-Amir Cérémonie"
                    value={boutiqueName}
                    onChange={(e) => setBoutiqueName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Adresse complète *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: 24 Boulevard Zighout Youcef, Alger"
                      value={boutiqueAddress}
                      onChange={(e) => setBoutiqueAddress(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Téléphone de contact *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: 0550 12 34 56 ou 021 65 43 21"
                      value={boutiquePhone}
                      onChange={(e) => setBoutiquePhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              </div>

              {/* Sélection du Type d'Activité */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-foreground mb-2">
                  Type d'activité principale *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setActivityType("homme")}
                    className={`p-3.5 rounded-xl border text-left flex flex-col items-start gap-2 transition-all ${
                      activityType === "homme"
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                        : "border-border hover:border-border/80 bg-background/50"
                    }`}
                  >
                    <Shirt className={`w-5 h-5 ${activityType === "homme" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-xs font-bold text-foreground">Boutique Homme</div>
                      <div className="text-[11px] text-muted-foreground">Costumes, Smokings & Chaussures</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivityType("femme")}
                    className={`p-3.5 rounded-xl border text-left flex flex-col items-start gap-2 transition-all ${
                      activityType === "femme"
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                        : "border-border hover:border-border/80 bg-background/50"
                    }`}
                  >
                    <Sparkles className={`w-5 h-5 ${activityType === "femme" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-xs font-bold text-foreground">Boutique Femme</div>
                      <div className="text-[11px] text-muted-foreground">Robes de Soirée & Mariée</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivityType("mixte")}
                    className={`p-3.5 rounded-xl border text-left flex flex-col items-start gap-2 transition-all ${
                      activityType === "mixte"
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                        : "border-border hover:border-border/80 bg-background/50"
                    }`}
                  >
                    <HeartHandshake className={`w-5 h-5 ${activityType === "mixte" ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <div className="text-xs font-bold text-foreground">Boutique Mixte</div>
                      <div className="text-[11px] text-muted-foreground">Homme, Femme & Cérémonie</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Retour</span>
                </button>

                <button
                  type="submit"
                  disabled={!isStep2Valid}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-medium text-xs rounded-xl shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <span>Continuer vers le récapitulatif</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ÉTAPE 3 : RÉCAPITULATIF & VALIDATION DÉFINITIVE */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="border-b border-border/40 pb-3">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Récapitulatif de la Configuration Initiale
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vérifiez vos informations avant l'initialisation définitive de votre base locale.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Carte Compte */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
                  <div className="text-xs font-bold text-primary uppercase tracking-wider">Compte Administrateur</div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Identifiant : </span>
                    <span className="font-semibold text-foreground">{adminUsername}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Nom complet : </span>
                    <span className="font-semibold text-foreground">{adminFullName || "Administrateur"}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Rôle : </span>
                    <span className="px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary text-[10px] font-bold">ADMINISTRATEUR</span>
                  </div>
                </div>

                {/* Carte Boutique */}
                <div className="p-4 rounded-xl border border-border/80 bg-background/60 space-y-2">
                  <div className="text-xs font-bold text-primary uppercase tracking-wider">Établissement</div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Boutique : </span>
                    <span className="font-semibold text-foreground">{boutiqueName}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Adresse : </span>
                    <span className="text-foreground">{boutiqueAddress}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Téléphone : </span>
                    <span className="text-foreground">{boutiquePhone}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Activité : </span>
                    <span className="capitalize font-semibold text-foreground">{activityType}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                <span>
                  La devise est automatiquement configurée en <strong>Dinars Algériens (DA entiers)</strong> avec un taux de TVA légal de 19%.
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Modifier</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinalSubmit}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-lg hover:bg-emerald-500 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Initialisation en cours...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valider et Accéder à la Boutique</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
