import React, { useMemo, useState } from "react";
import {
  Search,
  FileText,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MessageCircle,
  CreditCard,
} from "lucide-react";
import { formatCents } from "@/lib/utils";
import { useRentalStore } from "@/store/rentalStore";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "sonner";
import { ouvrirWhatsApp } from "@/lib/whatsapp";
import { buildConfirmationReservationMessage } from "@/lib/whatsappTemplates";
import type { RentalContractStatus, RentalContract } from "@/types/rental";
import { RentalPaymentModal } from "@/components/rentals/RentalPaymentModal";

export const RentalTableView: React.FC = () => {
  const [paymentModalContract, setPaymentModalContract] = useState<RentalContract | null>(null);
  const {
    contracts,
    activeFilter,
    setFilter,
    searchQuery,
    setSearchQuery,
    setPdfPreviewModalOpen,
    setReturnModalOpen,
  } = useRentalStore();

  const logAuditEvent = useSettingsStore((s) => s.logAuditEvent);

  const handleWhatsAppReservation = async (contract: RentalContract) => {
    if (!contract.customer_phone) {
      toast.error("Aucun numéro de téléphone disponible pour ce client.");
      return;
    }

    const articlesText = contract.items.map((i) => `${i.article_name} (T.${i.size})`).join(", ");
    const message = buildConfirmationReservationMessage(
      contract.customer_name,
      articlesText || "Articles réservés",
      contract.pickup_date,
      contract.return_date_scheduled
    );

    const res = await ouvrirWhatsApp(contract.customer_phone, message);
    if (res.success) {
      logAuditEvent(
        "WHATSAPP_REMINDER",
        "locations",
        contract.id,
        `Confirmation WhatsApp de réservation envoyée à ${contract.customer_name} (${contract.customer_phone}) pour le contrat ${contract.contract_number}`
      );
      toast.success(`Message de confirmation de réservation ouvert sur WhatsApp pour ${contract.customer_name} !`);
    } else {
      toast.error(res.error || "Impossible d'ouvrir WhatsApp");
    }
  };

  const getStatusBadge = (status: RentalContractStatus) => {
    switch (status) {
      case "en_cours":
        return {
          label: "En cours",
          className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          icon: Clock,
        };
      case "reserve":
        return {
          label: "Réservé",
          className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
          icon: Calendar,
        };
      case "en_retard":
        return {
          label: "En retard",
          className: "bg-red-500/15 text-red-400 border-red-500/30 font-extrabold",
          icon: AlertTriangle,
        };
      case "retourne":
        return {
          label: "Restitué conforme",
          className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
          icon: CheckCircle2,
        };
      case "litige":
        return {
          label: "Litige dégradation",
          className: "bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold",
          icon: AlertTriangle,
        };
      default:
        return {
          label: status,
          className: "bg-secondary text-muted-foreground",
          icon: Clock,
        };
    }
  };

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      // 1. Filtre statut
      if (activeFilter !== "all" && c.status !== activeFilter) {
        return false;
      }

      // 2. Recherche texte
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = c.contract_number.toLowerCase().includes(q);
        const matchClient = c.customer_name.toLowerCase().includes(q);
        const matchPhone = c.customer_phone.includes(q);
        const matchItem = c.items.some(
          (i) =>
            i.article_name.toLowerCase().includes(q) ||
            i.barcode.toLowerCase().includes(q)
        );

        if (!matchNum && !matchClient && !matchPhone && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [contracts, activeFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Barre de Recherche & Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-4 rounded-xl bg-card border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par n° de contrat, nom du client, téléphone ou modèle loué..."
            className="w-full h-9 pl-10 pr-4 rounded-lg bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Boutons Filtres */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {[
            { id: "all", label: "Toutes" },
            { id: "en_cours", label: "En cours" },
            { id: "reserve", label: "Réservées" },
            { id: "en_retard", label: "En retard" },
            { id: "retourne", label: "Restituées" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                activeFilter === tab.id
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau des contrats */}
      <div className="rounded-xl bg-card border border-border overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-3 px-4">N° Contrat</th>
              <th className="py-3 px-4">Client & Contact</th>
              <th className="py-3 px-4">Articles & Tailles</th>
              <th className="py-3 px-4">Dates Retrait / Retour</th>
              <th className="py-3 px-4">Montant TTC</th>
              <th className="py-3 px-4">Caution & Règlement</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredContracts.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground italic">
                  Aucun contrat ne correspond à ces critères.
                </td>
              </tr>
            ) : (
              filteredContracts.map((contract) => {
                const badge = getStatusBadge(contract.status);
                const Icon = badge.icon;
                const canReturn =
                  contract.status === "en_cours" ||
                  contract.status === "en_retard";

                return (
                  <tr key={contract.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {contract.contract_number}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
                        {contract.customer_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {contract.customer_phone}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-[200px]">
                      {contract.items.map((item, idx) => (
                        <div key={idx} className="truncate">
                          <span className="font-medium text-foreground">
                            {item.article_name}
                          </span>{" "}
                          <span className="text-[10px] px-1 py-0.2 rounded bg-muted font-mono">
                            T.{item.size}
                          </span>
                        </div>
                      ))}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-foreground">
                        Du <strong className="font-semibold">{contract.pickup_date}</strong>
                      </div>
                      <div className="text-muted-foreground">
                        Au <strong className="font-semibold text-foreground">{contract.return_date_scheduled}</strong>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-bold text-foreground">
                      {formatCents(contract.total_amount_cents)}
                      {contract.discount_cents > 0 && (
                        <div className="text-[10px] text-emerald-500 font-normal">
                          Remise incluse
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">
                        {formatCents(contract.deposit_amount_cents)}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          ({contract.deposit_method})
                        </span>
                      </div>
                      <div className="text-[10px]">
                        {contract.remaining_amount_cents > 0 ? (
                          <span className="text-red-400 font-semibold">
                            Reste dû : {formatCents(contract.remaining_amount_cents)}
                          </span>
                        ) : (
                          <span className="text-emerald-500 font-semibold">
                            Règlement soldé
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5">
                      {contract.status === "reserve" && (
                        <button
                          type="button"
                          onClick={() => handleWhatsAppReservation(contract)}
                          disabled={!contract.customer_phone}
                          title={
                            contract.customer_phone
                              ? "Envoyer la confirmation de réservation par WhatsApp"
                              : "Aucun numéro de téléphone disponible"
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                            contract.customer_phone
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
                              : "opacity-40 cursor-not-allowed bg-secondary text-muted-foreground border border-border"
                          }`}
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Confirmer WhatsApp</span>
                        </button>
                      )}

                      {canReturn && (
                        <button
                          type="button"
                          onClick={() => setReturnModalOpen(true, contract)}
                          title="Contrôler l'état et enregistrer le retour"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-muted text-xs font-semibold text-amber-500 border border-border"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retour</span>
                        </button>
                      )}

                      {contract.remaining_amount_cents > 0 && (
                        <button
                          type="button"
                          onClick={() => setPaymentModalContract(contract)}
                          title="Encaisser le solde du contrat"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white text-xs font-semibold border border-emerald-500/30 transition-all shadow-xs"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>Régler</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setPdfPreviewModalOpen(true, contract)}
                        title="Voir et imprimer le bon de location en 2 exemplaires"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Bon PDF</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {paymentModalContract && (
        <RentalPaymentModal
          contract={paymentModalContract}
          onClose={() => setPaymentModalContract(null)}
        />
      )}
    </div>
  );
};
