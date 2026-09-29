import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "consulnet-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  const effective =
    theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
  root.classList.toggle("dark", effective === "dark");
  root.style.colorScheme = effective;
}

/**
 * Gestione tema light/dark/system con persistenza in localStorage.
 * Toggle ciclico: light → dark → system → light.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(KEY) as Theme) || "system";
  });

  useEffect(() => {
    apply(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  // Reagisci ai cambi di system preference quando theme === "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => {
    setThemeState((curr) => (curr === "light" ? "dark" : curr === "dark" ? "system" : "light"));
  }, []);

  const resolved: "light" | "dark" =
    theme === "system"
      ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;

  return { theme, resolved, setTheme, toggle };
}
