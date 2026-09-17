import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Printer,
  History,
  Lock,
} from "lucide-react";
import { useCaisseStore } from "@/store/caisseStore";
import { formatCents } from "@/lib/utils";
import { CaisseCatalog } from "@/components/caisse/CaisseCatalog";
import { CaisseCart } from "@/components/caisse/CaisseCart";
import { ScanQrModal } from "@/components/caisse/ScanQrModal";
import { CaissePaymentModal } from "@/components/caisse/CaissePaymentModal";
import { ReceiptModal } from "@/components/caisse/ReceiptModal";
import { ClotureCaisseView } from "@/components/caisse/ClotureCaisseView";
import type { DirectSale } from "@/types/caisse";

type CaisseTab = "pos" | "history" | "cloture";

export const CaissePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CaisseTab>("pos");

  // Modals state
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<DirectSale | null>(null);

  const { cart, salesHistory, todayCloture } = useCaisseStore();

  const isCaisseClosed = todayCloture !== null && todayCloture.status === "cloturee";

  const handleSaleSuccess = (sale: DirectSale) => {
    setSelectedSaleForReceipt(sale);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* 1. En-tête Page & Navigation Onglets */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Caisse &amp; Point de Vente
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Encaissement direct, gestion des règlements et clôture journalière
          </p>
        </div>

        {/* Onglets de Caisse */}
        <div className="flex items-center bg-muted/50 p-1 rounded-md border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === "pos"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Vente &amp; Panier</span>
            {cart.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "history"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique Ventes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cloture")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "cloture"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Clôture Journalière</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isCaisseClosed ? "bg-red-500" : "bg-emerald-500 animate-pulse"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. Contenu par Onglet */}
      <AnimatePresence mode="wait">
        {activeTab === "pos" && (
          <motion.div
            key="pos"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Colonne Catalogue (8 colonnes) */}
            <div className="lg:col-span-8 h-[calc(100vh-190px)] min-h-[560px]">
              <CaisseCatalog onOpenScanModal={() => setIsScanModalOpen(true)} />
            </div>

            {/* Colonne Panier (4 colonnes) */}
            <div className="lg:col-span-4 h-[calc(100vh-190px)] min-h-[560px]">
              <CaisseCart onCheckout={() => setIsPaymentModalOpen(true)} />
            </div>
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-card border border-border rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Historique des Ventes Directes Comptoir
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Toutes les transactions passées en caisse avec réimpression des tickets
                </p>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {salesHistory.length} vente{salesHistory.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/60 text-muted-foreground uppercase text-[10px] font-semibold border-y border-border">
                  <tr>
                    <th className="py-3 px-4">N° Vente</th>
                    <th className="py-3 px-4">Date / Heure</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Vendeur</th>
                    <th className="py-3 px-4">Articles</th>
                    <th className="py-3 px-4">Moyen Paiement</th>
                    <th className="py-3 px-4 text-right">Total TTC</th>
                    <th className="py-3 px-4 text-center">Ticket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {salesHistory.map((sale) => (
                    <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {sale.sale_number}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {sale.customer_name}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{sale.user_name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-medium">
                          {sale.items.reduce((acc, it) => acc + it.quantity, 0)} article(s)
                        </span>
                      </td>
                      <td className="py-3 px-4 capitalize text-muted-foreground">
                        {sale.payment.method.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatCents(sale.total_amount_cents)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedSaleForReceipt(sale)}
                          className="p-1.5 rounded-lg border border-border hover:bg-secondary text-primary transition-colors"
                          title="Imprimer / Télécharger le ticket"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === "cloture" && (
          <motion.div
            key="cloture"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <ClotureCaisseView />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <ScanQrModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
      />

      <CaissePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={handleSaleSuccess}
      />

      <ReceiptModal
        isOpen={selectedSaleForReceipt !== null}
        sale={selectedSaleForReceipt}
        onClose={() => setSelectedSaleForReceipt(null)}
      />
    </motion.div>
  );
};
