/**
 * The LCDPROTO system screen catalogue.
 *
 * This file is data only — no rendering, no React, no Blob. It is the single
 * source of truth for what screens exist, how long they run, whether they can
 * be interrupted and how they hand over to one another. Renderers and the
 * lifecycle controller both read from here, so a screen can never exist in one
 * place and not the other.
 *
 * Everything is authored in the native 466-space, for a circular AMOLED panel
 * whose default state is true black.
 */

import type { DeviceState } from "./deviceStates";

export type ScreenCategory =
  | "boot"
  | "startup"
  | "power"
  | "connectivity"
  | "problems"
  | "maintenance"
  | "state";

/**
 * How a screen arrives and leaves. One shared vocabulary, so the transition
 * system stays consistent instead of every screen inventing its own.
 */
export type ScreenTransition =
  /** Straight cut. Used where any fade would just be a slow black. */
  | "cut"
  /** Opacity only. */
  | "fade"
  /** Fades toward black; the AMOLED-safe way out of a lit screen. */
  | "dim"
  /** Comes up out of black with a slight lift. */
  | "rise"
  /** A brief brightness bloom, for confirmations. */
  | "bloom";

/** Whether a screen is finished art or a working placeholder. */
export type ScreenStatus = "complete" | "placeholder";

export type SystemScreenId =
  | "BOOT_BLACK"
  | "DISPLAY_INIT"
  | "LCDPROTO_MARK"
  | "ASSET_LOADING"
  | "BLOB_WAKE"
  | "BLOB_READY"
  | "PAUSE"
  | "DIMMED_PAUSE"
  | "SLEEP"
  | "WAKE"
  | "SEARCHING"
  | "PAIRING"
  | "CONNECTING"
  | "CONNECTED_CONFIRMATION"
  | "OFFLINE"
  | "RECONNECTING"
  | "ERROR"
  | "FIRMWARE_UPDATE"
  | "UPDATE_COMPLETE"
  | "LOW_POWER";

/** Every screen the browser can show: system screens plus the device states. */
export type ScreenId = SystemScreenId | DeviceState;

export interface ScreenDefinition {
  id: ScreenId;
  category: ScreenCategory;
  /** Shown in the developer browser. Never rendered inside the LCD. */
  label: string;
  description: string;
  /**
   * How long the screen holds before a flow advances, in milliseconds.
   * Simulated for now; a firmware event can end a screen early at any time.
   */
  durationMs: number;
  /** May a arriving event cut this screen short? */
  interruptible: boolean;
  /** May the developer browser preview it on its own? */
  previewable: boolean;
  transitionIn: ScreenTransition;
  transitionOut: ScreenTransition;
  /** True when the screen shows the existing Blob rig rather than replacing it. */
  showsBlob: boolean;
  status: ScreenStatus;
}

const define = (
  id: ScreenId,
  category: ScreenCategory,
  label: string,
  description: string,
  durationMs: number,
  interruptible: boolean,
  transitionIn: ScreenTransition,
  transitionOut: ScreenTransition,
  showsBlob: boolean,
  status: ScreenStatus = "complete"
): ScreenDefinition => ({
  id,
  category,
  label,
  description,
  durationMs,
  interruptible,
  previewable: true,
  transitionIn,
  transitionOut,
  showsBlob,
  status,
});

