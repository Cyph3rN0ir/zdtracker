/**
 * Recharts donut for business equity ownership. Kept in its own module so the
 * chart library only loads when the Equity tab renders.
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type EquitySlice = { id: string; name: string; value: number; color: string };

export function EquityDonut({ data }: { data: EquitySlice[] }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="88%"
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.id} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number, n: string) => [`${Number(v).toFixed(2)}%`, n]}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
