/**
 * Console themes.
 *
 * A theme is a flat map of the same design tokens `app/globals.css` already
 * declares on `:root`, so every surface, line, text tier and accent in the
 * console follows the selection without a second stylesheet. Applying a theme
 * writes those custom properties onto the document; nothing else changes.
 *
 * This is the *software* theme. The simulated 466x466 panel keeps its own
 * scene colours (Display → Inspection scene) and is deliberately untouched
 * here: picking Navy must not repaint the device's brown environment.
 */
import type { BorderBeamColorVariant } from "border-beam";

export type UiThemeId =
  | "light"
  | "navy"
  | "graphite"
  | "blue"
  | "beige"
  | "crimson";

export interface UiTheme {
  id: UiThemeId;
  label: string;
  description: string;
  /** Drives native form controls and scrollbars. */
  scheme: "light" | "dark";
  /** Beam palette that suits this theme's surfaces. */
  beam: BorderBeamColorVariant;
  tokens: Record<string, string>;
}

const SHADOWS_LIGHT = {
  "--shadow-xs": "0 1px 2px rgb(16 26 45 / 0.05)",
  "--shadow-card": "0 1px 2px rgb(16 26 45 / 0.04), 0 10px 24px -18px rgb(16 26 45 / 0.35)",
  "--shadow-app": "0 30px 80px -30px rgb(21 43 82 / 0.28), 0 2px 6px rgb(21 43 82 / 0.05)",
};

const SHADOWS_DARK = {
  "--shadow-xs": "0 1px 2px rgb(0 0 0 / 0.3)",
  "--shadow-card": "0 1px 2px rgb(0 0 0 / 0.35), 0 12px 28px -20px rgb(0 0 0 / 0.8)",
  "--shadow-app": "0 34px 90px -34px rgb(0 0 0 / 0.75), 0 2px 8px rgb(0 0 0 / 0.35)",
};

