import React, { useState, useMemo } from "react";
import { Search, QrCode, Plus, Check, ShoppingBag } from "lucide-react";
import { useStockStore } from "@/store/stockStore";
import { useCaisseStore } from "@/store/caisseStore";
import { formatCents } from "@/lib/utils";
import type { StockArticle, StockVariant } from "@/types/stock";
import { toast } from "sonner";

interface CaisseCatalogProps {
  onOpenScanModal: () => void;
}

export const CaisseCatalog: React.FC<CaisseCatalogProps> = ({ onOpenScanModal }) => {
  const { articles } = useStockStore();
  const { cart, addToCart } = useCaisseStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Liste des catégories dynamiques
  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category_name));
    return ["all", ...Array.from(set)];
  }, [articles]);

  // Filtrage des articles éligibles à la vente
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      // Recherche textuelle
      const matchSearch =
        searchQuery.trim() === "" ||
        article.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.variants.some((v) =>
          v.barcode.toLowerCase().includes(searchQuery.toLowerCase())
        );

      // Catégorie
      const matchCat =
        selectedCategory === "all" || article.category_name === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [articles, searchQuery, selectedCategory]);

  const handleAdd = (article: StockArticle, variant?: StockVariant) => {
    addToCart(article, variant);
    toast.success(`Ajouté au panier`, {
      description: `${article.name} • ${formatCents(
        article.sale_price_cents || article.rental_price_cents
      )}`,
      duration: 1800,
    });
  };

  // Calcule la quantité d'un article déjà dans le panier
  const getCartQuantity = (articleId: string) => {
    const items = cart.filter((i) => i.article_id === articleId);
    return items.reduce((sum, it) => sum + it.quantity, 0);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Barre de recherche et bouton Scan */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Recherche par nom, référence ou code-barre..."
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenScanModal}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-semibold transition-all shadow-sm group"
        >
          <QrCode className="w-4 h-4 transition-transform group-hover:scale-110" />
          <span>Scanner QR / Code-Barre</span>
        </button>
      </div>

      {/* Filtres par Catégorie */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50"
            }`}
          >
            {cat === "all" ? "Toutes Catégories" : cat}
          </button>
        ))}
      </div>

      {/* Grille des Articles */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredArticles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 border border-dashed border-border rounded-xl bg-card/40">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">Aucun article trouvé</p>
            <p className="text-xs text-muted-foreground mt-1">
              Modifiez votre recherche ou utilisez le scan de code-barre.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredArticles.map((article) => {
              const priceCents = article.sale_price_cents || article.rental_price_cents;
              const cartQty = getCartQuantity(article.id);
              const availableVariants = article.variants.filter(
                (v) => v.status === "disponible"
              );

              return (
                <div
                  key={article.id}
                  className="group relative flex flex-col bg-card border border-border rounded-xl p-3 hover:border-primary/50 hover:shadow-md transition-all duration-150"
                >
                  {/* Photo / Vignette */}
                  <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-muted mb-2.5">
                    {article.photos?.[0] ? (
                      <img
                        src={article.photos[0]}
                        alt={article.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ShoppingBag className="w-8 h-8 opacity-40" />
                      </div>
                    )}

                    {/* Badge Catégorie */}
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white backdrop-blur-xs">
                      {article.category_name}
                    </span>

                    {/* Quantité déjà dans le panier */}
                    {cartQty > 0 && (
                      <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground shadow-md animate-in fade-in">
                        <Check className="w-3 h-3" />
                        {cartQty}
                      </span>
                    )}
                  </div>

                  {/* Informations Article */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {article.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span>{article.brand}</span>
                        <span>•</span>
                        <span className="font-mono">{article.reference}</span>
                      </p>
                    </div>

                    {/* Prix et Action */}
                    <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground block text-[10px] uppercase font-semibold">
                          Prix Vente
                        </span>
                        <span className="text-sm font-bold text-foreground">
                          {formatCents(priceCents)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAdd(article, availableVariants[0])}
                        className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-sm"
                        title="Ajouter au panier"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
