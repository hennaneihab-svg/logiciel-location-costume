import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Layers } from "lucide-react";
import { useStockStore } from "@/store/stockStore";
import { StockAlertBanner } from "@/components/stock/StockAlertBanner";
import { StockFilterBar } from "@/components/stock/StockFilterBar";
import { StockCard } from "@/components/stock/StockCard";
import { CreateEditArticleModal } from "@/components/stock/CreateEditArticleModal";
import { ArticleDetailModal } from "@/components/stock/ArticleDetailModal";
import { QrLabelModal } from "@/components/stock/QrLabelModal";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { pageContainerVariants, fadeInUp } from "@/lib/animations";

export const StockPage: React.FC = () => {
  const { articles, filters, setCreateModalOpen } = useStockStore();

  // Skeleton au premier montage (simule le temps de chargement DB)
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // Filtrage réactif en temps réel
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // 1. Recherche texte
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const matchesName = art.name.toLowerCase().includes(q);
        const matchesBrand = art.brand.toLowerCase().includes(q);
        const matchesRef = art.reference.toLowerCase().includes(q);
        const matchesBarcode = art.variants.some((v) =>
          v.barcode.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesBrand && !matchesRef && !matchesBarcode) {
          return false;
        }
      }

      // 2. Catégorie
      if (filters.category !== "all" && art.category_id !== filters.category) {
        return false;
      }

      // 3. Taille
      if (filters.size !== "all") {
        const hasSize = art.variants.some((v) => v.size === filters.size);
        if (!hasSize) return false;
      }

      // 4. Statut
      if (filters.status !== "all") {
        if (filters.status === "disponible") {
          const hasDispo = art.variants.some((v) => v.status === "disponible");
          if (!hasDispo) return false;
        } else if (filters.status === "en_location" || filters.status === "loue") {
          const hasRented = art.variants.some((v) => v.status === "en_location");
          if (!hasRented) return false;
        } else if (filters.status === "reserve") {
          const hasReserved = art.variants.some((v) => v.status === "reserve");
          if (!hasReserved) return false;
        } else if (filters.status === "maintenance") {
          const hasMaintenance = art.variants.some(
            (v) => v.status === "au_pressing" || v.status === "en_retouche"
          );
          if (!hasMaintenance) return false;
        } else if (filters.status === "hors_service") {
          const hasBroken = art.variants.some(
            (v) => v.status === "indisponible" || v.status === "vendu"
          );
          if (!hasBroken) return false;
        }
      }

      // 5. Filtre d'alerte bandeau
      if (filters.alertFilter === "low_stock") {
        const dispoCount = art.variants.filter((v) => v.status === "disponible").length;
        if (dispoCount >= 2) return false;
      } else if (filters.alertFilter === "inactive_90d") {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        if (art.last_rented_date && new Date(art.last_rented_date) >= ninetyDaysAgo) {
          return false;
        }
      }

      return true;
    });
  }, [articles, filters]);

  // Calcul du total des pièces physiques
  const totalPieces = useMemo(() => {
    return articles.reduce((acc, art) => acc + art.variants.length, 0);
  }, [articles]);

  const totalDispo = useMemo(() => {
    return articles.reduce(
      (acc, art) =>
        acc + art.variants.filter((v) => v.status === "disponible").length,
      0
    );
  }, [articles]);

  return (
    <motion.div
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 select-none"
    >
      {/* Page Header */}
      <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Gestion du Stock &amp; Pièces Uniques
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 font-mono">
              {totalDispo} / {totalPieces} pièces disponibles
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inventaire photographique, suivi des variantes par code-barre, étiquettes QR Code et états de rotation
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un Article</span>
        </button>
      </motion.div>

      {/* Bandeau d'alertes */}
      <motion.div variants={fadeInUp}>
        <StockAlertBanner />
      </motion.div>

      {/* Barre de filtres */}
      <motion.div variants={fadeInUp}>
        <StockFilterBar />
      </motion.div>

      {/* Skeleton pendant le chargement initial */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="p-12 rounded-2xl bg-card border border-border text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center text-muted-foreground">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-foreground">
            Aucun article ne correspond à ces critères
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Modifiez vos filtres de taille, de catégorie ou le texte de recherche pour afficher les articles disponibles.
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          <AnimatePresence>
            {filteredArticles.map((article) => (
              <StockCard key={article.id} article={article} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals & Drawers */}
      <CreateEditArticleModal />
      <ArticleDetailModal />
      <QrLabelModal />
    </motion.div>
  );
};
