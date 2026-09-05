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

/**
 * Halo arc across the top of the panel, in degrees (0° = right, y down).
 * Kept inside a semicircle so the row reads as a crown rather than a ring.
 */
const ARC_START = 208;
const ARC_END = 332;

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

  // Everything is laid out from the panel centre, which is also where the
  // character idles: the body no longer drops out of the way, so the halo has
  // to be measured against the display's inner ring instead.
  const centre = screenSize / 2;
  const orbSize = Math.max(36, Math.min(52, screenSize * 0.118));
  /** Constant inset from the inner ring, so the arc hugs it without touching. */
  const ringInset = screenSize * 0.055;
  const radius = centre - orbSize / 2 - ringInset;
  const step = (ARC_END - ARC_START) / (TOOLS.length - 1);
  /** Arrows sit on the character's own horizontal axis, clear of both edges. */
  const arrowSize = Math.max(34, Math.min(44, screenSize * 0.095));
  const arrowX = centre - arrowSize / 2 - screenSize * 0.05;

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
                left: centre,
                top: centre,
                width: orbSize,
                height: orbSize,
                "--orb-x": `${Math.cos(angle) * radius}px`,
                "--orb-y": `${Math.sin(angle) * radius}px`,
                "--orb-delay": `${index * 38}ms`,
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
          style={{ left: centre, top: centre - radius * 0.52 }}
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
            style={{
              top: centre,
              left: centre - arrowX,
              width: arrowSize,
              height: arrowSize,
            }}
          >
            <ArrowGlyph direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next character preset"
            onClick={() => onStepPreset(1)}
            className="cloud-arrow cloud-arrow-right pointer-events-auto"
            style={{
              top: centre,
              left: centre + arrowX,
              width: arrowSize,
              height: arrowSize,
            }}
          >
            <ArrowGlyph direction="right" />
          </button>
          <div
            className="cloud-preset-name"
            style={{ left: centre, top: centre + screenSize * 0.3 }}
          >
            {activePresetName}
          </div>
        </>
      )}
    </div>
  );
}

function ArrowGlyph({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? <path d="M14.5 5.5 8 12l6.5 6.5" /> : <path d="M9.5 5.5 16 12l-6.5 6.5" />}
    </svg>
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