export const SCREENS: readonly ScreenDefinition[] = [
  // --- Boot ---------------------------------------------------------------
  define(
    "BOOT_BLACK",
    "boot",
    "Boot black",
    "True black hold while the panel powers up. Nothing is drawn at all.",
    420,
    false,
    "cut",
    "cut",
    false
  ),
  define(
    "DISPLAY_INIT",
    "boot",
    "Display init",
    "A single very dim ring lifts out of black, so the panel reads as coming alive rather than switching on.",
    900,
    false,
    "rise",
    "fade",
    false
  ),
  define(
    "LCDPROTO_MARK",
    "boot",
    "LCDPROTO mark",
    "Minimal ring mark with a single break. No title, no motion beyond a slow settle.",
    1100,
    true,
    "fade",
    "fade",
    false
  ),

  // --- Startup ------------------------------------------------------------
  define(
    "ASSET_LOADING",
    "startup",
    "Loading",
    "Calm breathing core inside a progress arc. Deterministic progress — no spinner, nothing held static and bright.",
    2200,
    false,
    "fade",
    "fade",
    false
  ),
  define(
    "BLOB_WAKE",
    "startup",
    "Blob wake",
    "Blob emerges from darkness on the existing rig. The veil lifts and his own idle system takes over.",
    1800,
    true,
    "rise",
    "fade",
    true
  ),
  define(
    "BLOB_READY",
    "startup",
    "Ready",
    "Blob holds a calm ready pose with one soft ring confirmation, then hands over to HOME.",
    1200,
    true,
    "fade",
    "fade",
    true
  ),

  // --- Power --------------------------------------------------------------
  define(
    "PAUSE",
    "power",
    "Pause",
    "Blob settles. Motion becomes nearly still, but breathing continues so the device never looks dead.",
    1600,
    true,
    "fade",
    "dim",
    true
  ),
  define(
    "DIMMED_PAUSE",
    "power",
    "Dimmed pause",
    "Light activity drops away while enough contrast remains to show the device is still awake.",
    2000,
    true,
    "dim",
    "dim",
    true
  ),
  define(
    "SLEEP",
    "power",
    "Sleep",
    "Fades to true black with no permanent indicator, which is the only burn-in-safe resting state.",
    1400,
    true,
    "dim",
    "cut",
    true
  ),
  define(
    "WAKE",
    "power",
    "Wake",
    "A soft ring cue rises out of black and brightness returns before Blob does.",
    1300,
    true,
    "rise",
    "fade",
    true
  ),

  // --- Connectivity -------------------------------------------------------
  define(
    "SEARCHING",
    "connectivity",
    "Searching",
    "Two restrained rings breathe outward. Deliberately not radar styling.",
    2400,
    true,
    "fade",
    "fade",
    false
  ),
  define(
    "PAIRING",
    "connectivity",
    "Pairing",
    "Two arcs travel toward each other and meet, carrying progress through motion rather than a bar.",
    2200,
    true,
    "fade",
    "fade",
    false
  ),
  define(
    "CONNECTING",
    "connectivity",
    "Connecting",
    "A single progress arc closes around the centre. Deterministic, ready to be driven by real BLE events.",
    1900,
    true,
    "fade",
    "bloom",
    false
  ),
  define(
    "CONNECTED_CONFIRMATION",
    "connectivity",
    "Connected",
    "One brief green confirmation ring, then straight back to HOME. Blob may react with existing expressions only.",
    1100,
    true,
    "bloom",
    "fade",
    true
  ),

  // --- Problems -----------------------------------------------------------
  define(
    "OFFLINE",
    "problems",
    "Offline",
    "A broken ring, dim and still. States the problem through colour and gap rather than text.",
    2000,
    true,
    "fade",
    "fade",
    false
  ),
  define(
    "RECONNECTING",
    "problems",
    "Reconnecting",
    "One amber arc orbits at a patient pace. Reads as trying, not as failing.",
    2400,
    true,
    "fade",
    "fade",
    false
  ),
  define(
    "ERROR",
    "problems",
    "Error",
    "A single controlled shake on a red ring, then it holds still. Never a game-over screen.",
    1800,
    true,
    "fade",
    "fade",
    false
  ),

  // --- Maintenance --------------------------------------------------------
  define(
    "FIRMWARE_UPDATE",
    "maintenance",
    "Update",
    "Deterministic progress arc with tick marks. Nothing random, so real update progress can replace it directly.",
    3200,
    false,
    "fade",
    "fade",
    false
  ),
  define(
    "UPDATE_COMPLETE",
    "maintenance",
    "Update complete",
    "The progress ring closes and a check settles inside it.",
    1300,
    true,
    "bloom",
    "fade",
    false
  ),
  define(
    "LOW_POWER",
    "maintenance",
    "Low power",
    "Dim amber arc at reduced brightness and frame rate, with wake interaction preserved.",
    2400,
    true,
    "dim",
    "fade",
    false
  ),

  // --- Existing device states --------------------------------------------
  // These delegate to the state views that already exist. The catalogue lists
  // them so the browser can reach every screen from one place, but this pass
  // does not change their behaviour.
  define("HOME", "state", "Home", "The neutral Blob, driven by the existing behaviour system.", 0, true, "fade", "fade", true),
  define("SENSED", "state", "Sensed", "Existing SENSED state view.", 0, true, "fade", "fade", true),
  define("APPROACHING", "state", "Approaching", "Existing state view.", 0, true, "fade", "fade", true, "placeholder"),
  define("VERY_CLOSE", "state", "Very close", "Existing state view.", 0, true, "fade", "fade", true, "placeholder"),
  define("TOGETHER", "state", "Together", "Existing state view.", 0, true, "fade", "fade", true, "placeholder"),
  define("SYNC", "state", "Sync", "Existing state view.", 0, true, "fade", "fade", true, "placeholder"),
  define("CONNECTED", "state", "Connected", "Existing state view.", 0, true, "fade", "fade", true, "placeholder"),
  define("RECOGNIZED", "state", "Recognized", "Existing state view.", 0, true, "fade", "fade", true, "placeholder"),
] as const;

