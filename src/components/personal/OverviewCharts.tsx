/**
 * Recharts wrappers extracted from PersonalOverview so the chart library
 * lands in its own chunk and only loads when the Overview tab renders.
 * Three named exports, one shared module → one network round-trip.
 */
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { fmtMoney } from "@/lib/personal-finance";

export function DonutChart({
  data, currency,
}: { data: Array<{ id: string; name: string; value: number; color: string }>; currency: string }) {
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
          {data.map((d) => <Cell key={d.id} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function IncomeExpenseBars({
  data, currency,
}: { data: Array<{ label: string; income: number; expense: number }>; currency: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" fontSize={10} stroke="var(--muted-foreground)" />
        <YAxis fontSize={10} stroke="var(--muted-foreground)" />
        <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
        <Bar dataKey="income" fill="#16a34a" />
        <Bar dataKey="expense" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NetWorthLine({
  data, currency,
}: { data: Array<{ label: string; value: number }>; currency: string }) {
  return (
    <ResponsiveContainer>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" fontSize={10} stroke="var(--muted-foreground)" />
        <YAxis fontSize={10} stroke="var(--muted-foreground)" />
        <Tooltip formatter={(v: number) => fmtMoney(v, currency)} />
        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
