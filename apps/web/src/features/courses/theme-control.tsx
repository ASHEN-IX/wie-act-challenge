"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Theme = "light" | "dark";
const THEME_KEY = "noveris-theme";

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

/** Persisted, user-controlled appearance for the workspace and course reader. */
export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      onClick={toggle}
      aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
      title={theme === "dark" ? "Use light theme" : "Use dark theme"}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