const SCREEN_BY_ID = new Map<ScreenId, ScreenDefinition>(
  SCREENS.map((screen) => [screen.id, screen])
);

export function getScreen(id: ScreenId): ScreenDefinition {
  const screen = SCREEN_BY_ID.get(id);
  if (!screen) throw new Error(`Unknown screen: ${id}`);
  return screen;
}

/** True when the id is one of the pre-existing device states. */
export function isDeviceState(id: ScreenId): id is DeviceState {
  return getScreen(id).category === "state";
}

export const SCREEN_CATEGORIES: readonly {
  id: ScreenCategory;
  label: string;
}[] = [
  { id: "boot", label: "Boot" },
  { id: "startup", label: "Startup" },
  { id: "power", label: "Power" },
  { id: "connectivity", label: "Connection" },
  { id: "problems", label: "Problems" },
  { id: "maintenance", label: "Maintenance" },
  { id: "state", label: "Existing states" },
];

export function screensInCategory(category: ScreenCategory) {
  return SCREENS.filter((screen) => screen.category === category);
}

// --- Flows -----------------------------------------------------------------

export type FlowId = "boot" | "sleep" | "wake" | "connectivity" | "failure";

/**
 * The lifecycle flows. Each is just an ordered list of catalogue ids, so a
 * flow can be re-ordered or replaced without touching a renderer.
 *
 * LCDPROTO_MARK is intentionally not in the boot flow — it is reachable on its
 * own for brand work, but the device boots straight into loading.
 */
export const SCREEN_FLOWS: Record<
  FlowId,
  { label: string; screens: readonly ScreenId[] }
> = {
  boot: {
    label: "Initial boot",
    screens: [
      "BOOT_BLACK",
      "DISPLAY_INIT",
      "ASSET_LOADING",
      "BLOB_WAKE",
      "BLOB_READY",
      "HOME",
    ],
  },
  sleep: {
    label: "Sleep",
    screens: ["HOME", "PAUSE", "DIMMED_PAUSE", "SLEEP"],
  },
  wake: {
    label: "Wake",
    screens: ["SLEEP", "WAKE", "BLOB_READY", "HOME"],
  },
  connectivity: {
    label: "Connectivity",
    screens: [
      "SEARCHING",
      "PAIRING",
      "CONNECTING",
      "CONNECTED_CONFIRMATION",
      "HOME",
    ],
  },
  failure: {
    label: "Failure",
    screens: ["CONNECTING", "OFFLINE", "RECONNECTING", "HOME"],
  },
};

/** A device state ends a flow: it has no duration and runs indefinitely. */
export function isTerminal(id: ScreenId) {
  return getScreen(id).durationMs === 0;
}
