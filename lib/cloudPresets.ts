/**
 * Saved cloud looks.
 *
 * A preset is nothing but a full CloudColourConfig plus a name. The console
 * applies one by writing it into `cloudSettings.colour`, which the cloud
 * renderer already treats as an override on top of whatever base palette is
 * resolved — so presets need no change to the rendering path, and the list
 * stays extensible (built-ins here, user saves in localStorage).
 */
import type { CloudColourConfig } from "@/components/experimental/cloud-blob/cloudTypes";

export interface CloudColourPreset {
  id: string;
  name: string;
  /** Built-ins ship with the app and cannot be deleted. */
  builtIn: boolean;
  colour: CloudColourConfig;
}

const STORAGE_KEY = "lcdproto_cloud_presets_v1";

export const BUILT_IN_CLOUD_PRESETS: readonly CloudColourPreset[] = [
  {
    id: "cloud-white",
    name: "Cloud White",
    builtIn: true,
    colour: {
      body: "#f2f6fb",
      innerGlow: "#c8d6ea",
      edge: "#ffffff",
      coreTint: "#93a4bd",
      glowIntensity: 0.82,
      density: 0.92,
      translucency: 0.88,
    },
  },
  {
    id: "cloud-blue",
    name: "Cloud Blue",
    builtIn: true,
    colour: {
      body: "#cfe4ff",
      innerGlow: "#4d92f5",
      edge: "#f0f7ff",
      coreTint: "#3d6598",
      glowIntensity: 1.04,
      density: 0.94,
      translucency: 0.84,
    },
  },
] as const;

export function loadSavedCloudPresets(): CloudColourPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is CloudColourPreset => Boolean(entry && (entry as CloudColourPreset).colour))
      .map((entry) => ({ ...entry, builtIn: false }));
  } catch (err) {
    console.error("Failed to parse saved cloud presets:", err);
    return [];
  }
}

/** Built-ins first, then the user's own saves, in one cycling order. */
export function loadCloudPresets(): CloudColourPreset[] {
  return [...BUILT_IN_CLOUD_PRESETS, ...loadSavedCloudPresets()];
}

export function saveCloudPreset(name: string, colour: CloudColourConfig): CloudColourPreset[] {
  if (typeof window === "undefined") return loadCloudPresets();
  const trimmed = name.trim() || "Untitled cloud";
  const id = `saved-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const current = loadSavedCloudPresets();
  const next = current.filter((preset) => preset.id !== id);
  next.push({ id, name: trimmed, builtIn: false, colour });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Failed to save cloud preset:", err);
  }
  return loadCloudPresets();
}

export function deleteCloudPreset(id: string): CloudColourPreset[] {
  if (typeof window === "undefined") return loadCloudPresets();
  const next = loadSavedCloudPresets().filter((preset) => preset.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Failed to delete cloud preset:", err);
  }
  return loadCloudPresets();
}
