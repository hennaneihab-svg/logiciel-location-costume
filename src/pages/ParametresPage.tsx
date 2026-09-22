import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Hash,
  HardDriveDownload,
  ShieldCheck,
  Save,
  Download,
  Trash2,
  Search,
  FileSpreadsheet,
  RotateCcw,
  Lock,
  Sparkles,
} from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import { useAuthStore } from "@/store/authStore";
import { restartApplication, setRestorationInProgress } from "@/services/tauri";
import { toast } from "sonner";
import { PressingProvidersSettings } from "@/components/settings/PressingProvidersSettings";

type SettingsTab = "etablissement" | "numerotation" | "sauvegardes" | "audit" | "pressing";

export const ParametresPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("etablissement");

  const {
    boutique,
    numbering,
    tax,
    backups,
    auditLogs,
    isBackingUp,
    updateBoutiqueSettings,
    updateNumberingSettings,
    updateTaxSettings,
    createBackupNow,
    restoreBackup,
    deleteBackup,
  } = useSettingsStore();

  const {
    inactivityTimeoutMinutes,
    setInactivityTimeoutMinutes,
  } = useAuthStore();

  // Local state pour formulaires
  const [boutiqueForm, setBoutiqueForm] = useState(boutique);
  const [numberingForm, setNumberingForm] = useState(numbering);
  const [vatRateInput, setVatRateInput] = useState((tax.default_vat_rate * 100).toString());
  const [timeoutInput, setTimeoutInput] = useState(inactivityTimeoutMinutes.toString());

  // Filtres audit logs
  const [auditSearch, setAuditSearch] = useState("");
  const [selectedAuditAction, setSelectedAuditAction] = useState<string>("all");

  const handleSaveBoutique = (e: React.FormEvent) => {
    e.preventDefault();
    updateBoutiqueSettings(boutiqueForm);
    toast.success("Coordonnées de l'établissement enregistrées avec succès !");
  };

  const handleSaveNumbering = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(vatRateInput) / 100;
    updateTaxSettings({ default_vat_rate: isNaN(rate) ? 0.2 : rate });
    updateNumberingSettings(numberingForm);
    const parsedTimeout = parseInt(timeoutInput, 10);
    setInactivityTimeoutMinutes(isNaN(parsedTimeout) ? 15 : parsedTimeout);
    toast.success("Paramètres fiscaux, de numérotation et de sécurité enregistrés !");
  };

  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);

  const handleCreateBackup = async () => {
    try {
      const entry = await createBackupNow("manual");
      toast.success(`Sauvegarde créée avec succès !`, {
        description: `Archive : ${entry.filename} (${(entry.size_bytes / 1024).toFixed(1)} Ko)`,
      });
    } catch (err) {
      toast.error("Erreur lors de la création de la sauvegarde.");
    }
  };

  const handleRestoreBackup = async (id: string, filename: string) => {
    const confirmed = window.confirm(
      `ATTENTION : Vous êtes sur le point de restaurer les données depuis la sauvegarde "${filename}".\n\nToutes les modifications non sauvegardées seront écrasées et remplacées par l'état exact de cette archive.\n\nSouhaitez-vous continuer ?`
    );
    if (!confirmed) return;

    setRestoringBackupId(id);
    setRestorationInProgress(true);
    try {
      await restoreBackup(id);
      // Neutraliser le timer d'inactivité pour éviter toute interférence de session pendant la relance
      setInactivityTimeoutMinutes(0);
      toast.success(
        "Restauration terminée avec succès. L'application va redémarrer immédiatement pour appliquer la nouvelle base SQLite.",
        { duration: 4000 }
      );
      // Redémarrage complet du processus de l'application
      setTimeout(async () => {
        await restartApplication();
      }, 1200);
    } catch (err: any) {
      setRestorationInProgress(false);
      toast.error(err.message || "Erreur lors de la restauration.");
    } finally {
      // Garantit que le bouton redevient immédiatement utilisable en cas d'échec
      setRestoringBackupId(null);
    }
  };

  // Filtrage du journal d'audit
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchSearch =
      auditSearch.trim() === "" ||
      log.user_name.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase());

    const matchAction =
      selectedAuditAction === "all" || log.action === selectedAuditAction;

    return matchSearch && matchAction;
  });

  const handleExportAuditCsv = () => {
    const headers = ["ID", "Date", "Heure", "Utilisateur", "Rôle", "Action", "Table", "Entité", "Détails"];
    const rows = filteredAuditLogs.map((l) => [
      l.id,
      new Date(l.created_at).toLocaleDateString("fr-FR"),
      new Date(l.created_at).toLocaleTimeString("fr-FR"),
      `"${l.user_name}"`,
      l.user_role,
      l.action,
      l.entity_table,
      `"${l.entity_id}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success("Journal d'audit exporté en CSV");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Configuration &amp; Paramètres
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coordonnées de l'établissement, formats de numérotation, sauvegardes horodatées et journal d'audit
          </p>
        </div>

        {/* Navigation Onglets */}
        <div className="flex items-center bg-muted/50 p-1 rounded-md border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("etablissement")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "etablissement"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Établissement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("numerotation")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "numerotation"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Numérotation &amp; TVA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sauvegardes")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "sauvegardes"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>Sauvegardes</span>
            <span className="w-4 h-4 rounded-full bg-muted text-foreground text-[10px] font-bold flex items-center justify-center border border-border">
              {backups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "audit"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Journal d'audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pressing")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "pressing"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pressing &amp; Atelier</span>
          </button>
        </div>
      </div>

      {/* Contenu Onglets */}
      <AnimatePresence mode="wait">
        {/* ONGLET 1 : ÉTABLISSEMENT */}
        {activeTab === "etablissement" && (
          <motion.div
            key="etablissement"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <form
              onSubmit={handleSaveBoutique}
              className="lg:col-span-8 bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Coordonnées Officielles de l'Établissement
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Imprimées automatiquement sur les bons et factures
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-muted-foreground font-medium block mb-1">
                    Nom de l'Enseigne
                  </label>
                  <input
                    type="text"
                    value={boutiqueForm.name}
                    onChange={(e) => setBoutiqueForm({ ...boutiqueForm, name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-muted-foreground font-medium block mb-1">
                    Slogan / Sous-titre
                  </label>
                  <input
                    type="text"
                    value={boutiqueForm.slogan}
                    onChange={(e) => setBoutiqueForm({ ...boutiqueForm, slogan: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Adresse Postale
                  </label>
                  <input
                    type="text"
                    value={boutiqueForm.address}
                    onChange={(e) => setBoutiqueForm({ ...boutiqueForm, address: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">
                      Code Postal
                    </label>
                    <input
                      type="text"
                      value={boutiqueForm.postal_code}
                      onChange={(e) =>
                        setBoutiqueForm({ ...boutiqueForm, postal_code: e.target.value })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">
                      Ville
                    </label>
                    <input
                      type="text"
                      value={boutiqueForm.city}
                      onChange={(e) => setBoutiqueForm({ ...boutiqueForm, city: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Téléphone Boutique
                  </label>
                  <input
                    type="text"
                    value={boutiqueForm.phone}
                    onChange={(e) => setBoutiqueForm({ ...boutiqueForm, phone: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Email de Contact
                  </label>
                  <input
                    type="email"
                    value={boutiqueForm.email}
                    onChange={(e) => setBoutiqueForm({ ...boutiqueForm, email: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Numéro SIRET
                  </label>
                  <input
                    type="text"
                    value={boutiqueForm.siret}
                    onChange={(e) => setBoutiqueForm({ ...boutiqueForm, siret: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Registre du Commerce (RCS)
                  </label>
                  <input
                    type="text"
                    value={boutiqueForm.rcs}
                    onChange={(e) => setBoutiqueForm({ ...boutiqueForm, rcs: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-muted-foreground font-medium block mb-1">
                    Mentions Légales & Conditions Générales en Bas de Page
                  </label>
                  <textarea
                    rows={2}
                    value={boutiqueForm.legal_notice}
                    onChange={(e) =>
                      setBoutiqueForm({ ...boutiqueForm, legal_notice: e.target.value })
                    }
                    className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Enregistrer les Modifications</span>
                </button>
              </div>
            </form>

            {/* Aperçu En-tête Document */}
            <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Aperçu En-tête des Documents PDF
              </h4>

              <div className="p-4 rounded-xl bg-white text-slate-900 border border-slate-200 shadow-sm space-y-2 text-center">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 font-bold text-xs mx-auto">
                  AP
                </div>
                <h5 className="font-extrabold text-xs tracking-wider text-amber-600">
                  {boutiqueForm.name}
                </h5>
                <p className="text-[10px] text-slate-600 italic">
                  {boutiqueForm.slogan}
                </p>
                <div className="text-[9px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-200">
                  <p>
                    {boutiqueForm.address}, {boutiqueForm.postal_code} {boutiqueForm.city}
                  </p>
                  <p>
                    Tél : {boutiqueForm.phone} • Email : {boutiqueForm.email}
                  </p>
                  <p>SIRET : {boutiqueForm.siret}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border/80 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Synchronisation automatique :</p>
                <p>
                  Ces coordonnées sont injectées directement dans le générateur de bons de location
                  en 2 exemplaires (`pdfService`) et dans les tickets de caisse (`receiptPdfService`).
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ONGLET 2 : NUMÉROTATION & FISCALITÉ */}
        {activeTab === "numerotation" && (
          <motion.div
            key="numerotation"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="max-w-3xl bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5"
          >
            <form onSubmit={handleSaveNumbering} className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Formats de Numérotation & Paramètres Fiscaux
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Définissez la structure des identifiants uniques de vos contrats et tickets
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Préfixe Contrats de Location
                  </label>
                  <input
                    type="text"
                    value={numberingForm.rental_prefix}
                    onChange={(e) =>
                      setNumberingForm({
                        ...numberingForm,
                        rental_prefix: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Exemple généré : <strong className="text-primary font-mono">{numberingForm.rental_prefix}-2026-0042</strong>
                  </span>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Préfixe Ventes Directes Caisse
                  </label>
                  <input
                    type="text"
                    value={numberingForm.sale_prefix}
                    onChange={(e) =>
                      setNumberingForm({
                        ...numberingForm,
                        sale_prefix: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Exemple généré : <strong className="text-primary font-mono">{numberingForm.sale_prefix}-2026-0015</strong>
                  </span>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Taux de TVA par Défaut (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={vatRateInput}
                      onChange={(e) => setVatRateInput(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    Format Année & Remplissage zéros
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={numberingForm.year_format}
                      onChange={(e) =>
                        setNumberingForm({
                          ...numberingForm,
                          year_format: e.target.value as "YYYY" | "YY",
                        })
                      }
                      className="h-9 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="YYYY">AAAA (2026)</option>
                      <option value="YY">AA (26)</option>
                    </select>

                    <select
                      value={numberingForm.padding_digits}
                      onChange={(e) =>
                        setNumberingForm({
                          ...numberingForm,
                          padding_digits: parseInt(e.target.value),
                        })
                      }
                      className="h-9 px-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value={3}>3 chiffres (001)</option>
                      <option value={4}>4 chiffres (0001)</option>
                      <option value={5}>5 chiffres (00001)</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    <label className="text-foreground font-semibold block text-xs">
                      Sécurité de session : Déconnexion automatique pour inactivité
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <select
                        value={timeoutInput}
                        onChange={(e) => setTimeoutInput(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      >
                        <option value="5">5 minutes</option>
                        <option value="10">10 minutes</option>
                        <option value="15">15 minutes (recommandé sur poste partagé)</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 heure</option>
                        <option value="0">Désactivé (non recommandé)</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      L'application verrouillera l'accès si aucune frappe ou clic de souris n'est détecté durant ce délai.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Enregistrer les Formats</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ONGLET 3 : SAUVEGARDES */}
        {activeTab === "sauvegardes" && (
          <motion.div
            key="sauvegardes"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-6"
          >
            {/* Action Principale & Jauge de Rétention 30 jours */}
            <div className="p-5 rounded-2xl bg-card border border-border shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <HardDriveDownload className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Sauvegarde Complète SQLite & Dossier /bons (ZIP)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Archive compressée horodatée contenant le snapshot de la base de données, l'intégralité des contrats et le manifeste
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Politique de rétention :</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    {backups.length} / 30 sauvegardes conservées
                  </span>
                  <span>(Rotation FIFO automatique quotidienne)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/25 transition-all self-start md:self-auto shrink-0"
              >
                <HardDriveDownload className="w-4 h-4" />
                <span>{isBackingUp ? "Création du ZIP..." : "Sauvegarder Maintenant (.zip)"}</span>
              </button>
            </div>

            {/* Liste des Sauvegardes Disponibles */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">
                  Archives de Sauvegarde Disponibles ({backups.length})
                </h4>
                <span className="text-xs text-muted-foreground">
                  Dossier cible : <code className="font-mono text-primary">/backups</code>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px] font-semibold border-y border-border">
                    <tr>
                      <th className="py-2.5 px-3">Nom de l'Archive</th>
                      <th className="py-2.5 px-3">Date & Heure</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Contenu Snapshot</th>
                      <th className="py-2.5 px-3">Taille</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {backups.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-foreground">
                          {b.filename}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {new Date(b.created_at).toLocaleString("fr-FR")}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              b.trigger_type === "auto_daily"
                                ? "bg-blue-500/15 text-blue-600"
                                : "bg-emerald-500/15 text-emerald-600"
                            }`}
                          >
                            {b.trigger_type === "auto_daily" ? "Auto (Quotidienne)" : "Manuelle"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {b.records_count.articles} art. • {b.records_count.clients} clients • {b.records_count.locations} loc. • {b.records_count.pdf_count} bons
                        </td>
                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {(b.size_bytes / 1024).toFixed(1)} Ko
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRestoreBackup(b.id, b.filename)}
                              disabled={restoringBackupId === b.id}
                              className="p-1.5 rounded-lg border border-border text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                              title="Restaurer cette sauvegarde (avec confirmation)"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${restoringBackupId === b.id ? "animate-spin" : ""}`} />
                            </button>
                            {b.blob_url && (
                              <a
                                href={b.blob_url}
                                download={b.filename}
                                className="p-1.5 rounded-lg border border-border text-primary hover:bg-secondary"
                                title="Télécharger l'archive ZIP"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteBackup(b.id)}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-secondary"
                              title="Supprimer cette sauvegarde"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ONGLET 4 : JOURNAL D'AUDIT */}
        {activeTab === "audit" && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>Journal d'Activité & Sécurité (`audit_logs`)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Traçabilité des opérations sensibles (suppressions, modifications de prix, changements de statut)
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportAuditCsv}
                className="px-3.5 py-1.5 rounded-xl border border-border bg-secondary/50 text-foreground hover:bg-secondary text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Exporter CSV</span>
              </button>
            </div>

            {/* Filtres de Recherche */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Rechercher par utilisateur, entité ou mot-clé..."
                  className="w-full h-8 pl-9 pr-4 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={selectedAuditAction}
                onChange={(e) => setSelectedAuditAction(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">Toutes les actions</option>
                <option value="UPDATE_STATUS">Changements de Statut</option>
                <option value="UPDATE_PRICE">Modifications de Prix</option>
                <option value="DELETE_CLIENT">Suppressions Clients</option>
                <option value="DELETE_ARTICLE">Suppressions Articles</option>
                <option value="CLOTURE_CAISSE">Clôtures de Caisse</option>
                <option value="CREATE_BACKUP">Sauvegardes ZIP</option>
                <option value="LOGIN_SUCCESS">Connexions</option>
              </select>
            </div>

            {/* Table des Logs */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px] font-semibold border-y border-border">
                  <tr>
                    <th className="py-2.5 px-3">Date / Heure</th>
                    <th className="py-2.5 px-3">Utilisateur</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Entité Ciblée</th>
                    <th className="py-2.5 px-3">Détails & Modifications</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Aucun événement d'audit ne correspond aux filtres.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      const isDelete = log.action.startsWith("DELETE");
                      const isPrice = log.action.includes("PRICE");
                      const isSecurity = log.action.includes("LOGIN") || log.action.includes("BACKUP");

                      return (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("fr-FR")}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-semibold text-foreground">{log.user_name}</span>
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              ({log.user_role})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDelete
                                  ? "bg-red-500/15 text-red-600 border border-red-500/30"
                                  : isPrice
                                  ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                                  : isSecurity
                                  ? "bg-blue-500/15 text-blue-600 border border-blue-500/30"
                                  : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-foreground whitespace-nowrap">
                            {log.entity_table} : {log.entity_id}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ONGLET 5 : PRESSING & ATELIER */}
        {activeTab === "pressing" && (
          <motion.div
            key="pressing"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <PressingProvidersSettings />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
