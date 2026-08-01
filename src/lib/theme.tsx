import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "midnight" | "forest" | "ember" | "noir" | "ocean" | "sand" | "zerodesk" | "infrared" | "paper" | "porcelain" | "ivory";

export const THEMES: { id: Theme; label: string; swatch: [string, string, string] }[] = [
  { id: "light",    label: "Light",            swatch: ["#ffffff", "#f4f4f5", "#18181b"] },
  { id: "dark",     label: "Dark",             swatch: ["#1a1c22", "#2a2d36", "#e7e9ee"] },
  { id: "zerodesk", label: "ZeroDesk Classic", swatch: ["#0F0F0F", "#1A1A1A", "#B6D733"] },
  { id: "infrared", label: "Infra Red",        swatch: ["#000000", "#141414", "#E11D2E"] },
  { id: "paper",    label: "Paper White",      swatch: ["#ffffff", "#f5f5f5", "#1c1c1c"] },
  { id: "porcelain",label: "Porcelain",        swatch: ["#fdfdff", "#f2f4f8", "#4a5b86"] },
  { id: "ivory",    label: "Ivory Warm",       swatch: ["#fefdfa", "#f6f2ea", "#a75a35"] },
  { id: "midnight", label: "Midnight Indigo",  swatch: ["#141432", "#1e1e5a", "#7c7cff"] },
  { id: "forest",   label: "White × Green",    swatch: ["#ffffff", "#dff3e3", "#1f7a4d"] },
  { id: "ember",    label: "Black × Red",      swatch: ["#141414", "#2a1a1a", "#e23a3a"] },
  { id: "noir",     label: "Noir & Gold",      swatch: ["#0f0f0f", "#2a2418", "#d4af37"] },
  { id: "ocean",    label: "Ocean Deep",       swatch: ["#f1f7fb", "#cfe4ef", "#1a6a8e"] },
  { id: "sand",     label: "Warm Sand",        swatch: ["#f7f1e6", "#ead9bf", "#6b4a2b"] },
];

const STORAGE_KEY = "zt.theme";
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

function apply(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark" || theme === "midnight" || theme === "ember" || theme === "noir" || theme === "zerodesk" || theme === "infrared");
}

const DEFAULT_THEME: Theme = "zerodesk";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved && THEMES.some((t) => t.id === saved)) {
        setThemeState(saved);
        apply(saved);
      } else {
        apply(DEFAULT_THEME);
      }
    } catch { apply(DEFAULT_THEME); }
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    apply(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) return { theme: DEFAULT_THEME as Theme, setTheme: () => {} };
  return c;
}
