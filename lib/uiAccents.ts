/**
 * Console accent themes.
 *
 * Only the accent ramp is themed: neutrals, surfaces and text stay put so the
 * UI never turns into a colour wash. Every accented control reads the same
 * four custom properties, so adding a theme here is all it takes.
 */
export interface UiAccent {
  id: string;
  label: string;
  /** Primary fill and active text. */
  accent: string;
  /** Pressed / hovered primary fill. */
  hover: string;
  /** Pale wash behind selected chips, nav rows and tabs. */
  soft: string;
  /** Outline on selected surfaces. */
  line: string;
}

export const UI_ACCENTS: readonly UiAccent[] = [
  { id: "blue", label: "Blue", accent: "#1d6ff2", hover: "#1560d8", soft: "#e9f1fe", line: "#bed8fc" },
  { id: "sky", label: "Sky", accent: "#0d92c4", hover: "#0a7ba6", soft: "#e4f5fb", line: "#b3e0ef" },
  { id: "violet", label: "Violet", accent: "#6d4df0", hover: "#5b3ad8", soft: "#efeafe", line: "#d3c6fb" },
  { id: "emerald", label: "Emerald", accent: "#0d9b6c", hover: "#0a835a", soft: "#e3f7ef", line: "#b4e6d3" },
  { id: "amber", label: "Amber", accent: "#b7791f", hover: "#9c6416", soft: "#fbf1de", line: "#eed7a8" },
  { id: "rose", label: "Rose", accent: "#d3436f", hover: "#b6355d", soft: "#fdeaf0", line: "#f5c2d2" },
] as const;

export const DEFAULT_UI_ACCENT = UI_ACCENTS[0].id;

const STORAGE_KEY = "lcdproto_ui_accent_v1";

export function getUiAccent(id: string): UiAccent {
  return UI_ACCENTS.find((accent) => accent.id === id) ?? UI_ACCENTS[0];
}

export function loadUiAccent(): string {
  if (typeof window === "undefined") return DEFAULT_UI_ACCENT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && UI_ACCENTS.some((accent) => accent.id === stored)) return stored;
  } catch {
    /* Private mode and blocked storage both just mean "use the default". */
  }
  return DEFAULT_UI_ACCENT;
}

/** Writes the ramp onto the document so every accented token follows it. */
export function applyUiAccent(id: string): void {
  if (typeof document === "undefined") return;
  const accent = getUiAccent(id);
  const root = document.documentElement.style;
  root.setProperty("--accent", accent.accent);
  root.setProperty("--accent-hover", accent.hover);
  root.setProperty("--accent-soft", accent.soft);
  root.setProperty("--accent-line", accent.line);
  try {
    localStorage.setItem(STORAGE_KEY, accent.id);
  } catch {
    /* Persisting the choice is a nicety, not a requirement. */
  }
}
