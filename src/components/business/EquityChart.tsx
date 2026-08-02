/**
 * Recharts donut for business equity ownership. Kept in its own module so the
 * chart library only loads when the Equity tab renders.
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type EquitySlice = { id: string; name: string; value: number; color: string };

function TooltipCard({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: EquitySlice }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const slice = p.payload;
  const v = Number(p.value) || 0;
  const pct = v % 1 === 0 ? v.toFixed(0) : v.toFixed(2);
  return (
    <div
      style={{
        background: "color-mix(in oklab, var(--popover) 88%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "0 10px 30px -12px rgb(0 0 0 / 0.5)",
        border: "none",
        outline: "none",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          style={{ background: slice.color }}
          className="h-2.5 w-2.5 rounded-full"
        />
        <span className="text-xs font-medium" style={{ color: "var(--popover-foreground)" }}>
          {p.name}
        </span>
      </div>
      <div
        className="mt-0.5 font-mono tabular-nums text-sm font-semibold"
        style={{ color: "var(--popover-foreground)" }}
      >
        {pct}%
      </div>
    </div>
  );
}

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
          // prevent the focus ring / active border on click
          tabIndex={-1}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.id} fill={d.color} tabIndex={-1} />
          ))}
        </Pie>
        <Tooltip
          cursor={{ fill: "transparent", stroke: "transparent" }}
          wrapperStyle={{ outline: "none", border: "none" }}
          content={<TooltipCard />}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
