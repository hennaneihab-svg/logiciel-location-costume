/**
 * UniversalSearchModal.tsx
 * Modal de recherche universelle — raccourci Ctrl+K / Cmd+K
 * Cherche simultanément dans : Articles, Clients, Locations
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Search, Shirt, Users, CalendarDays, X, ArrowRight, Package } from "lucide-react";
import { useStockStore } from "@/store/stockStore";
import { useClientStore } from "@/store/clientStore";
import { useRentalStore } from "@/store/rentalStore";
import { modalVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "article" | "client" | "location";
  title: string;
  subtitle: string;
  path: string;
  icon: React.ElementType;
  color: string;
  meta?: string;
}

interface UniversalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const articles = useStockStore((s) => s.articles);
  const clients = useClientStore((s) => s.clients);
  const contracts = useRentalStore((s) => s.contracts);

  // Calcul des résultats filtrés
  const results: SearchResult[] = React.useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    // ── Articles ──
    articles.forEach((art) => {
      if (
        art.name.toLowerCase().includes(q) ||
        art.reference.toLowerCase().includes(q) ||
        art.brand?.toLowerCase().includes(q) ||
        art.variants.some((v) => v.barcode.toLowerCase().includes(q))
      ) {
        const dispo = art.variants.filter((v) => v.status === "disponible").length;
        out.push({
          id: art.id,
          type: "article",
          title: art.name,
          subtitle: `Réf. ${art.reference} · ${art.brand || "Sans marque"}`,
          path: "/stock",
          icon: Shirt,
          color: "text-amber-500",
          meta: `${dispo}/${art.variants.length} dispo`,
        });
      }
    });

    // ── Clients ──
    clients.forEach((c) => {
      const fullName = `${c.first_name} ${c.last_name}`;
      if (
        fullName.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      ) {
        out.push({
          id: c.id,
          type: "client",
          title: fullName,
          subtitle: c.phone || c.email || "Aucun contact",
          path: "/clients",
          icon: Users,
          color: "text-blue-500",
          meta: c.is_blacklisted ? "Blacklisté" : undefined,
        });
      }
    });

    // ── Locations ──
    contracts.forEach((ct) => {
      if (
        ct.contract_number.toLowerCase().includes(q) ||
        ct.customer_name?.toLowerCase().includes(q) ||
        ct.status.toLowerCase().includes(q)
      ) {
        const statusLabel: Record<string, string> = {
          en_cours: "En cours",
          reserve: "Réservé",
          retourne: "Retourné",
          en_retard: "En retard",
          annule: "Annulé",
          brouillon: "Brouillon",
          litige: "Litige",
        };
        out.push({
          id: ct.id,
          type: "location",
          title: ct.contract_number,
          subtitle: ct.customer_name || "Client inconnu",
          path: "/locations",
          icon: CalendarDays,
          color: ct.status === "en_retard" ? "text-red-500" : "text-emerald-500",
          meta: statusLabel[ct.status] || ct.status,
        });
      }
    });

    return out.slice(0, 12); // max 12 résultats
  }, [query, articles, clients, contracts]);

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && results[cursor]) {
        handleSelect(results[cursor]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [results, cursor]
  );

  // Scroll curseur dans la liste
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    onClose();
  };

  const groupedTypes: Array<SearchResult["type"]> = ["article", "client", "location"];
  const typeLabels: Record<SearchResult["type"], string> = {
    article: "Articles",
    client: "Clients",
    location: "Locations",
  };
  const typeIcons: Record<SearchResult["type"], React.ElementType> = {
    article: Shirt,
    client: Users,
    location: CalendarDays,
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 pointer-events-none">
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="pointer-events-auto w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            >
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher un article, client, numéro de location..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">
                  Esc
                </kbd>
              </div>

              {/* Résultats */}
              <div
                ref={listRef}
                className="max-h-[60vh] overflow-y-auto py-2"
              >
                {query.length < 2 ? (
                  // Hint état vide
                  <div className="px-4 py-8 text-center space-y-2">
                    <Package className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs text-muted-foreground">
                      Tapez au moins 2 caractères pour rechercher dans articles, clients et locations
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-3">
                      {groupedTypes.map((type) => {
                        const Icon = typeIcons[type];
                        return (
                          <span key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                            <Icon className="w-3 h-3" /> {typeLabels[type]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                      Aucun résultat pour <span className="font-medium text-foreground">"{query}"</span>
                    </p>
                  </div>
                ) : (
                  (() => {
                    let globalIdx = 0;
                    return groupedTypes.map((type) => {
                      const group = results.filter((r) => r.type === type);
                      if (group.length === 0) return null;
                      return (
                        <div key={type}>
                          {/* Section header */}
                          <div className="px-4 py-1.5 flex items-center gap-2">
                            {React.createElement(typeIcons[type], { className: "w-3 h-3 text-muted-foreground" })}
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {typeLabels[type]}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">({group.length})</span>
                          </div>
                          {group.map((result) => {
                            const idx = globalIdx++;
                            const Icon = result.icon;
                            const isActive = idx === cursor;
                            return (
                              <button
                                key={result.id}
                                onClick={() => handleSelect(result)}
                                onMouseEnter={() => setCursor(idx)}
                                className={cn(
                                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                  isActive ? "bg-primary/10" : "hover:bg-muted/60"
                                )}
                              >
                                <div className={cn(
                                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                  isActive ? "bg-primary/20" : "bg-secondary"
                                )}>
                                  <Icon className={cn("w-3.5 h-3.5", result.color)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">{result.title}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{result.subtitle}</p>
                                </div>
                                {result.meta && (
                                  <span className="text-[10px] text-muted-foreground/70 shrink-0">{result.meta}</span>
                                )}
                                {isActive && <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    });
                  })()
                )}
              </div>

              {/* Footer */}
              {results.length > 0 && (
                <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{results.length} résultat{results.length > 1 ? "s" : ""}</span>
                  <div className="flex items-center gap-3">
                    <span><kbd className="font-mono bg-secondary border border-border px-1 rounded">↑↓</kbd> naviguer</span>
                    <span><kbd className="font-mono bg-secondary border border-border px-1 rounded">Enter</kbd> ouvrir</span>
                    <span><kbd className="font-mono bg-secondary border border-border px-1 rounded">Esc</kbd> fermer</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
