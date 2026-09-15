import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { CaEvolutionPoint } from "@/types/dashboard";

interface CaEvolutionChartProps {
  data: CaEvolutionPoint[];
}

export const CaEvolutionChart: React.FC<CaEvolutionChartProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    label: d.label,
    date: d.date,
    ca_locations: d.ca_locations_centimes,
    ca_ventes: d.ca_ventes_centimes,
    ca_total: d.ca_total_centimes,
  }));

  return (
    <div className="p-5 rounded-xl bg-card border border-border shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Évolution du Chiffre d'Affaires sur la Période
          </h3>
          <p className="text-xs text-muted-foreground">
            Recettes générées par les locations et ventes d'accessoires (DA)
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-500" />
            <span className="text-muted-foreground">Locations</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Ventes directes</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorLocations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4a853" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#d4a853" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorVentes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="label"
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val.toLocaleString("fr-FR")} DA`}
            />
            <Tooltip
              formatter={(val: number, name: string) => [
                `${val.toLocaleString("fr-FR")} DA`,
                name === "ca_locations" ? "Locations" : name === "ca_ventes" ? "Ventes" : "Total",
              ]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "12px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
              }}
            />
            <Area
              type="monotone"
              dataKey="ca_locations"
              stroke="#d4a853"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorLocations)"
              isAnimationActive={true}
              animationDuration={1200}
            />
            <Area
              type="monotone"
              dataKey="ca_ventes"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorVentes)"
              isAnimationActive={true}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
