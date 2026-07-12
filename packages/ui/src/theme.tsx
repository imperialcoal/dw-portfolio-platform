"use client";

import * as React from "react";
import { DesktopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import * as z from "zod/v4";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const ThemeModeSchema = z.enum(["light", "dark", "auto"]);

const themeKey = "theme-mode";

export type ThemeMode = z.output<typeof ThemeModeSchema>;
export type ResolvedTheme = Exclude<ThemeMode, "auto">;

const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return "auto";
  try {
    const storedTheme = localStorage.getItem(themeKey);
    return ThemeModeSchema.parse(storedTheme);
  } catch {
    return "auto";
  }
};

const setStoredThemeMode = (theme: ThemeMode) => {
  try {
    const parsedTheme = ThemeModeSchema.parse(theme);
    localStorage.setItem(themeKey, parsedTheme);
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

const getSystemTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const updateThemeClass = (themeMode: ThemeMode) => {
  const root = document.documentElement;
  root.classList.remove("light", "dark", "auto");
  const newTheme = themeMode === "auto" ? getSystemTheme() : themeMode;
  root.classList.add(newTheme);

  if (themeMode === "auto") {
    root.classList.add("auto");
  }
};

const setupPreferredListener = () => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => updateThemeClass("auto");
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
};

const getNextTheme = (current: ThemeMode): ThemeMode => {
  const themes: ThemeMode[] =
    getSystemTheme() === "dark"
      ? ["auto", "light", "dark"]
      : ["auto", "dark", "light"];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return themes[(themes.indexOf(current) + 1) % themes.length]!;
};

export const themeDetectorScript = (function () {
  function themeFn() {
    const isValidTheme = (theme: string): theme is ThemeMode => {
      const validThemes = ["light", "dark", "auto"] as const;
      return validThemes.includes(theme as ThemeMode);
    };

    const storedTheme = localStorage.getItem("theme-mode") ?? "dark";
    const validTheme = isValidTheme(storedTheme) ? storedTheme : "auto";

    if (validTheme === "auto") {
      const autoTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      document.documentElement.classList.add(autoTheme, "auto");
    } else {
      document.documentElement.classList.add(validTheme);
    }
  }
  return `(${themeFn.toString()})();`;
})();

interface ThemeContextProps {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleMode: () => void;
}
const ThemeContext = React.createContext<ThemeContextProps | undefined>(
  undefined,
);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [themeMode, setThemeMode] = React.useState(getStoredThemeMode);

  React.useEffect(() => {
    if (themeMode !== "auto") return;
    return setupPreferredListener();
  }, [themeMode]);

  const resolvedTheme = themeMode === "auto" ? getSystemTheme() : themeMode;

  const setTheme = (newTheme: ThemeMode) => {
    setThemeMode(newTheme);
    setStoredThemeMode(newTheme);
    updateThemeClass(newTheme);
  };

  const toggleMode = () => {
    setTheme(getNextTheme(themeMode));
  };

  return (
    <ThemeContext
      value={{
        themeMode,
        resolvedTheme,
        setTheme,
        toggleMode,
      }}
    >
      <script
        dangerouslySetInnerHTML={{ __html: themeDetectorScript }}
        suppressHydrationWarning
      />
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = React.use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// ─────────────────────────────────────────────
// ThemeIcon — the universal trigger icon
//
// A half-sun / half-moon split circle: the left half is a crescent moon,
// the right half is a sun with rays. Immediately recognizable as a
// "light/dark theme" control without needing a label. More distinct than
// a standalone SunIcon, MoonIcon, or DesktopIcon in isolation.
// ─────────────────────────────────────────────

function ThemeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      className={className ?? "h-4 w-4"}
      aria-hidden
    >
      {/* Left half — moon (dark) */}
      <path
        d="M8 2a6 6 0 0 0 0 12A6 6 0 0 1 8 2z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Right half — sun rays */}
      <circle cx="8" cy="8" r="2.5" fill="currentColor" />
      <line
        x1="8"
        y1="1"
        x2="8"
        y2="3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="13"
        x2="8"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <line
        x1="12.2"
        y1="3.8"
        x2="10.77"
        y2="5.23"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <line
        x1="5.23"
        y1="10.77"
        x2="3.8"
        y2="12.2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <line
        x1="15"
        y1="8"
        x2="13"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light mode",
  dark: "Dark mode",
  auto: "System theme",
};

// ─────────────────────────────────────────────
// ThemeToggleMenu — dropdown (primary component)
//
// Opens a dropdown with explicit Light / Dark / System options.
// The trigger button shows the split sun/moon icon so users immediately
// understand its purpose. Active mode is marked with a filled dot.
//
// Use this everywhere — headers, nav bars, fixed corners.
// ─────────────────────────────────────────────

export function ThemeToggleMenu({ className }: { className?: string }) {
  const { themeMode, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Theme — currently ${MODE_LABELS[themeMode]}`}
          title="Change theme"
          className={className}
        >
          <ThemeIcon />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon className="mr-2 h-4 w-4 text-amber-500" />
          Light
          {themeMode === "light" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon className="mr-2 h-4 w-4 text-indigo-400" />
          Dark
          {themeMode === "dark" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("auto")}>
          <DesktopIcon className="mr-2 h-4 w-4 text-zinc-400" />
          System
          {themeMode === "auto" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────
// ThemeToggle — compact single-button cycling toggle
//
// Cycles through modes on click. Use in space-constrained inline
// contexts where a dropdown is too heavy. ThemeToggleMenu is preferred.
// ─────────────────────────────────────────────

export function ThemeToggle({ className }: { className?: string }) {
  const { themeMode, toggleMode } = useTheme();

  return (
    <button
      onClick={toggleMode}
      aria-label={`Switch theme — currently ${MODE_LABELS[themeMode]}`}
      title={MODE_LABELS[themeMode]}
      className={[
        "relative flex h-8 w-8 items-center justify-center rounded-md",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        "focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <ThemeIcon />
    </button>
  );
}
