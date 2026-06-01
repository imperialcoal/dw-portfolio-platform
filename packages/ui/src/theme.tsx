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

    const storedTheme = localStorage.getItem("theme-mode") ?? "auto";
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
// ThemeToggle — compact single-button cycling toggle
//
// Cycles: auto (system) → dark → light → auto
// The sequence adapts to the user's system preference so the first
// manual choice is always the opposite of what they're currently seeing.
//
// Use this in headers and nav bars where a one-click toggle is preferred.
// The current mode is shown via icon with a smooth CSS scale transition —
// Sun = light, Moon = dark, Desktop = system/auto.
// ─────────────────────────────────────────────

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light mode",
  dark: "Dark mode",
  auto: "System theme",
};

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
      {/* Sun — light mode */}
      <SunIcon
        className={[
          "absolute h-4 w-4 transition-all duration-200",
          themeMode === "light" ? "scale-100 opacity-100" : "scale-0 opacity-0",
        ].join(" ")}
        aria-hidden
      />
      {/* Moon — dark mode */}
      <MoonIcon
        className={[
          "absolute h-4 w-4 transition-all duration-200",
          themeMode === "dark" ? "scale-100 opacity-100" : "scale-0 opacity-0",
        ].join(" ")}
        aria-hidden
      />
      {/* Desktop — system/auto */}
      <DesktopIcon
        className={[
          "absolute h-4 w-4 transition-all duration-200",
          themeMode === "auto" ? "scale-100 opacity-100" : "scale-0 opacity-0",
        ].join(" ")}
        aria-hidden
      />
    </button>
  );
}

// ─────────────────────────────────────────────
// ThemeToggleMenu — dropdown variant
//
// Use this when you want explicit Light / Dark / System options
// rather than a cycling toggle. Useful in settings panels or
// any context where user intent should be unambiguous.
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
          className={[
            "[&>svg]:absolute [&>svg]:size-5 [&>svg]:scale-0",
            className ?? "",
          ]
            .join(" ")
            .trim()}
        >
          <SunIcon className="light:scale-100! auto:scale-0!" />
          <MoonIcon className="auto:scale-0! dark:scale-100!" />
          <DesktopIcon className="auto:scale-100!" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <SunIcon className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <MoonIcon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("auto")}>
          <DesktopIcon className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
