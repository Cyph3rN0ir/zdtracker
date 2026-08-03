/**
 * Lightweight pure-SVG donut for business equity ownership.
 * No chart library: renders instantly, no focus rings / tap highlights on mobile.
 */
import { useMemo, useState } from "react";

export type EquitySlice = { id: string; name: string; value: number; color: string };

const SIZE = 200;
const R = 78;
const STROKE = 26;
const C = 2 * Math.PI * R;
const GAP = 1.2; // percent of circumference used as separator

export function EquityDonut({ data }: { data: EquitySlice[] }) {
  const [active, setActive] = useState<string | null>(null);

  const arcs = useMemo(() => {
    const total = data.reduce((a, d) => a + (Number(d.value) || 0), 0) || 100;
    let acc = 0;
    return data.map((d) => {
      const frac = (Number(d.value) || 0) / total;
      const len = Math.max(0, frac * C - GAP);
      const arc = { ...d, len, offset: -acc * C };
      acc += frac;
      return arc;
    });
  }, [data]);

  const hovered = arcs.find((a) => a.id === active);
  const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));

  return (
    <div
      className="relative h-full w-full select-none"
      onPointerLeave={() => setActive(null)}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full -rotate-90 outline-none [-webkit-tap-highlight-color:transparent]"
        focusable="false"
        aria-hidden="true"
      >
        {arcs.map((a) => (
          <circle
            key={a.id}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={active === a.id ? STROKE + 5 : STROKE}
            strokeLinecap="butt"
            strokeDasharray={`${a.len} ${C - a.len}`}
            strokeDashoffset={a.offset}
            opacity={active && active !== a.id ? 0.45 : 1}
            style={{
              transition: "stroke-width 150ms ease, opacity 150ms ease",
              cursor: "pointer",
              outline: "none",
              WebkitTapHighlightColor: "transparent",
            }}
            onPointerDown={() => setActive(a.id)}
            onPointerEnter={() => setActive(a.id)}
          />
        ))}
      </svg>

      {hovered ? (
        <div className="pointer-events-none absolute inset-x-0 -bottom-1 flex justify-center">
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-lg backdrop-blur-md"
            style={{
              background: "color-mix(in oklab, var(--popover) 90%, transparent)",
              color: "var(--popover-foreground)",
            }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: hovered.color }}
            />
            <span className="max-w-[9rem] truncate font-medium">{hovered.name}</span>
            <span className="font-mono tabular-nums font-semibold">
              {fmt(Number(hovered.value) || 0)}%
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