export const UI_THEMES: readonly UiTheme[] = [
  {
    id: "light",
    label: "Light",
    description: "Cool near-white surfaces with a clean blue accent.",
    scheme: "light",
    beam: "ocean",
    tokens: {
      "--page-bg": "#e5ebf4",
      "--page-bg-tint": "#eff3f9",
      "--app-surface": "#fbfcfe",
      "--sidebar-bg": "#f0f4fa",
      "--surface-raised": "#e8eef7",
      "--surface-sunken": "#f3f6fb",
      "--ink": "#131d30",
      "--muted": "#5c6c85",
      "--faint": "#8492a8",
      "--line": "#dde4ee",
      "--line-strong": "#c6d1e1",
      "--accent": "#1d6ff2",
      "--accent-hover": "#1560d8",
      "--accent-soft": "#e6f0fe",
      "--accent-line": "#bcd7fc",
      "--accent-ink": "#ffffff",
      "--positive": "#17a34a",
      "--positive-soft": "#e9f7ef",
      "--positive-line": "#c3e8d1",
      "--positive-ink": "#12703a",
      "--positive-ink-soft": "#3f7f5b",
      "--bezel-rim": "rgb(16 26 45 / 0.08)",
      "--knob": "#ffffff",
      ...SHADOWS_LIGHT,
    },
  },
  {
    id: "navy",
    label: "Navy",
    description: "Deep navy panels for long monitor sessions.",
    scheme: "dark",
    beam: "ocean",
    tokens: {
      "--page-bg": "#080e1a",
      "--page-bg-tint": "#0d1524",
      "--app-surface": "#121c2e",
      "--sidebar-bg": "#0e1727",
      "--surface-raised": "#1b2740",
      "--surface-sunken": "#152036",
      "--ink": "#e6edf8",
      "--muted": "#9db0cb",
      "--faint": "#74869f",
      "--line": "#22304a",
      "--line-strong": "#334563",
      "--accent": "#4f92f6",
      "--accent-hover": "#6ba4f8",
      "--accent-soft": "#16294a",
      "--accent-line": "#2c4d80",
      "--accent-ink": "#07111f",
      "--positive": "#4fc98c",
      "--positive-soft": "#0f2a22",
      "--positive-line": "#1e4a38",
      "--positive-ink": "#8fdcb4",
      "--positive-ink-soft": "#6cae90",
      "--bezel-rim": "rgb(255 255 255 / 0.07)",
      "--knob": "#dce6f5",
      ...SHADOWS_DARK,
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Neutral charcoal with cool muted accents.",
    scheme: "dark",
    beam: "mono",
    tokens: {
      "--page-bg": "#131518",
      "--page-bg-tint": "#181b1f",
      "--app-surface": "#1e2126",
      "--sidebar-bg": "#191c20",
      "--surface-raised": "#272b31",
      "--surface-sunken": "#212429",
      "--ink": "#e8eaee",
      "--muted": "#a2a9b4",
      "--faint": "#7c838e",
      "--line": "#2c3038",
      "--line-strong": "#3d434c",
      "--accent": "#7aa7dc",
      "--accent-hover": "#8fb7e6",
      "--accent-soft": "#222831",
      "--accent-line": "#39485a",
      "--accent-ink": "#10141a",
      "--positive": "#5fbf8c",
      "--positive-soft": "#1a2622",
      "--positive-line": "#2a4437",
      "--positive-ink": "#95d7b2",
      "--positive-ink-soft": "#74a98d",
      "--bezel-rim": "rgb(255 255 255 / 0.07)",
      "--knob": "#dfe3e9",
      ...SHADOWS_DARK,
    },
  },
  {
    id: "blue",
    label: "Blue",
    description: "Desaturated deep blue with a brighter accent.",
    scheme: "dark",
    beam: "ocean",
    tokens: {
      "--page-bg": "#0d1828",
      "--page-bg-tint": "#122236",
      "--app-surface": "#1a2c45",
      "--sidebar-bg": "#15253b",
      "--surface-raised": "#233a58",
      "--surface-sunken": "#1d3049",
      "--ink": "#eaf2fc",
      "--muted": "#a3bad5",
      "--faint": "#7c92ad",
      "--line": "#28405e",
      "--line-strong": "#3a5678",
      "--accent": "#54a8ff",
      "--accent-hover": "#71b8ff",
      "--accent-soft": "#1c3a56",
      "--accent-line": "#31578a",
      "--accent-ink": "#06121f",
      "--positive": "#53cd97",
      "--positive-soft": "#123029",
      "--positive-line": "#22523f",
      "--positive-ink": "#92e0bb",
      "--positive-ink-soft": "#6fb497",
      "--bezel-rim": "rgb(255 255 255 / 0.08)",
      "--knob": "#dbe9fa",
      ...SHADOWS_DARK,
    },
  },
  {
    id: "beige",
    label: "Beige",
    description: "Warm stone surfaces with a restrained bronze accent.",
    scheme: "light",
    beam: "sunset",
    tokens: {
      "--page-bg": "#e4ddd1",
      "--page-bg-tint": "#efe9df",
      "--app-surface": "#faf7f1",
      "--sidebar-bg": "#f1ece3",
      "--surface-raised": "#eae2d5",
      "--surface-sunken": "#f4f0e8",
      "--ink": "#332f29",
      "--muted": "#6e675e",
      "--faint": "#918a7f",
      "--line": "#ddd5c7",
      "--line-strong": "#c6bcaa",
      "--accent": "#9a663c",
      "--accent-hover": "#835532",
      "--accent-soft": "#f0e5d7",
      "--accent-line": "#d9c3a7",
      "--accent-ink": "#fffaf3",
      "--positive": "#4f8158",
      "--positive-soft": "#e9f0e6",
      "--positive-line": "#c8dbc4",
      "--positive-ink": "#3b6242",
      "--positive-ink-soft": "#5d7f62",
      "--bezel-rim": "rgb(51 47 41 / 0.1)",
      "--knob": "#fffdf9",
      ...SHADOWS_LIGHT,
    },
  },
  {
    id: "crimson",
    label: "Crimson",
    description: "Burgundy panels with a soft red accent.",
    scheme: "dark",
    beam: "sunset",
    tokens: {
      "--page-bg": "#150c0f",
      "--page-bg-tint": "#1b1014",
      "--app-surface": "#221519",
      "--sidebar-bg": "#1c1115",
      "--surface-raised": "#2d1d23",
      "--surface-sunken": "#26171d",
      "--ink": "#f2e7e9",
      "--muted": "#c0a5ab",
      "--faint": "#9a8189",
      "--line": "#382229",
      "--line-strong": "#4c3038",
      "--accent": "#d9607a",
      "--accent-hover": "#e4788e",
      "--accent-soft": "#2f1a21",
      "--accent-line": "#552c37",
      "--accent-ink": "#1a0b0f",
      "--positive": "#6cbf8e",
      "--positive-soft": "#182a23",
      "--positive-line": "#2a4a3a",
      "--positive-ink": "#9ad9b5",
      "--positive-ink-soft": "#78ac91",
      "--bezel-rim": "rgb(255 255 255 / 0.07)",
      "--knob": "#f3e2e6",
      ...SHADOWS_DARK,
    },
  },
] as const;

export const DEFAULT_UI_THEME: UiThemeId = "light";

const STORAGE_KEY = "lcdproto_ui_theme_v1";

export function getUiTheme(id: string): UiTheme {
  return UI_THEMES.find((theme) => theme.id === id) ?? UI_THEMES[0];
}

export function loadUiTheme(): UiThemeId {
  if (typeof window === "undefined") return DEFAULT_UI_THEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && UI_THEMES.some((theme) => theme.id === stored)) {
      return stored as UiThemeId;
    }
  } catch {
    /* Blocked storage just means the default theme. */
  }
  return DEFAULT_UI_THEME;
}

/** Writes the theme's tokens onto the document and remembers the choice. */
export function applyUiTheme(id: string): UiTheme {
  const theme = getUiTheme(id);
  if (typeof document === "undefined") return theme;
  const root = document.documentElement;
  for (const [token, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(token, value);
  }
  root.style.colorScheme = theme.scheme;
  root.dataset.uiTheme = theme.id;
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    /* Persisting is a nicety, not a requirement. */
  }
  return theme;
}
