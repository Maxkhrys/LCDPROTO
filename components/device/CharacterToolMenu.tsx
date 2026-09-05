"use client";

import type { BlobColour } from "@/lib/blobRig";
import { BLOB_COLOURS } from "@/lib/blobRig";
import type { CloudColourPreset } from "@/lib/cloudPresets";

export type CharacterTool =
  | "colour"
  | "face"
  | "environment"
  | "edit"
  | "character";

interface CharacterToolMenuProps {
  open: boolean;
  active: CharacterTool | null;
  /** Rendered diameter of the display, in CSS pixels. */
  screenSize: number;
  blobColour: BlobColour;
  presets: CloudColourPreset[];
  activePresetName: string;
  onSelect: (tool: CharacterTool) => void;
  onColourChange: (colour: BlobColour) => void;
  onStepPreset: (direction: -1 | 1) => void;
}

/**
 * The character's own settings menu.
 *
 * Buttons are laid out on an arc whose origin is the body itself, and each one
 * animates out from that origin with a short spring settle, so they read as
 * lobes breaking off the cloud rather than as a UI panel dropped on top of it.
 * Geometry is pure CSS custom properties — no animation library, and nothing
 * here touches how the character is drawn.
 */
const TOOLS: { id: CharacterTool; label: string }[] = [
  { id: "colour", label: "Colour" },
  { id: "face", label: "Face" },
  { id: "environment", label: "Environment" },
  { id: "edit", label: "Edit" },
  { id: "character", label: "Character" },
];

/** Arc across the top of the body, in degrees (0° = right, counter-clockwise). */
const ARC_START = 200;
const ARC_END = 340;

export default function CharacterToolMenu({
  open,
  active,
  screenSize,
  blobColour,
  presets,
  activePresetName,
  onSelect,
  onColourChange,
  onStepPreset,
}: CharacterToolMenuProps) {
  if (!open) return null;

  const orbSize = Math.max(38, Math.min(56, screenSize * 0.135));
  const radius = screenSize * 0.33;
  /** The body sits slightly low while the menu is open; match that centre. */
  const originY = screenSize * 0.56;
  const step = (ARC_END - ARC_START) / (TOOLS.length - 1);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {TOOLS.map((tool, index) => {
        const angle = ((ARC_START + step * index) * Math.PI) / 180;
        return (
          <button
            key={tool.id}
            type="button"
            aria-label={tool.label}
            aria-pressed={active === tool.id}
            onClick={() => onSelect(tool.id)}
            className={`cloud-orb pointer-events-auto ${
              active === tool.id ? "cloud-orb-active" : ""
            }`}
            style={
              {
                left: screenSize / 2,
                top: originY,
                width: orbSize,
                height: orbSize,
                "--orb-x": `${Math.cos(angle) * radius}px`,
                "--orb-y": `${Math.sin(angle) * radius}px`,
                "--orb-delay": `${index * 42}ms`,
              } as React.CSSProperties
            }
          >
            <span className="cloud-orb-puff" aria-hidden />
            <span className="cloud-orb-glyph">
              {tool.id === "colour" ? (
                <i
                  className="cloud-orb-swatch"
                  style={{ background: presetSwatch(presets, activePresetName, blobColour) }}
                />
              ) : (
                <ToolGlyph tool={tool.id} />
              )}
            </span>
            <span className="cloud-orb-label">{tool.label}</span>
          </button>
        );
      })}

      {active === "colour" && (
        <div
          className="cloud-orb-tray pointer-events-auto"
          style={{ left: screenSize / 2, top: screenSize * 0.2 }}
        >
          {BLOB_COLOURS.map((colour) => (
            <button
              key={colour.id}
              type="button"
              aria-label={`Use ${colour.label}`}
              aria-pressed={blobColour === colour.id}
              onClick={() => onColourChange(colour.id)}
              className="cloud-orb-tray-dot"
              style={{ background: blobColourSwatch(colour.id) }}
            />
          ))}
        </div>
      )}

      {active === "character" && (
        <>
          <button
            type="button"
            aria-label="Previous character preset"
            onClick={() => onStepPreset(-1)}
            className="cloud-arrow cloud-arrow-left pointer-events-auto"
            style={{ top: originY + screenSize * 0.1, left: screenSize / 2 - radius * 1.2 }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next character preset"
            onClick={() => onStepPreset(1)}
            className="cloud-arrow cloud-arrow-right pointer-events-auto"
            style={{ top: originY + screenSize * 0.1, left: screenSize / 2 + radius * 1.2 }}
          >
            ›
          </button>
          <div
            className="cloud-preset-name"
            style={{ left: screenSize / 2, top: originY + radius * 0.72 }}
          >
            {activePresetName}
          </div>
        </>
      )}
    </div>
  );
}

function ToolGlyph({ tool }: { tool: CharacterTool }) {
  const path: Record<Exclude<CharacterTool, "colour">, React.ReactNode> = {
    face: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M9 10h.01M15 10h.01M8.8 14c1.8 1.7 4.6 1.7 6.4 0" />
      </>
    ),
    environment: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M4 10h16M5 15h14M12 4c2.3 2.6 2.3 13.4 0 16-2.3-2.6-2.3-13.4 0-16Z" />
      </>
    ),
    edit: (
      <>
        <path d="M4 8h12M4 16h6" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="12" cy="16" r="2" />
      </>
    ),
    character: (
      <>
        <path d="M7.5 16.5a4 4 0 0 1-.6-7.9 4.8 4.8 0 0 1 9.2-1.1A3.6 3.6 0 0 1 16.5 16.5Z" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path[tool as Exclude<CharacterTool, "colour">]}
    </svg>
  );
}

function presetSwatch(
  presets: CloudColourPreset[],
  activePresetName: string,
  blobColour: BlobColour
) {
  const preset = presets.find((entry) => entry.name === activePresetName);
  return preset ? preset.colour.body : blobColourSwatch(blobColour);
}

/** The one swatch map shared by the console and the on-display menu. */
export function blobColourSwatch(colour: BlobColour) {
  const swatches: Record<BlobColour, string> = {
    purple: "#9a63ed",
    teal: "#28c9c4",
    yellow: "#f3c431",
    green: "#55d963",
    blue: "#398cff",
    red: "#ef4b59",
  };
  return swatches[colour];
}
