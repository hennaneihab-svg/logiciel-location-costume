import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  Search,
  Users,
  Star,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  DollarSign,
  UserCheck,
  Ruler,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { formatCents } from "@/lib/utils";

import {
  useClientStore,
  getClientTotalSpentCents,
  getClientRentalsCount,
  isClientLoyal,
} from "@/store/clientStore";
import { ClientCard } from "@/components/clients/ClientCard";
import { ClientDetailModal } from "@/components/clients/ClientDetailModal";
import { QuickCreateClientModal } from "@/components/clients/QuickCreateClientModal";
import { BlacklistDialog } from "@/components/clients/BlacklistDialog";
import { BlacklistAlertModal } from "@/components/clients/BlacklistAlertModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { pageContainerVariants } from "@/lib/animations";
import type { ClientSortOption, ClientFilterOption } from "@/types/customer";

export const ClientsPage: React.FC = () => {
  const {
    clients,
    search,
    setSearch,
    sortBy,
    setSortBy,
    filter,
    setFilter,
    setCreateModalOpen,
  } = useClientStore();

  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  // Filtre multicritères mensurations (MOD-2)
  const [isMensurationDrawerOpen, setIsMensurationDrawerOpen] = useState(false);
  const [minPoitrine, setMinPoitrine] = useState("");
  const [maxPoitrine, setMaxPoitrine] = useState("");
  const [minTaille, setMinTaille] = useState("");
  const [maxTaille, setMaxTaille] = useState("");
  const [minHanches, setMinHanches] = useState("");
  const [maxHanches, setMaxHanches] = useState("");
  const [minStature, setMinStature] = useState("");
  const [maxStature, setMaxStature] = useState("");
  const [minPointure, setMinPointure] = useState("");
  const [maxPointure, setMaxPointure] = useState("");
  const [matchedClientIds, setMatchedClientIds] = useState<Set<string> | null>(null);

  const hasActiveMensurationFilters = Boolean(
    minPoitrine || maxPoitrine || minTaille || maxTaille ||
    minHanches || maxHanches || minStature || maxStature ||
    minPointure || maxPointure
  );

  useEffect(() => {
    if (!hasActiveMensurationFilters) {
      setMatchedClientIds(null);
      return;
    }

    const filters = {
      min_tour_poitrine: minPoitrine ? parseFloat(minPoitrine) : null,
      max_tour_poitrine: maxPoitrine ? parseFloat(maxPoitrine) : null,
      min_tour_taille: minTaille ? parseFloat(minTaille) : null,
      max_tour_taille: maxTaille ? parseFloat(maxTaille) : null,
      min_tour_hanches: minHanches ? parseFloat(minHanches) : null,
      max_tour_hanches: maxHanches ? parseFloat(maxHanches) : null,
      min_stature: minStature ? parseFloat(minStature) : null,
      max_stature: maxStature ? parseFloat(maxStature) : null,
      min_pointure: minPointure ? parseFloat(minPointure) : null,
      max_pointure: maxPointure ? parseFloat(maxPointure) : null,
    };

    invoke<Array<{ id: string }>>("search_clients_by_mensurations", { filters })
      .then((res) => {
        setMatchedClientIds(new Set(res.map((r) => r.id)));
      })
      .catch((err) => {
        console.warn("Recherche mensurations non dispo :", err);
      });
  }, [
    minPoitrine, maxPoitrine, minTaille, maxTaille,
    minHanches, maxHanches, minStature, maxStature,
    minPointure, maxPointure, hasActiveMensurationFilters
  ]);


  // Statistiques globales de la clientèle
  const stats = useMemo(() => {
    const total = clients.length;
    const loyalCount = clients.filter((c) => isClientLoyal(c)).length;
    const blacklistedCount = clients.filter((c) => c.is_blacklisted).length;
    const totalRevenueCents = clients.reduce(
      (sum, c) => sum + getClientTotalSpentCents(c),
      0
    );

    return {
      total,
      loyalCount,
      blacklistedCount,
      totalRevenueCents,
    };
  }, [clients]);

  // Filtrage et Tri en temps réel
  const filteredAndSortedClients = useMemo(() => {
    return clients
      .filter((client) => {
        // 1. Recherche instantanée (Nom, Prénom, Téléphone, Email, CNI, Ville)
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const fullName = `${client.first_name} ${client.last_name}`.toLowerCase();
          const reverseName = `${client.last_name} ${client.first_name}`.toLowerCase();
          const phone = client.phone.replace(/\s+/g, "");
          const altPhone = (client.alternative_phone || "").replace(/\s+/g, "");
          const cleanQ = q.replace(/\s+/g, "");

          const matchesName =
            fullName.includes(q) || reverseName.includes(q);
          const matchesPhone =
            phone.includes(cleanQ) || altPhone.includes(cleanQ);
          const matchesEmail = client.email.toLowerCase().includes(q);
          const matchesCni = client.identity_card_number
            .toLowerCase()
            .includes(q);
          const matchesCity = client.city.toLowerCase().includes(q);

          if (
            !matchesName &&
            !matchesPhone &&
            !matchesEmail &&
            !matchesCni &&
            !matchesCity
          ) {
            return false;
          }
        }

        // 2. Filtres thématiques
        if (filter === "loyal" && !isClientLoyal(client)) {
          return false;
        }
        if (filter === "blacklisted" && !client.is_blacklisted) {
          return false;
        }
        if (filter === "active") {
          const hasActive = client.rentals.some(
            (r) =>
              r.status === "en_cours" ||
              r.status === "reserve" ||
              r.status === "en_retard"
          );
          if (!hasActive) return false;
        }

        // 2b. Filtre multicritères par mensurations (MOD-2)
        if (matchedClientIds !== null && !matchedClientIds.has(client.id)) {
          return false;
        }

        return true;
      })

      .sort((a, b) => {
        // 3. Tri
        if (sortBy === "spent_desc") {
          return getClientTotalSpentCents(b) - getClientTotalSpentCents(a);
        }
        if (sortBy === "rentals_desc") {
          return getClientRentalsCount(b) - getClientRentalsCount(a);
        }
        if (sortBy === "name_asc") {
          return a.last_name.localeCompare(b.last_name);
        }
        if (sortBy === "recent") {
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }
        return 0;
      });
  }, [clients, search, filter, sortBy]);

  return (
    <motion.div
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 select-none"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Répertoire Clients
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground border border-border font-mono">
              {stats.total} fiches
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fiches de contact, pièces d'identité garanties et suivi de fidélité
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Bandeau KPIs Global Clientèle */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Total Fiches
            </span>
            <div className="text-xl font-black text-foreground">{stats.total}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Clients Fidèles (&gt; 5 loc.)
            </span>
            <div className="text-xl font-black text-foreground">
              {stats.loyalCount}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              CA Total Généré
            </span>
            <div className="text-xl font-black text-foreground">
              {formatCents(stats.totalRevenueCents)}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border border-border shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              En Liste Noire
            </span>
            <div className="text-xl font-black text-red-500">
              {stats.blacklistedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Barre de Recherche Instantanée, Filtres & Sélecteur de Tri */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Champ Recherche Instantanée */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche instantanée par nom, téléphone (ex: 06 12...), email ou n° CNI..."
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/50 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Sélecteur de Tri */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
              <span>Trier par :</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ClientSortOption)}
              className="h-10 px-3 rounded-lg bg-secondary/50 border border-border text-xs text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="spent_desc">Montant dépensé (DA décroissant)</option>
              <option value="rentals_desc">Nombre de locations (décroissant)</option>
              <option value="name_asc">Nom alphabétique (A - Z)</option>
              <option value="recent">Date d'inscription récente</option>
            </select>
          </div>
        </div>

        {/* Filtres par Boutons / Onglets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-primary" />
            Filtre :
          </span>

          {[
            { id: "all", label: `Tous les clients (${clients.length})` },
            {
              id: "loyal",
              label: `Fidèles (> 5 loc.) (${stats.loyalCount})`,
            },
            {
              id: "blacklisted",
              label: `Liste Noire (${stats.blacklistedCount})`,
            },
            { id: "active", label: `Locations en cours` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as ClientFilterOption)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                filter === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Bouton bascule Filtre Mensurations (MOD-2) */}
          <button
            type="button"
            onClick={() => setIsMensurationDrawerOpen(!isMensurationDrawerOpen)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors border flex items-center gap-1.5 ml-auto ${
              hasActiveMensurationFilters
                ? "bg-status-fitting text-white border-status-fitting shadow-xs"
                : isMensurationDrawerOpen
                ? "bg-secondary text-foreground border-primary"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Filtres mensurations</span>
            {hasActiveMensurationFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
            {isMensurationDrawerOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Tiroir déroulant Filtre Mensurations */}
        {isMensurationDrawerOpen && (
          <div className="pt-3 border-t border-border/70 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Recherche multicritères par mensurations atelier (en cm)</span>
              </span>

              {hasActiveMensurationFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setMinPoitrine("");
                    setMaxPoitrine("");
                    setMinTaille("");
                    setMaxTaille("");
                    setMinHanches("");
                    setMaxHanches("");
                    setMinStature("");
                    setMaxStature("");
                    setMinPointure("");
                    setMaxPointure("");
                  }}
                  className="text-[11px] text-destructive hover:underline font-semibold"
                >
                  Réinitialiser critères
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block font-medium">Poitrine (cm)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPoitrine}
                    onChange={(e) => setMinPoitrine(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPoitrine}
                    onChange={(e) => setMaxPoitrine(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block font-medium">Taille (cm)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minTaille}
                    onChange={(e) => setMinTaille(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxTaille}
                    onChange={(e) => setMaxTaille(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block font-medium">Hanches (cm)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minHanches}
                    onChange={(e) => setMinHanches(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxHanches}
                    onChange={(e) => setMaxHanches(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block font-medium">Stature (cm)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minStature}
                    onChange={(e) => setMinStature(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxStature}
                    onChange={(e) => setMaxStature(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground block font-medium">Pointure</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPointure}
                    onChange={(e) => setMinPointure(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPointure}
                    onChange={(e) => setMaxPointure(e.target.value)}
                    className="w-full h-7 px-2 rounded-md bg-secondary/50 border border-border text-xs text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Grille des Cartes Clients ou Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredAndSortedClients.length === 0 ? (
        <div className="p-12 rounded-2xl bg-card border border-border text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary mx-auto flex items-center justify-center text-muted-foreground">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-foreground">
            Aucun client ne correspond à cette recherche
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Vérifiez l'orthographe du nom, le numéro de téléphone ou réinitialisez les filtres sélectionnés.
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {filteredAndSortedClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals & Dialogues Réutilisables */}
      <QuickCreateClientModal />
      <ClientDetailModal />
      <BlacklistDialog />
      <BlacklistAlertModal />
    </motion.div>
  );
};
