import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  X,
  Search,
  UserPlus,
  AlertTriangle,
  FileText,
  ShoppingBag,
  CheckCircle2,
  Camera,
  Shirt,
  Eye,
} from "lucide-react";
import { formatCents, eurosToCents } from "@/lib/utils";
import { useRentalStore } from "@/store/rentalStore";
import { useClientStore } from "@/store/clientStore";
import { useStockStore } from "@/store/stockStore";
import { QuickCreateClientModal } from "@/components/clients/QuickCreateClientModal";
import { QrCameraScanner } from "@/components/common/QrCameraScanner";
import { photoService } from "@/services/photoService";
import { toast } from "sonner";
import type { CustomerDetailed } from "@/types/customer";
import type { StockArticle, StockVariant } from "@/types/stock";

export const CreateRentalModal: React.FC = () => {
  const {
    isCreateRentalModalOpen,
    setCreateRentalModalOpen,
    checkVariantAvailability,
    createRentalContract,
  } = useRentalStore();

  const { clients, setCreateModalOpen } = useClientStore();
  const { articles } = useStockStore();

  // Étape 1 : Client
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");

  // Étape 2 : Dates
  const [pickupDate, setPickupDate] = useState("2026-09-14");
  const [returnDate, setReturnDate] = useState("2026-09-18");
  const [eventDate, setEventDate] = useState("2026-09-16");

  // Étape 3 : Articles sélectionnés (IDs des variantes choisies)
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [articleSearch, setArticleSearch] = useState("");

  // Gestion des photos : miniatures par lot et Lightbox
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [lightboxArticle, setLightboxArticle] = useState<{
    article: StockArticle;
    photoUrl: string;
  } | null>(null);

  // Scanner QR par caméra
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Chargement par lot des miniatures au montage ou dès que la liste d'articles change
  useEffect(() => {
    if (articles.length === 0) return;
    const articleIds = articles.map((a) => a.id);
    photoService.getBatchThumbs(articleIds).then((res) => {
      setThumbnails((prev) => ({ ...prev, ...res }));
    });
  }, [articles]);

  // Fermeture de la lightbox avec Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxArticle(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Étape 4 : Calculs & Remise
  const [discountEuros, setDiscountEuros] = useState("");
  const [depositMethod, setDepositMethod] = useState<
    "empreinte_cb" | "cheque" | "especes" | "virement"
  >("empreinte_cb");

  // Étape 5 : Règlement
  const [paymentTypeOption, setPaymentTypeOption] = useState<
    "total" | "acompte_30" | "autre"
  >("total");
  const [customPaidEuros, setCustomPaidEuros] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "carte_bancaire" | "especes" | "cheque" | "virement"
  >("carte_bancaire");
  const [notes, setNotes] = useState("");

  // Calcul du nombre de jours de location
  const rentalDays = useMemo(() => {
    if (!pickupDate || !returnDate) return 1;
    const d1 = new Date(pickupDate).getTime();
    const d2 = new Date(returnDate).getTime();
    const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [pickupDate, returnDate]);

  // Client sélectionné
  const selectedClient = clients.find((c) => c.id === selectedCustomerId);

  // Filtrage des clients pour la recherche
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 6);
    const q = clientSearch.toLowerCase().trim();
    return clients.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.phone.includes(q)
    );
  }, [clients, clientSearch]);

  // Calculs financiers automatiques en centimes
  const financialSummary = useMemo(() => {
    let subtotalCents = 0;
    let cleaningTotalCents = 0;
    let defaultDepositCents = 0;

    for (const varId of selectedVariantIds) {
      for (const art of articles) {
        const v = art.variants.find((item) => item.id === varId);
        if (v) {
          subtotalCents += art.rental_price_cents * rentalDays;
          cleaningTotalCents += art.cleaning_fee_cents;
          defaultDepositCents += art.deposit_price_cents;
          break;
        }
      }
    }

    const discountCents = eurosToCents(discountEuros || "0");
    const totalFactureCents = Math.max(0, subtotalCents - discountCents);

    let paidCents = totalFactureCents;
    if (paymentTypeOption === "acompte_30") {
      paidCents = Math.round(totalFactureCents * 0.3);
    } else if (paymentTypeOption === "autre") {
      paidCents = eurosToCents(customPaidEuros || "0");
    }

    const remainingCents = Math.max(0, totalFactureCents - paidCents);

    return {
      subtotalCents,
      cleaningTotalCents,
      discountCents,
      totalFactureCents,
      defaultDepositCents,
      paidCents,
      remainingCents,
      rentalDays,
    };
  }, [selectedVariantIds, articles, discountEuros, paymentTypeOption, customPaidEuros, rentalDays]);

  const handleToggleVariant = (variantId: string) => {
    if (selectedVariantIds.includes(variantId)) {
      setSelectedVariantIds(selectedVariantIds.filter((id) => id !== variantId));
    } else {
      // Test de disponibilité en temps réel
      const check = checkVariantAvailability(variantId, pickupDate, returnDate);
      if (!check.available) {
        toast.error(
          check.conflictReason || "Cette pièce n'est pas disponible pour ces dates !"
        );
        return;
      }
      setSelectedVariantIds([...selectedVariantIds, variantId]);
    }
  };

  /**
   * Analyse et traite la valeur lue par le scanner QR de caméra ou la saisie manuelle :
   * Décode soit un JSON d'étiquette, soit un code-barre brut, soit une référence d'article.
   */
  const handleCodeScanned = (rawCode: string): { status: "success" | "warning" | "error"; message: string } => {
    if (!pickupDate || !returnDate) {
      toast.error("Veuillez d'abord renseigner les dates de location (Étape 2).");
      return { status: "error", message: "Dates de location manquantes (Étape 2)" };
    }

    let targetBarcode = rawCode.trim();
    let targetRef = rawCode.trim();

    // 1. Tente de parser si c'est le JSON complet généré par QrLabelModal
    if (targetBarcode.startsWith("{") && targetBarcode.endsWith("}")) {
      try {
        const parsed = JSON.parse(targetBarcode);
        if (parsed.barcode) targetBarcode = parsed.barcode;
        if (parsed.ref) targetRef = parsed.ref;
      } catch {
        // En cas d'erreur de parsing JSON, on garde le code brut
      }
    }

    // 2. Recherche par code-barre de variante
    let foundVariant: StockVariant | null = null;
    let foundArticle: StockArticle | null = null;

    for (const art of articles) {
      const vMatch = art.variants.find(
        (v) => v.barcode.toUpperCase() === targetBarcode.toUpperCase()
      );
      if (vMatch) {
        foundVariant = vMatch;
        foundArticle = art;
        break;
      }
    }

    // 3. Repli si non trouvé par code-barre : recherche par référence d'article
    if (!foundVariant) {
      const artMatch = articles.find(
        (a) =>
          a.reference.toUpperCase() === targetRef.toUpperCase() ||
          a.id.toUpperCase() === targetRef.toUpperCase()
      );
      if (artMatch && artMatch.variants.length > 0) {
        // Sélectionne en priorité la première variante disponible
        const availableVariant = artMatch.variants.find((v) => {
          const c = checkVariantAvailability(v.id, pickupDate, returnDate);
          return c.available;
        });
        foundVariant = availableVariant || artMatch.variants[0];
        foundArticle = artMatch;
      }
    }

    // 4. Cas : Code inconnu
    if (!foundVariant || !foundArticle) {
      toast.error(`Article introuvable pour le code "${rawCode}".`);
      return { status: "error", message: `Article introuvable : ${rawCode}` };
    }

    // 5. Cas : Déjà sélectionné
    if (selectedVariantIds.includes(foundVariant.id)) {
      toast.info(`"${foundArticle.name} (T.${foundVariant.size})" est déjà dans votre sélection.`);
      return {
        status: "warning",
        message: `${foundArticle.name} (T.${foundVariant.size}) déjà dans la sélection`,
      };
    }

    // 6. Cas : Disponibilité / Conflit de dates
    const check = checkVariantAvailability(foundVariant.id, pickupDate, returnDate);
    if (!check.available) {
      toast.error(`Indisponible sur ces dates : ${check.conflictReason || "Conflit calendrier"}`);
      return {
        status: "error",
        message: `${foundArticle.name} (T.${foundVariant.size}) : Indisponible sur ces dates`,
      };
    }

    // 7. Succès : Ajout à la sélection et défilement fluide vers la carte
    setSelectedVariantIds((prev) => [...prev, foundVariant.id]);
    toast.success(`${foundArticle.name} (Taille ${foundVariant.size}) ajouté à la location !`, {
      description: `Réf : ${foundVariant.barcode} • Caution : ${formatCents(foundArticle.deposit_price_cents)}`,
    });

    const cardEl = cardRefs.current[foundVariant.id];
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    return {
      status: "success",
      message: `${foundArticle.name} (T.${foundVariant.size}) ajouté avec succès`,
    };
  };

  const handleSubmitContract = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast.error("Veuillez sélectionner un client.");
      return;
    }

    if (selectedClient?.is_blacklisted) {
      toast.error("Impossible de louer : ce client est en Liste Noire !");
      return;
    }

    if (selectedVariantIds.length === 0) {
      toast.error("Veuillez sélectionner au moins un article ou costume.");
      return;
    }

    try {
      const contract = await createRentalContract({
        customer_id: selectedCustomerId,
        pickup_date: pickupDate,
        return_date_scheduled: returnDate,
        event_date: eventDate || undefined,
        selected_variant_ids: selectedVariantIds,
        discount_cents: financialSummary.discountCents,
        deposit_method: depositMethod,
        deposit_amount_cents: financialSummary.defaultDepositCents,
        paid_amount_cents: financialSummary.paidCents,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      });

      toast.success(
        `Contrat ${contract.contract_number} validé pour ${contract.customer_name} ! Bon PDF généré.`
      );
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la validation du contrat.");
    }
  };

  // Garde post-hooks (Rules of Hooks : tous les hooks au-dessus)
  if (!isCreateRentalModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm text-foreground">
            <FileText className="w-4 h-4 text-primary" />
            <span>Nouveau Contrat de Location — Assistant de Réservation</span>
          </div>
          <button
            onClick={() => setCreateRentalModalOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps formulaire multi-sections */}
        <form
          onSubmit={handleSubmitContract}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {/* Grille 2 Colonnes : Client & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Colonne 1 : Client */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-primary">
                  1. Sélection du Client *
                </label>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Nouveau client</span>
                </button>
              </div>

              {/* Barre de recherche client */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Rechercher par nom ou tél..."
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Liste de sélection des clients */}
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {filteredClients.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      selectedCustomerId === c.id
                        ? "bg-primary/10 border-primary text-foreground font-bold shadow-xs"
                        : "bg-card border-border hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="truncate">
                      <span className="text-foreground font-semibold">
                        {c.first_name} {c.last_name}
                      </span>{" "}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ({c.phone})
                      </span>
                    </div>

                    {c.is_blacklisted ? (
                      <span className="text-[10px] text-destructive font-bold">
                        Bloqué
                      </span>
                    ) : c.rentals.length > 5 ? (
                      <span className="text-[10px] text-amber-500 font-bold">
                        Fidèle
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              {selectedClient && (
                <div className="p-2.5 rounded-lg bg-background border border-border text-[11px] space-y-0.5">
                  <div className="font-bold text-foreground">
                    Client retenu : {selectedClient.first_name}{" "}
                    {selectedClient.last_name}
                  </div>
                  <div className="text-muted-foreground">
                    Tél : {selectedClient.phone} • N° CNI :{" "}
                    {selectedClient.identity_card_number || "Vérifiée au comptoir"}
                  </div>
                </div>
              )}
            </div>

            {/* Colonne 2 : Dates */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-primary block">
                2. Dates & Calendrier de Retrait *
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Date de retrait prévue *
                  </label>
                  <input
                    type="date"
                    required
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Date de retour impérative *
                  </label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Date de l'événement (Cérémonie, gala)
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="p-2 rounded-lg bg-background border border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Durée calculée :</span>
                <span className="font-bold text-foreground font-mono">
                  {rentalDays} jour(s) de mise à disposition
                </span>
              </div>
            </div>
          </div>

          {/* Section 3 : Sélection des Articles & Vérification Temps Réel */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4" />
                <span>
                  3. Sélection des Pièces & Disponibilité en Temps Réel (
                  {selectedVariantIds.length} sélectionnée(s))
                </span>
              </label>

              <div className="flex items-center gap-2">
                {/* Bouton Scanner avec la Caméra */}
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="h-7 px-2.5 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scanner avec la caméra</span>
                </button>

                <div className="w-52 relative">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Filtrer modèles..."
                    className="w-full h-7 pl-7 pr-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Grille des pièces avec miniatures photos, test de conflit et scroll automatique */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
              {articles
                .filter(
                  (a) =>
                    !articleSearch ||
                    a.name.toLowerCase().includes(articleSearch.toLowerCase()) ||
                    a.brand.toLowerCase().includes(articleSearch.toLowerCase())
                )
                .map((art) => {
                  const photoSrc = thumbnails[art.id] || (art.photos && art.photos[0]) || "";

                  return art.variants.map((v) => {
                    const isSelected = selectedVariantIds.includes(v.id);
                    // Test de disponibilité en direct sur les dates saisies
                    const check = checkVariantAvailability(v.id, pickupDate, returnDate);

                    return (
                      <div
                        key={v.id}
                        ref={(el) => {
                          cardRefs.current[v.id] = el;
                        }}
                        onClick={() => handleToggleVariant(v.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer flex flex-col justify-between transition-all group ${
                          isSelected
                            ? "bg-primary/10 border-primary ring-1 ring-primary shadow-xs"
                            : !check.available
                            ? "bg-destructive/[0.04] border-destructive/20 opacity-70"
                            : "bg-card border-border hover:border-primary/40 hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Miniature photo ratio 3:4 avec clic lightbox */}
                          <div
                            className="relative w-14 h-19 shrink-0 rounded-md overflow-hidden bg-muted border border-border flex items-center justify-center cursor-zoom-in"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (photoSrc) {
                                setLightboxArticle({ article: art, photoUrl: photoSrc });
                              }
                            }}
                            title="Agrandir la photo"
                          >
                            {photoSrc ? (
                              <>
                                <img
                                  src={photoSrc}
                                  alt={art.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/25 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                  <Eye className="w-3.5 h-3.5 drop-shadow-sm" />
                                </div>
                              </>
                            ) : (
                              <Shirt className="w-5 h-5 text-muted-foreground/40 stroke-1" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-mono text-[10px] text-primary font-bold">
                                {v.barcode}
                              </span>
                              <span className="font-bold text-foreground">
                                {formatCents(art.rental_price_cents)}
                              </span>
                            </div>

                            <div className="font-semibold text-foreground truncate">
                              {art.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              Taille {v.size} ({v.sub_size || "Standard"})
                            </div>
                            <div className="text-[10px] text-muted-foreground/80 truncate">
                              {art.brand}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 mt-2 border-t border-border flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            Caution : {formatCents(art.deposit_price_cents)}
                          </span>

                          {isSelected ? (
                            <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" />
                              Sélectionné
                            </span>
                          ) : !check.available ? (
                            <span
                              className="text-[10px] font-bold text-destructive flex items-center gap-0.5 truncate max-w-[130px]"
                              title={check.conflictReason}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Conflit date
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-500">
                              Disponible
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })}
            </div>
          </div>

          {/* Section 4 & 5 : Calculs Financiers, Remise & Modalités de Paiement */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            {/* Colonne Gauche : Options et Paiement */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                4. Règlement & Garantie Caution
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Remise commerciale (DA)
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={discountEuros}
                    onChange={(e) => setDiscountEuros(e.target.value)}
                    placeholder="0"
                    className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-foreground block mb-1">
                    Garantie Caution
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground font-medium"
                  >
                    <option value="empreinte_cb">Empreinte CB</option>
                    <option value="cheque">Chèque en coffre</option>
                    <option value="especes">Espèces</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Versement immédiat (au contrat)
                </label>
                <div className="flex gap-2">
                  {[
                    { id: "total", label: "Solde Total (100%)" },
                    { id: "acompte_30", label: "Acompte (30%)" },
                    { id: "autre", label: "Autre montant" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPaymentTypeOption(opt.id as any)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        paymentTypeOption === opt.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {paymentTypeOption === "autre" && (
                  <input
                    type="number"
                    value={customPaidEuros}
                    onChange={(e) => setCustomPaidEuros(e.target.value)}
                    placeholder="Montant réglé immédiatement (DA)..."
                    className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground font-medium mt-2"
                  />
                )}
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Moyen de règlement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground"
                >
                  <option value="carte_bancaire">Carte Bancaire (TPE)</option>
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="virement">Virement bancaire</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground block mb-1">
                  Notes ou instructions particulières
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex : Retouche d'ourlet pantalon prévue le 15/09..."
                  className="w-full h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-foreground"
                />
              </div>
            </div>

            {/* Colonne Droite : Bilan Financier Calculé en Direct */}
            <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                5. Synthèse & Bilan Financier
              </h4>

              <div className="space-y-2 text-xs divide-y divide-border">
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Articles loués ({financialSummary.rentalDays} j.) :</span>
                  <span className="font-semibold text-foreground">
                    {formatCents(financialSummary.subtotalCents)}
                  </span>
                </div>

                {/* Récapitulatif visuel des pièces sélectionnées */}
                {selectedVariantIds.length > 0 && (
                  <div className="py-2 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Pièces sélectionnées ({selectedVariantIds.length})
                    </span>
                    {selectedVariantIds.map((varId) => {
                      for (const art of articles) {
                        const v = art.variants.find((item) => item.id === varId);
                        if (v) {
                          const pSrc = thumbnails[art.id] || (art.photos && art.photos[0]) || "";
                          return (
                            <div
                              key={varId}
                              className="flex items-center gap-2 p-1.5 rounded-lg bg-background border border-border"
                            >
                              <div className="w-8 h-10 rounded bg-muted border border-border overflow-hidden shrink-0 flex items-center justify-center">
                                {pSrc ? (
                                  <img src={pSrc} alt={art.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Shirt className="w-3.5 h-3.5 text-muted-foreground/40 stroke-1" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground truncate text-[11px]">
                                  {art.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  Taille {v.size} • {v.barcode}
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-foreground shrink-0 font-mono">
                                {formatCents(art.rental_price_cents * financialSummary.rentalDays)}
                              </span>
                            </div>
                          );
                        }
                      }
                      return null;
                    })}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">
                    Frais pressing (inclus) :
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCents(financialSummary.cleaningTotalCents)}
                  </span>
                </div>

                {financialSummary.discountCents > 0 && (
                  <div className="flex justify-between pt-2 text-red-400">
                    <span>Remise accordée :</span>
                    <span className="font-bold">
                      - {formatCents(financialSummary.discountCents)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-2 text-sm">
                  <span className="font-bold text-foreground">
                    Total Facturé TTC :
                  </span>
                  <span className="font-black text-primary">
                    {formatCents(financialSummary.totalFactureCents)}
                  </span>
                </div>

                <div className="flex justify-between pt-2">
                  <span className="font-medium text-muted-foreground">
                    Caution exigée ({depositMethod}) :
                  </span>
                  <span className="font-bold text-foreground">
                    {formatCents(financialSummary.defaultDepositCents)}
                  </span>
                </div>

                <div className="flex justify-between pt-2">
                  <span className="text-emerald-500 font-semibold">
                    Réglé immédiatement :
                  </span>
                  <span className="font-extrabold text-emerald-500">
                    {formatCents(financialSummary.paidCents)}
                  </span>
                </div>

                <div className="flex justify-between pt-2 text-xs">
                  <span className="font-bold text-foreground">
                    Reste dû à la restitution :
                  </span>
                  <span
                    className={`font-black ${
                      financialSummary.remainingCents > 0
                        ? "text-red-400"
                        : "text-emerald-500"
                    }`}
                  >
                    {formatCents(financialSummary.remainingCents)}
                  </span>
                </div>
              </div>

              {/* Bouton de validation */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Valider le Contrat & Générer le Bon PDF (2 exemplaires)
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Modal Lightbox pour aperçu haute résolution de la pièce */}
      {lightboxArticle && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxArticle(null)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-3/4 max-h-[60vh] w-full bg-black/5 flex items-center justify-center overflow-hidden">
              <img
                src={lightboxArticle.photoUrl}
                alt={lightboxArticle.article.name}
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => setLightboxArticle(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                title="Fermer (Échap)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2 border-t border-border">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {lightboxArticle.article.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {lightboxArticle.article.brand} • Réf : {lightboxArticle.article.reference}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-sm text-primary font-mono">
                    {formatCents(lightboxArticle.article.rental_price_cents)} / jour
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Caution : {formatCents(lightboxArticle.article.deposit_price_cents)}
                  </div>
                </div>
              </div>

              {lightboxArticle.article.description && (
                <p className="text-xs text-muted-foreground line-clamp-3 pt-1 border-t border-border">
                  {lightboxArticle.article.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner QR par Caméra */}
      <QrCameraScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onCodeScanned={handleCodeScanned}
        title="Scanner QR Code de l'Article"
      />

      {/* Modal de création rapide de client intégré */}
      <QuickCreateClientModal
        onSuccess={(newClient: CustomerDetailed) => {
          setSelectedCustomerId(newClient.id);
        }}
      />
    </div>
  );
};

