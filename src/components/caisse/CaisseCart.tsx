import React from "react";
import {
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  CreditCard,
  User,
  ArrowRight,
} from "lucide-react";
import { useCaisseStore } from "@/store/caisseStore";
import { useClientStore } from "@/store/clientStore";
import { formatCents } from "@/lib/utils";

interface CaisseCartProps {
  onCheckout: () => void;
}

export const CaisseCart: React.FC<CaisseCartProps> = ({ onCheckout }) => {
  const {
    cart,
    selectedCustomer,
    updateQuantity,
    removeFromCart,
    clearCart,
    setSelectedCustomer,
  } = useCaisseStore();

  const { clients } = useClientStore();

  const totalCents = cart.reduce((sum, item) => sum + item.subtotal_cents, 0);
  const taxRate = 0.2;
  const totalHtCents = Math.round(totalCents / (1 + taxRate));
  const tvaCents = totalCents - totalHtCents;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl p-4 shadow-sm">
      {/* En-tête Panier */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Panier en cours</h3>
            <p className="text-[11px] text-muted-foreground">
              {totalItemsCount} article{totalItemsCount > 1 ? "s" : ""} sélectionné{totalItemsCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {cart.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="text-[11px] text-red-500 hover:text-red-600 font-medium hover:underline"
          >
            Vider
          </button>
        )}
      </div>

      {/* Sélection Client (Optionnelle) */}
      <div className="py-3 border-b border-border">
        <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1.5">
          <User className="w-3.5 h-3.5" />
          <span>Client de la vente :</span>
        </label>
        <select
          value={selectedCustomer?.id || ""}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              setSelectedCustomer(null);
            } else {
              const cust = clients.find((c) => c.id === val);
              if (cust) {
                setSelectedCustomer({
                  id: cust.id,
                  name: `${cust.first_name} ${cust.last_name}`,
                  phone: cust.phone,
                });
              }
            }
          }}
          className="w-full h-8 px-2.5 text-xs rounded-lg bg-secondary/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">👤 Client Comptoir (Anonyme)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name} ({c.phone})
            </option>
          ))}
        </select>
        {selectedCustomer && (
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-primary bg-primary/10 px-2.5 py-1 rounded-md">
            <span className="font-medium truncate">{selectedCustomer.name}</span>
            <span className="text-[10px] text-muted-foreground">{selectedCustomer.phone}</span>
          </div>
        )}
      </div>

      {/* Liste des Articles du Panier */}
      <div className="flex-1 overflow-y-auto py-2 space-y-2.5 min-h-[160px]">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <ShoppingCart className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-xs font-medium text-foreground">Le panier est vide</p>
            <p className="text-[11px] mt-1">
              Cliquez sur un article du catalogue ou scannez un code-barre pour l'ajouter.
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary/30 border border-border/70 hover:border-primary/40 transition-colors"
            >
              {/* Photo */}
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted shrink-0">
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">
                    Item
                  </div>
                )}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-semibold text-foreground truncate">
                  {item.name}
                </h5>
                <p className="text-[10px] text-muted-foreground">
                  {item.size ? `Taille ${item.size} • ` : ""}
                  <span className="font-mono">{formatCents(item.unit_price_cents)}</span>
                </p>
              </div>

              {/* Sélecteur de Quantité */}
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-5 text-center text-xs font-bold text-foreground font-mono">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted text-xs"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Total Ligne & Suppression */}
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-foreground font-mono">
                  {formatCents(item.subtotal_cents)}
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors mt-0.5 p-0.5"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Résumé & Bouton Encaissement */}
      <div className="pt-3 border-t border-border space-y-2 mt-auto">
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Total HT</span>
            <span className="font-mono">{formatCents(totalHtCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>TVA (20%)</span>
            <span className="font-mono">{formatCents(tvaCents)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border/50">
            <span>TOTAL TTC</span>
            <span className="font-mono text-primary text-base">{formatCents(totalCents)}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={cart.length === 0}
          onClick={onCheckout}
          className="w-full mt-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all group"
        >
          <CreditCard className="w-4 h-4" />
          <span>Encaisser {formatCents(totalCents)}</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
