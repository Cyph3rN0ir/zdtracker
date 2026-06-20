import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "midnight" | "forest" | "ember" | "noir" | "ocean" | "sand";

export const THEMES: { id: Theme; label: string; swatch: [string, string, string] }[] = [
  { id: "light",    label: "Light",            swatch: ["#ffffff", "#f4f4f5", "#18181b"] },
  { id: "dark",     label: "Dark",             swatch: ["#1a1c22", "#2a2d36", "#e7e9ee"] },
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
  root.classList.toggle("dark", theme === "dark" || theme === "midnight" || theme === "ember" || theme === "noir");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved && THEMES.some((t) => t.id === saved)) {
        setThemeState(saved);
        apply(saved);
      } else {
        apply("light");
      }
    } catch { apply("light"); }
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
  if (!c) return { theme: "light" as Theme, setTheme: () => {} };
  return c;
}
