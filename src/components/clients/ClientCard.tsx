import React from "react";
import { motion } from "framer-motion";
import {
  Phone,
  MapPin,
  CreditCard,
  Star,
  ShieldAlert,
  Calendar,
  DollarSign,
  Plus,
  Eye,
} from "lucide-react";
import { formatCents } from "@/lib/utils";
import {
  useClientStore,
  getClientTotalSpentCents,
  getClientRentalsCount,
  isClientLoyal,
} from "@/store/clientStore";
import type { CustomerDetailed } from "@/types/customer";
import { toast } from "sonner";

interface ClientCardProps {
  client: CustomerDetailed;
}

export const ClientCard: React.FC<ClientCardProps> = ({ client }) => {
  const {
    setSelectedClient,
    setDetailModalOpen,
    openBlacklistAlertForRental,
  } = useClientStore();

  const totalSpent = getClientTotalSpentCents(client);
  const rentalsCount = getClientRentalsCount(client);
  const loyal = isClientLoyal(client);

  // Détection des locations actives ou en retard
  const hasLateRental = client.rentals.some((r) => r.status === "en_retard");
  const hasActiveRental = client.rentals.some(
    (r) => r.status === "en_cours" || r.status === "reserve"
  );

  const handleOpenDetail = () => {
    setSelectedClient(client);
    setDetailModalOpen(true);
  };

  const handleNewRental = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (client.is_blacklisted) {
      openBlacklistAlertForRental(client);
    } else {
      toast.info(
        `Création d'une nouvelle location pour ${client.first_name} ${client.last_name}...`
      );
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={handleOpenDetail}
      className={`p-4 rounded-xl bg-card border transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md ${
        client.is_blacklisted
          ? "border-red-500/40 hover:border-red-500/70 bg-red-500/[0.02]"
          : "border-border hover:border-primary/50"
      }`}
    >
      <div>
        {/* Header Carte : Avatar + Nom + Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                client.is_blacklisted
                  ? "bg-red-500/15 text-red-500 border-red-500/30"
                  : loyal
                  ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                  : "bg-secondary text-foreground border-border"
              }`}
            >
              {client.first_name[0]}
              {client.last_name[0]}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                  {client.first_name} {client.last_name}
                </h3>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                <CreditCard className="w-3 h-3 text-muted-foreground/70" />
                <span>{client.identity_card_number || "CNI non renseignée"}</span>
              </p>
            </div>
          </div>

          {/* Badges d'état prioritaires */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {client.is_blacklisted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/15 text-red-500 border border-red-500/30">
                <ShieldAlert className="w-3 h-3" />
                <span>Liste Noire</span>
              </span>
            )}

            {loyal && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span>Client fidèle</span>
              </span>
            )}

            {!client.is_blacklisted && !loyal && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-muted-foreground border border-border">
                {rentalsCount > 0 ? "Actif" : "Nouveau"}
              </span>
            )}
          </div>
        </div>

        {/* Coordonnées */}
        <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-mono text-foreground font-semibold">
              {client.phone}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{client.city}</span>
          </div>
        </div>

        {/* Indicateurs Financiers & Statut Location */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border text-xs mb-3">
          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Dépensé
            </span>
            <span className="font-black text-foreground text-sm flex items-center gap-0.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              {formatCents(totalSpent)}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Locations
            </span>
            <span className="font-black text-foreground text-sm flex items-center gap-0.5">
              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
              {rentalsCount} contrat(s)
            </span>
          </div>
        </div>

        {/* État des locations en cours */}
        <div className="text-[11px] mb-2">
          {hasLateRental ? (
            <span className="text-red-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              1 contrat en retard de restitution
            </span>
          ) : hasActiveRental ? (
            <span className="text-amber-500 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Contrat en cours ou réservé
            </span>
          ) : (
            <span className="text-muted-foreground">
              Aucune location active actuellement
            </span>
          )}
        </div>
      </div>

      {/* Actions Carte */}
      <div className="pt-3 border-t border-border flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpenDetail}
          className="flex-1 py-1.5 px-2.5 rounded-lg bg-secondary hover:bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 border border-border transition-colors"
        >
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span>Fiche Détail</span>
        </button>

        <button
          type="button"
          onClick={handleNewRental}
          title={
            client.is_blacklisted
              ? "Alerte : Client en liste noire"
              : "Créer une nouvelle location"
          }
          className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
            client.is_blacklisted
              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Louer</span>
        </button>
      </div>
    </motion.div>
  );
};
