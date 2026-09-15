import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { formatCents } from "@/lib/utils";
import type { CategoryBreakdown } from "@/types/dashboard";

interface CategoryPieChartProps {
  data: CategoryBreakdown[];
}

const COLORS = ["#d4a853", "#3b82f6", "#10b981", "#a855f7"];

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    name: d.categorie_nom,
    value: d.montant_centimes,
    pourcentage: d.pourcentage,
    rawCentimes: d.montant_centimes,
    nombreArticles: d.nombre_articles_loues,
  }));

  const totalCentimes = data.reduce((sum, d) => sum + d.montant_centimes, 0);

  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Répartition du CA par Catégorie
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          Poids des familles de produits sur la période
        </p>
      </div>

      <div className="relative h-48 w-full my-auto flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(val: number, name: string) => [
                `${val.toLocaleString("fr-FR")} DA`,
                name,
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "12px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
              }}
            />
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              animationBegin={200}
              animationDuration={1000}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Total au centre du Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Total</span>
          <span className="text-xs font-bold text-foreground">{formatCents(totalCentimes)}</span>
        </div>
      </div>

      {/* Légende détaillée */}
      <div className="space-y-2 pt-3 border-t border-border">
        {data.map((item, idx) => (
          <div key={item.categorie_nom} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-foreground truncate max-w-[130px] font-medium">
                {item.categorie_nom}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{item.pourcentage}%</span>
              <span className="font-semibold text-foreground">
                {formatCents(item.montant_centimes)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
