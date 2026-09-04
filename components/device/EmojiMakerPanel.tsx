"use client";

import { useMemo, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import {
  FACE_STYLE,
  NEUTRAL_BLOB,
  NEUTRAL_ELEMENT,
  type BlobColour,
  type BlobRig,
} from "@/lib/blobRig";

interface EmojiDraft {
  name: string;
  leftEyeX: number;
  leftEyeY: number;
  rightEyeX: number;
  rightEyeY: number;
  eyeWidth: number;
  eyeHeight: number;
  eyeOpen: number;
  browLift: number;
  leftBrowTilt: number;
  rightBrowTilt: number;
  mouthX: number;
  mouthY: number;
  mouthWidth: number;
  mouthHeight: number;
  mouthCurve: number;
  mouthD: number;
  mouthO: number;
}

const DEFAULT_EMOJI: EmojiDraft = {
  name: "blob-emoji",
  leftEyeX: 0,
  leftEyeY: 0,
  rightEyeX: 0,
  rightEyeY: 0,
  eyeWidth: 1,
  eyeHeight: 1,
  eyeOpen: 1,
  browLift: 0,
  leftBrowTilt: 0,
  rightBrowTilt: 0,
  mouthX: 0,
  mouthY: 0,
  mouthWidth: 1,
  mouthHeight: 1,
  mouthCurve: 0.82,
  mouthD: 0,
  mouthO: 0,
};

const EMOJI_PRESETS: { id: string; label: string; patch: Partial<EmojiDraft> }[] = [
  { id: "neutral", label: "Neutral", patch: DEFAULT_EMOJI },
  {
    id: "happy",
    label: "Happy D",
    patch: {
      name: "blob-happy",
      eyeHeight: 0.98,
      eyeOpen: 0.94,
      browLift: 0.12,
      leftBrowTilt: -2.4,
      rightBrowTilt: 2.4,
      mouthY: -1.4,
      mouthWidth: 1.08,
      mouthHeight: 1.2,
      mouthCurve: 0.94,
      mouthD: 0.88,
    },
  },
  {
    id: "angry",
    label: "Angry D",
    patch: {
      name: "blob-angry",
      eyeHeight: 0.92,
      eyeOpen: 0.78,
      browLift: 0.02,
      leftBrowTilt: 7,
      rightBrowTilt: -7,
      mouthY: 0.8,
      mouthWidth: 1.03,
      mouthHeight: 1.14,
      mouthCurve: -0.58,
      mouthD: 0.8,
    },
  },
  {
    id: "sleepy",
    label: "Sleepy",
    patch: {
      name: "blob-sleepy",
      eyeHeight: 0.9,
      eyeOpen: 0.34,
      browLift: -0.02,
      mouthY: 0.55,
      mouthHeight: 0.82,
      mouthCurve: 0.15,
      mouthD: 0,
      mouthO: 0.08,
    },
  },
  {
    id: "surprised",
    label: "Surprised",
    patch: {
      name: "blob-surprised",
      eyeHeight: 1.2,
      eyeOpen: 1,
      browLift: 0.2,
      mouthY: -0.4,
      mouthWidth: 0.82,
      mouthHeight: 1.16,
      mouthCurve: 0,
      mouthD: 0,
      mouthO: 0.92,
    },
  },
  {
    id: "sad",
    label: "Sad",
    patch: {
      name: "blob-sad",
      eyeHeight: 0.96,
      eyeOpen: 0.68,
      browLift: 0.05,
      leftBrowTilt: -3.2,
      rightBrowTilt: 3.2,
      mouthY: 0.4,
      mouthCurve: -0.7,
      mouthD: 0.1,
      mouthO: 0,
    },
  },
];

function draftForPreset(patch: Partial<EmojiDraft>): EmojiDraft {
  return { ...DEFAULT_EMOJI, ...patch };
}

function makeRig(draft: EmojiDraft): BlobRig {
  const eye = (x: number, y: number, browRotation: number) => ({
    ...NEUTRAL_ELEMENT,
    socketX: x,
    socketY: y,
    eyeOpen: draft.eyeOpen,
    eyeSocketScaleX: draft.eyeWidth,
    eyeSocketScaleY: draft.eyeHeight,
    browLift: draft.browLift,
    browRotation,
  });

  return {
    blob: { ...NEUTRAL_BLOB, faceStyle: FACE_STYLE.CONTENT },
    body: { ...NEUTRAL_ELEMENT },
    leftEye: eye(draft.leftEyeX, draft.leftEyeY, draft.leftBrowTilt),
    rightEye: eye(draft.rightEyeX, draft.rightEyeY, draft.rightBrowTilt),
    mouth: {
      ...NEUTRAL_ELEMENT,
      x: draft.mouthX,
      y: draft.mouthY,
      scaleX: draft.mouthWidth,
      scaleY: draft.mouthHeight,
      mouthCurve: draft.mouthCurve,
      mouthD: draft.mouthD,
      mouthO: draft.mouthO,
    },
  };
}

export default function EmojiMakerPanel({ colour }: { colour: BlobColour }) {
  const [draft, setDraft] = useState<EmojiDraft>(DEFAULT_EMOJI);
  const [exportStatus, setExportStatus] = useState("466 × 466 transparent PNG");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rig = useMemo(() => makeRig(draft), [draft]);

  const update = <K extends keyof EmojiDraft>(key: K, value: EmojiDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setExportStatus("Changes ready to export");
  };

  const reset = () => {
    setDraft(DEFAULT_EMOJI);
    setExportStatus("466 × 466 transparent PNG");
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setExportStatus("Preview is still loading");
      return;
    }
    const baseName = draft.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "blob-emoji";
    const link = document.createElement("a");
    link.download = `${baseName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setExportStatus(`Saved ${baseName}.png`);
  };

  return (
    <div className="emoji-maker">
      <div className="emoji-maker-layout">
        <section className="emoji-maker-preview-card" aria-label="Emoji preview">
          <div className="emoji-maker-preview-heading">
            <div>
              <span>Live face preview</span>
              <strong>{draft.name || "blob-emoji"}</strong>
            </div>
            <output>{exportStatus}</output>
          </div>
          <div className="emoji-maker-preview-stage">
            <BlobCharacter
              size={466}
              viewportSize={250}
              renderScale={1}
              rig={rig}
              colour={colour}
              canvasRef={canvasRef}
            />
          </div>
          <p className="emoji-maker-preview-note">
            The preview uses the live Blob body, solid black eyes, brows, and the same mouth renderer as HOME.
          </p>
        </section>

        <div className="emoji-maker-controls">
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Recipe</h2>
              <p>Start from a pose, then tune the face in native pixels.</p>
            </div>
            <div className="emoji-maker-card-body">
              <label className="emoji-maker-name">
                <span>PNG name</span>
                <input
                  value={draft.name}
                  onChange={(event) => update("name", event.currentTarget.value)}
                  placeholder="blob-emoji"
                  spellCheck={false}
                />
              </label>
              <div className="emoji-maker-preset-grid" role="group" aria-label="Face presets">
                {EMOJI_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="emoji-maker-button"
                    onClick={() => {
                      setDraft(draftForPreset(preset.patch));
                      setExportStatus(`${preset.label} preset`);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="emoji-maker-actions">
                <button type="button" className="emoji-maker-button" onClick={reset}>
                  Reset face
                </button>
                <button type="button" className="emoji-maker-button emoji-maker-button-primary" onClick={exportPng}>
                  Export PNG
                </button>
              </div>
            </div>
          </section>

          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Eyes and brows</h2>
              <p>Black eye mass stays fixed. Move the sockets and tilt the brows.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div className="emoji-maker-range-grid">
                <EmojiSlider label="Eye width" value={draft.eyeWidth} min={0.72} max={1.35} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => update("eyeWidth", value)} />
                <EmojiSlider label="Eye height" value={draft.eyeHeight} min={0.72} max={1.35} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => update("eyeHeight", value)} />
                <EmojiSlider label="Eye opening" value={draft.eyeOpen} min={0.05} max={1.15} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update("eyeOpen", value)} />
                <EmojiSlider label="Brow lift" value={draft.browLift} min={-0.35} max={0.45} step={0.01} format={(value) => value.toFixed(2)} onChange={(value) => update("browLift", value)} />
              </div>
              <div className="emoji-maker-subheading">Socket position</div>
              <div className="emoji-maker-range-grid">
                <EmojiSlider label="Left X" value={draft.leftEyeX} min={-18} max={18} step={0.25} format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}px`} onChange={(value) => update("leftEyeX", value)} />
                <EmojiSlider label="Left Y" value={draft.leftEyeY} min={-18} max={18} step={0.25} format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}px`} onChange={(value) => update("leftEyeY", value)} />
                <EmojiSlider label="Right X" value={draft.rightEyeX} min={-18} max={18} step={0.25} format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}px`} onChange={(value) => update("rightEyeX", value)} />
                <EmojiSlider label="Right Y" value={draft.rightEyeY} min={-18} max={18} step={0.25} format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}px`} onChange={(value) => update("rightEyeY", value)} />
              </div>
              <div className="emoji-maker-subheading">Brow tilt</div>
              <div className="emoji-maker-range-grid">
                <EmojiSlider label="Left brow" value={draft.leftBrowTilt} min={-12} max={12} step={0.25} format={(value) => `${value.toFixed(2)}°`} onChange={(value) => update("leftBrowTilt", value)} />
                <EmojiSlider label="Right brow" value={draft.rightBrowTilt} min={-12} max={12} step={0.25} format={(value) => `${value.toFixed(2)}°`} onChange={(value) => update("rightBrowTilt", value)} />
              </div>
            </div>
          </section>

          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Mouth shape</h2>
              <p>Blend a soft line, rounded O, or the new flat-top D mouth.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div className="emoji-maker-range-grid">
                <EmojiSlider label="Mouth X" value={draft.mouthX} min={-18} max={18} step={0.25} format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}px`} onChange={(value) => update("mouthX", value)} />
                <EmojiSlider label="Mouth Y" value={draft.mouthY} min={-18} max={18} step={0.25} format={(value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}px`} onChange={(value) => update("mouthY", value)} />
                <EmojiSlider label="Mouth width" value={draft.mouthWidth} min={0.62} max={1.18} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => update("mouthWidth", value)} />
                <EmojiSlider label="Mouth height" value={draft.mouthHeight} min={0.7} max={1.24} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => update("mouthHeight", value)} />
                <EmojiSlider label="Smile curve" value={draft.mouthCurve} min={-1} max={1} step={0.01} format={(value) => value.toFixed(2)} onChange={(value) => update("mouthCurve", value)} />
                <EmojiSlider label="D mouth" value={draft.mouthD} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update("mouthD", value)} />
                <EmojiSlider label="O mouth" value={draft.mouthO} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update("mouthO", value)} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function EmojiSlider({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="emoji-maker-slider">
      <span>{label}</span>
      <output>{format(value)}</output>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}
