import React, { useState, useRef } from "react";
import { X, Upload, Trash2, Plus, Shirt, Image as ImageIcon, Camera } from "lucide-react";
import { eurosToCents } from "@/lib/utils";
import { useStockStore } from "@/store/stockStore";
import type { StockArticle, StockVariant } from "@/types/stock";
import { toast } from "sonner";
import { validateImageFile, processArticleImage } from "@/lib/imageProcessor";
import { photoService } from "@/services/photoService";
import { logger } from "@/lib/logger";

export const CreateEditArticleModal: React.FC = () => {
  const { isCreateModalOpen, setCreateModalOpen, addArticle } = useStockStore();

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("cat-01");
  const [reference, setReference] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [rentalPrice, setRentalPrice] = useState("");
  const [salePrice] = useState("");
  const [depositPrice, setDepositPrice] = useState("");
  const [cleaningFee, setCleaningFee] = useState("15");

  // Photo principale stockée sous format traité
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [processedPhotoData, setProcessedPhotoData] = useState<{
    mime: string;
    dataBase64: string;
    thumbBase64: string;
  } | null>(null);

  // Modal capture caméra
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Variantes dynamiques (taille + quantité)
  const [variantsList, setVariantsList] = useState<
    { size: string; quantity: number; subSize: string }[]
  >([
    { size: "48", quantity: 1, subSize: "Standard" },
    { size: "50", quantity: 2, subSize: "Standard" },
    { size: "52", quantity: 1, subSize: "Drop 7" },
  ]);

  if (!isCreateModalOpen) return null;

  // Gestion import fichier photo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || "Fichier image invalide");
      return;
    }

    try {
      const processed = await processArticleImage(file);
      setProcessedPhotoData(processed);
      setPhotoPreview(`data:${processed.mime};base64,${processed.thumbBase64}`);
      toast.success("Photo importée et optimisée avec succès");
    } catch (err) {
      logger.error("CreateEditArticleModal: Erreur optimisation photo", err);
      toast.error("Erreur lors de l'optimisation de la photo");
    }
  };

  // Démarrer la capture caméra
  const handleStartCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setIsCameraActive(false);
      toast.error("Impossible d'accéder à la caméra pour la capture");
    }
  };

  // Stopper la caméra
  const handleStopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Prendre une photo depuis le flux vidéo
  const handleCaptureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    try {
      const processed = await processArticleImage(dataUrl);
      setProcessedPhotoData(processed);
      setPhotoPreview(`data:${processed.mime};base64,${processed.thumbBase64}`);
      toast.success("Photo capturée avec succès");
    } catch (err) {
      toast.error("Erreur lors de la capture photo");
    } finally {
      handleStopCamera();
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview("");
    setProcessedPhotoData(null);
  };

  const handleAddVariantRow = () => {
    setVariantsList([
      ...variantsList,
      { size: "50", quantity: 1, subSize: "Standard" },
    ]);
  };

  const handleRemoveVariantRow = (idx: number) => {
    setVariantsList(variantsList.filter((_, i) => i !== idx));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Le nom du modèle est obligatoire");
      return;
    }
    if (!reference.trim()) {
      toast.error("La référence modèle est obligatoire");
      return;
    }
    const rentCents = eurosToCents(rentalPrice);
    if (rentCents <= 0) {
      toast.error("Le tarif de location doit être positif");
      return;
    }

    // Génération des variantes physiques unitaires à partir des tailles + quantités
    const generatedVariants: StockVariant[] = [];
    let counter = 1;
    const cleanRef = reference.trim().replace(/\s+/g, "-").toUpperCase();

    variantsList.forEach((row) => {
      for (let q = 0; q < row.quantity; q++) {
        generatedVariants.push({
          id: `var-new-${Date.now()}-${counter}`,
          article_id: `art-new-${Date.now()}`,
          barcode: `BAR-${cleanRef}-${row.size}-${counter}`,
          size: row.size,
          sub_size: row.subSize,
          condition_state: "neuf",
          status: "disponible",
          times_rented: 0,
          created_at: new Date().toISOString(),
        });
        counter++;
      }
    });

    const categoryNames: Record<string, string> = {
      "cat-01": "Smokings Cérémonie",
      "cat-02": "Costumes 3 Pièces",
      "cat-03": "Costumes 2 Pièces",
      "cat-04": "Chaussures Richelieu",
      "cat-05": "Chaussures Derbies",
      "cat-06": "Accessoires Prestige",
    };

    const newArticle: StockArticle = {
      id: `art-${Date.now()}`,
      category_id: category,
      category_name: categoryNames[category] || "Costume",
      reference: cleanRef,
      name: name.trim(),
      brand: brand.trim() || "Atelier Prestige",
      color: color.trim() || "Noir",
      description: description.trim() || "Modèle d'exception pour événement et cérémonie.",
      rental_price_cents: rentCents,
      sale_price_cents: salePrice ? eurosToCents(salePrice) : undefined,
      deposit_price_cents: depositPrice ? eurosToCents(depositPrice) : rentCents * 3,
      cleaning_fee_cents: eurosToCents(cleaningFee || "0"),
      photos: photoPreview ? [photoPreview] : [
        "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800",
      ],
      variants: generatedVariants,
      rental_history: [],
      total_revenue_cents: 0,
      times_rented_total: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    addArticle(newArticle);

    // Enregistrement persistant dans SQLite si une photo a été importée / capturée
    if (processedPhotoData) {
      photoService.setPhoto({
        article_id: newArticle.id,
        mime: processedPhotoData.mime,
        data_base64: processedPhotoData.dataBase64,
        thumb_base64: processedPhotoData.thumbBase64,
      }).catch((err) => logger.warn("CreateEditArticleModal: Erreur sauvegarde SQLite photo", err));
    }

    toast.success(`Article "${newArticle.name}" créé avec ${generatedVariants.length} exemplaire(s) en stock !`);
    setCreateModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <Shirt className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              Nouvel Article & Génération de Stock
            </h3>
          </div>
          <button
            onClick={() => setCreateModalOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1 : Informations Générales */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
              1. Informations Générales du Modèle
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Nom du modèle *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Smoking Col Châle Velours Noir"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Référence Unique *
                </label>
                <input
                  type="text"
                  required
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex: SMK-NOIR-VEL-01"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Marque / Maison
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Lanvin, Scabal, Santoni..."
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="cat-01">Smokings Cérémonie</option>
                  <option value="cat-02">Costumes 3 Pièces</option>
                  <option value="cat-03">Costumes 2 Pièces</option>
                  <option value="cat-04">Chaussures Richelieu</option>
                  <option value="cat-05">Chaussures Derbies</option>
                  <option value="cat-06">Accessoires Prestige</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Couleur / Nuance
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Ex: Noir Profond, Bleu Nuit..."
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Tarif Location (DA / jour) *
                </label>
                <input
                  type="number"
                  step="100"
                  required
                  value={rentalPrice}
                  onChange={(e) => setRentalPrice(e.target.value)}
                  placeholder="Ex: 4500"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Caution suggérée (DA)
                </label>
                <input
                  type="number"
                  step="500"
                  value={depositPrice}
                  onChange={(e) => setDepositPrice(e.target.value)}
                  placeholder="Ex: 15000"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Forfait Pressing / Entretien (DA)
                </label>
                <input
                  type="number"
                  step="100"
                  value={cleaningFee}
                  onChange={(e) => setCleaningFee(e.target.value)}
                  placeholder="Ex: 500"
                  className="w-full h-9 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Description & Tissu
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Spécificités sartoriales, composition tissu, conseils d'ajustement..."
                className="w-full p-2.5 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Section 2 : Photo principale du modèle */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              2. Photo Principale du Modèle (Stockée en base SQLite)
            </h4>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              {/* Aperçu ou placeholder */}
              <div className="relative w-32 h-40 rounded-lg overflow-hidden border border-border bg-muted shrink-0 flex items-center justify-center group">
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Aperçu modèle" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-1 right-1 p-1 rounded-md bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Supprimer la photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-center text-muted-foreground">
                    <Shirt className="w-8 h-8 stroke-1 text-muted-foreground/50 mb-1" />
                    <span className="text-[10px]">Aucune photo</span>
                  </div>
                )}
              </div>

              {/* Actions d'ajout : Fichier + Caméra */}
              <div className="flex-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Importez une image (JPEG, PNG, WebP max 10 Mo) ou prenez une photo instantanée avec la caméra de l'ordinateur. La photo sera automatiquement optimisée et redimensionnée.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
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
                    className="h-8 px-3 rounded-md bg-secondary hover:bg-muted text-xs font-medium text-foreground border border-border flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choisir un fichier</span>
                  </button>

                  <button
                    type="button"
                    onClick={isCameraActive ? handleStopCamera : handleStartCamera}
                    className="h-8 px-3 rounded-md bg-secondary hover:bg-muted text-xs font-medium text-foreground border border-border flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{isCameraActive ? "Fermer la caméra" : "Prendre avec la caméra"}</span>
                  </button>
                </div>

                {/* Volet actif de capture caméra */}
                {isCameraActive && (
                  <div className="mt-3 p-3 rounded-lg border border-border bg-card space-y-2 max-w-sm">
                    <div className="aspect-4/3 w-full bg-black rounded overflow-hidden relative">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <button
                        type="button"
                        onClick={handleCaptureFromCamera}
                        className="h-7 px-3 rounded-md bg-foreground text-background text-xs font-medium hover:opacity-90"
                      >
                        Capturer cette vue
                      </button>
                      <button
                        type="button"
                        onClick={handleStopCamera}
                        className="h-7 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3 : Gestion des Variantes de Tailles */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                3. Déclinaisons de Tailles & Exemplaires
              </h4>
              <button
                type="button"
                onClick={handleAddVariantRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted text-xs font-medium text-primary border border-border"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une taille
              </button>
            </div>

            <div className="space-y-2">
              {variantsList.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border text-xs"
                >
                  <div className="w-32">
                    <label className="text-[10px] text-muted-foreground block mb-0.5 font-semibold">
                      Taille / Pointure
                    </label>
                    <input
                      type="text"
                      value={row.size}
                      onChange={(e) => {
                        const next = [...variantsList];
                        next[idx].size = e.target.value;
                        setVariantsList(next);
                      }}
                      className="w-full h-7 px-2 rounded bg-background border border-border font-mono font-bold"
                      placeholder="48, 50, 42..."
                    />
                  </div>

                  <div className="w-36">
                    <label className="text-[10px] text-muted-foreground block mb-0.5 font-semibold">
                      Coupe / Drop
                    </label>
                    <input
                      type="text"
                      value={row.subSize}
                      onChange={(e) => {
                        const next = [...variantsList];
                        next[idx].subSize = e.target.value;
                        setVariantsList(next);
                      }}
                      className="w-full h-7 px-2 rounded bg-background border border-border"
                      placeholder="Standard, Drop 8..."
                    />
                  </div>

                  <div className="w-28">
                    <label className="text-[10px] text-muted-foreground block mb-0.5 font-semibold">
                      Quantité reçue
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={row.quantity}
                      onChange={(e) => {
                        const next = [...variantsList];
                        next[idx].quantity = parseInt(e.target.value) || 1;
                        setVariantsList(next);
                      }}
                      className="w-full h-7 px-2 rounded bg-background border border-border font-bold text-center"
                    />
                  </div>

                  <div className="flex-1 text-[11px] text-muted-foreground pt-3 font-mono">
                    Générera {row.quantity} code-barre(s) unitaire(s)
                  </div>

                  {variantsList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveVariantRow(idx)}
                      className="p-1 rounded text-red-400 hover:text-red-300 pt-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary hover:bg-muted text-foreground border border-border"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer & Générer les Étiquettes QR</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
