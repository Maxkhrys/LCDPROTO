"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import { type BlobColour, type BlobRig } from "@/lib/blobRig";
import {
  type ExpressionRecipe,
  CORE_EXPRESSIONS,
  loadCustomExpressions,
  saveCustomExpression,
  deleteCustomExpression,
  exportExpressionsToJson,
  importExpressionsFromJson,
  recipeToTypeScript,
  recipeToBlobRig,
  DEFAULT_EYE_RECIPE,
  DEFAULT_MOUTH_RECIPE,
} from "@/lib/expressions";

export default function ExpressionMakerPanel({ colour }: { colour: BlobColour }) {
  const [customList, setCustomList] = useState<ExpressionRecipe[]>([]);
  const [selectedId, setSelectedId] = useState<string>("NEUTRAL");
  const [recipeName, setRecipeName] = useState("Neutral");

  // Editable face recipe state
  const [leftEyeX, setLeftEyeX] = useState(0);
  const [leftEyeY, setLeftEyeY] = useState(0);
  const [rightEyeX, setRightEyeX] = useState(0);
  const [rightEyeY, setRightEyeY] = useState(0);
  const [eyeWidth, setEyeWidth] = useState(1);
  const [eyeHeight, setEyeHeight] = useState(1);
  const [eyeOpen, setEyeOpen] = useState(1);
  const [browLift, setBrowLift] = useState(0);
  const [leftBrowTilt, setLeftBrowTilt] = useState(0);
  const [rightBrowTilt, setRightBrowTilt] = useState(0);

  const [mouthX, setMouthX] = useState(0);
  const [mouthY, setMouthY] = useState(0);
  const [mouthWidth, setMouthWidth] = useState(1);
  const [mouthHeight, setMouthHeight] = useState(1);
  const [mouthCurve, setMouthCurve] = useState(0.82);
  const [mouthD, setMouthD] = useState(0);
  const [mouthO, setMouthO] = useState(0);

  const [statusMessage, setStatusMessage] = useState("466 × 466 transparent PNG");
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load custom expressions on mount
  useEffect(() => {
    setCustomList(loadCustomExpressions());
  }, []);

  const allExpressions = useMemo(() => {
    return [...CORE_EXPRESSIONS, ...customList];
  }, [customList]);

  // Apply an ExpressionRecipe to the current editor sliders
  const applyRecipe = (recipe: ExpressionRecipe) => {
    setSelectedId(recipe.id);
    setRecipeName(recipe.label || recipe.id);
    setLeftEyeX(recipe.leftEye.socketX);
    setLeftEyeY(recipe.leftEye.socketY);
    setRightEyeX(recipe.rightEye.socketX);
    setRightEyeY(recipe.rightEye.socketY);
    setEyeWidth(recipe.leftEye.width);
    setEyeHeight(recipe.leftEye.height);
    setEyeOpen(recipe.leftEye.open);
    setBrowLift(recipe.leftEye.browLift);
    setLeftBrowTilt(recipe.leftEye.browTilt);
    setRightBrowTilt(recipe.rightEye.browTilt);

    setMouthX(recipe.mouth.x);
    setMouthY(recipe.mouth.y);
    setMouthWidth(recipe.mouth.width);
    setMouthHeight(recipe.mouth.height);
    setMouthCurve(recipe.mouth.curve);
    setMouthD(recipe.mouth.dAmount);
    setMouthO(recipe.mouth.oAmount);

    setStatusMessage(`Loaded "${recipe.label || recipe.id}"`);
  };

  // Build current active ExpressionRecipe from slider state
  const currentRecipe: ExpressionRecipe = useMemo(() => {
    const isCustom = customList.some((e) => e.id === selectedId);
    return {
      id: selectedId,
      label: recipeName,
      category: isCustom ? "custom" : "core",
      isCustom,
      leftEye: {
        socketX: leftEyeX,
        socketY: leftEyeY,
        width: eyeWidth,
        height: eyeHeight,
        open: eyeOpen,
        browLift,
        browTilt: leftBrowTilt,
      },
      rightEye: {
        socketX: rightEyeX,
        socketY: rightEyeY,
        width: eyeWidth,
        height: eyeHeight,
        open: eyeOpen,
        browLift,
        browTilt: rightBrowTilt,
      },
      mouth: {
        x: mouthX,
        y: mouthY,
        width: mouthWidth,
        height: mouthHeight,
        curve: mouthCurve,
        dAmount: mouthD,
        oAmount: mouthO,
      },
    };
  }, [
    selectedId,
    recipeName,
    customList,
    leftEyeX,
    leftEyeY,
    rightEyeX,
    rightEyeY,
    eyeWidth,
    eyeHeight,
    eyeOpen,
    browLift,
    leftBrowTilt,
    rightBrowTilt,
    mouthX,
    mouthY,
    mouthWidth,
    mouthHeight,
    mouthCurve,
    mouthD,
    mouthO,
  ]);

  const rig: BlobRig = useMemo(() => {
    return recipeToBlobRig(currentRecipe);
  }, [currentRecipe]);

  // Save current recipe to localStorage as a custom expression
  const handleSaveCustom = () => {
    const cleanId = recipeName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "") || `EXPR_${Date.now()}`;

    const newRecipe: ExpressionRecipe = {
      ...currentRecipe,
      id: cleanId,
      label: recipeName.trim() || cleanId,
      category: "custom",
      isCustom: true,
    };

    saveCustomExpression(newRecipe);
    const updated = loadCustomExpressions();
    setCustomList(updated);
    setSelectedId(cleanId);
    setStatusMessage(`Saved "${newRecipe.label}" to custom expressions`);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomExpression(id);
    const updated = loadCustomExpressions();
    setCustomList(updated);
    if (selectedId === id) {
      applyRecipe(CORE_EXPRESSIONS[0]);
    }
    setStatusMessage(`Deleted custom expression`);
  };

  const handleDuplicate = () => {
    setRecipeName(`${recipeName} (Copy)`);
    setSelectedId(`COPY_${Date.now()}`);
    setStatusMessage("Duplicated as new draft");
  };

  const handleReset = () => {
    setLeftEyeX(DEFAULT_EYE_RECIPE.socketX);
    setLeftEyeY(DEFAULT_EYE_RECIPE.socketY);
    setRightEyeX(DEFAULT_EYE_RECIPE.socketX);
    setRightEyeY(DEFAULT_EYE_RECIPE.socketY);
    setEyeWidth(DEFAULT_EYE_RECIPE.width);
    setEyeHeight(DEFAULT_EYE_RECIPE.height);
    setEyeOpen(DEFAULT_EYE_RECIPE.open);
    setBrowLift(DEFAULT_EYE_RECIPE.browLift);
    setLeftBrowTilt(DEFAULT_EYE_RECIPE.browTilt);
    setRightBrowTilt(DEFAULT_EYE_RECIPE.browTilt);

    setMouthX(DEFAULT_MOUTH_RECIPE.x);
    setMouthY(DEFAULT_MOUTH_RECIPE.y);
    setMouthWidth(DEFAULT_MOUTH_RECIPE.width);
    setMouthHeight(DEFAULT_MOUTH_RECIPE.height);
    setMouthCurve(DEFAULT_MOUTH_RECIPE.curve);
    setMouthD(DEFAULT_MOUTH_RECIPE.dAmount);
    setMouthO(DEFAULT_MOUTH_RECIPE.oAmount);

    setStatusMessage("Reset face to neutral defaults");
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setStatusMessage("Preview is still loading");
      return;
    }
    const baseName =
      recipeName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "blob-expression";
    const link = document.createElement("a");
    link.download = `${baseName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setStatusMessage(`Saved ${baseName}.png`);
  };

  const copyTsCode = () => {
    const snippet = recipeToTypeScript(currentRecipe);
    navigator.clipboard.writeText(snippet);
    setStatusMessage("Copied TypeScript snippet to clipboard");
  };

  const openExportJson = () => {
    setJsonText(exportExpressionsToJson(customList.length > 0 ? customList : [currentRecipe]));
    setShowJsonModal(true);
  };

  const handleImportJson = () => {
    try {
      const imported = importExpressionsFromJson(jsonText);
      if (imported.length > 0) {
        imported.forEach((r) => saveCustomExpression(r));
        const updated = loadCustomExpressions();
        setCustomList(updated);
        applyRecipe(imported[0]);
        setShowJsonModal(false);
        setStatusMessage(`Imported ${imported.length} custom expression(s)`);
      } else {
        setStatusMessage("No valid expressions found in JSON");
      }
    } catch {
      setStatusMessage("Invalid JSON format");
    }
  };

  return (
    <div className="emoji-maker">
      <div className="emoji-maker-layout">
        {/* Left column: Live face canvas */}
        <section className="emoji-maker-preview-card" aria-label="Expression preview">
          <div className="emoji-maker-preview-heading">
            <div>
              <span>Live face preview</span>
              <strong>{recipeName || "blob-face"}</strong>
            </div>
            <output>{statusMessage}</output>
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
            Character System V2: Full expression decoupling. Solid black procedural eyes (#010204),
            negative-space eyelids, floating brows, and parametric mouth.
          </p>
          <div className="emoji-maker-actions" style={{ marginTop: 12 }}>
            <button type="button" className="emoji-maker-button" onClick={copyTsCode}>
              Copy TypeScript
            </button>
            <button type="button" className="emoji-maker-button" onClick={openExportJson}>
              JSON Import/Export
            </button>
            <button
              type="button"
              className="emoji-maker-button emoji-maker-button-primary"
              onClick={exportPng}
            >
              Export PNG
            </button>
          </div>
        </section>

        {/* Right column: Recipes and fine controls */}
        <div className="emoji-maker-controls">
          {/* Card 1: Recipe Library */}
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Expressions Library</h2>
              <p>Select a core emotion or craft a custom recipe.</p>
            </div>
            <div className="emoji-maker-card-body">
              <label className="emoji-maker-name">
                <span>Expression Name</span>
                <input
                  value={recipeName}
                  onChange={(event) => setRecipeName(event.currentTarget.value)}
                  placeholder="Happy Smile"
                  spellCheck={false}
                />
              </label>

              {/* Expression grid */}
              <div
                className="emoji-maker-preset-grid"
                role="group"
                aria-label="Expressions"
                style={{ maxHeight: 180, overflowY: "auto", paddingRight: 4 }}
              >
                {allExpressions.map((expr) => {
                  const isSelected = expr.id === selectedId;
                  const isCustom = expr.isCustom;
                  return (
                    <button
                      key={expr.id}
                      type="button"
                      className={`emoji-maker-button ${isSelected ? "emoji-maker-button-primary" : ""}`}
                      onClick={() => applyRecipe(expr)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        fontSize: "0.85rem",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {expr.label}
                      </span>
                      {isCustom ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.65rem",
                              background: "rgba(255,255,255,0.15)",
                              padding: "1px 4px",
                              borderRadius: 4,
                            }}
                          >
                            CUSTOM
                          </span>
                          <span
                            title="Delete"
                            onClick={(e) => handleDeleteCustom(expr.id, e)}
                            style={{
                              cursor: "pointer",
                              padding: "0 2px",
                              opacity: 0.7,
                            }}
                          >
                            ×
                          </span>
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            background: "rgba(255,255,255,0.08)",
                            padding: "1px 4px",
                            borderRadius: 4,
                          }}
                        >
                          CORE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="emoji-maker-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="emoji-maker-button emoji-maker-button-primary"
                  onClick={handleSaveCustom}
                >
                  Save as Expression
                </button>
                <button type="button" className="emoji-maker-button" onClick={handleDuplicate}>
                  Duplicate
                </button>
                <button type="button" className="emoji-maker-button" onClick={handleReset}>
                  Reset
                </button>
              </div>
            </div>
          </section>

          {/* Card 2: Eyes and brows */}
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Eyes and Brows</h2>
              <p>Solid black procedural eyes with negative-space lids.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div className="emoji-maker-range-grid">
                <EmojiSlider
                  label="Eye width"
                  value={eyeWidth}
                  min={0.72}
                  max={1.35}
                  step={0.01}
                  format={(v) => `${v.toFixed(2)}x`}
                  onChange={setEyeWidth}
                />
                <EmojiSlider
                  label="Eye height"
                  value={eyeHeight}
                  min={0.72}
                  max={1.35}
                  step={0.01}
                  format={(v) => `${v.toFixed(2)}x`}
                  onChange={setEyeHeight}
                />
                <EmojiSlider
                  label="Opening"
                  value={eyeOpen}
                  min={0.05}
                  max={1.15}
                  step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={setEyeOpen}
                />
                <EmojiSlider
                  label="Brow lift"
                  value={browLift}
                  min={-0.35}
                  max={0.45}
                  step={0.01}
                  format={(v) => v.toFixed(2)}
                  onChange={setBrowLift}
                />
              </div>
              <div className="emoji-maker-subheading">Socket position</div>
              <div className="emoji-maker-range-grid">
                <EmojiSlider
                  label="Left X"
                  value={leftEyeX}
                  min={-18}
                  max={18}
                  step={0.25}
                  format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}px`}
                  onChange={setLeftEyeX}
                />
                <EmojiSlider
                  label="Left Y"
                  value={leftEyeY}
                  min={-18}
                  max={18}
                  step={0.25}
                  format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}px`}
                  onChange={setLeftEyeY}
                />
                <EmojiSlider
                  label="Right X"
                  value={rightEyeX}
                  min={-18}
                  max={18}
                  step={0.25}
                  format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}px`}
                  onChange={setRightEyeX}
                />
                <EmojiSlider
                  label="Right Y"
                  value={rightEyeY}
                  min={-18}
                  max={18}
                  step={0.25}
                  format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}px`}
                  onChange={setRightEyeY}
                />
              </div>
              <div className="emoji-maker-subheading">Brow tilt</div>
              <div className="emoji-maker-range-grid">
                <EmojiSlider
                  label="Left brow"
                  value={leftBrowTilt}
                  min={-12}
                  max={12}
                  step={0.25}
                  format={(v) => `${v.toFixed(2)}°`}
                  onChange={setLeftBrowTilt}
                />
                <EmojiSlider
                  label="Right brow"
                  value={rightBrowTilt}
                  min={-12}
                  max={12}
                  step={0.25}
                  format={(v) => `${v.toFixed(2)}°`}
                  onChange={setRightBrowTilt}
                />
              </div>
            </div>
          </section>

          {/* Card 3: Mouth shape */}
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Mouth Shape</h2>
              <p>Blend a soft line, rounded O, or flat-top D mouth.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div className="emoji-maker-range-grid">
                <EmojiSlider
                  label="Mouth X"
                  value={mouthX}
                  min={-18}
                  max={18}
                  step={0.25}
                  format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}px`}
                  onChange={setMouthX}
                />
                <EmojiSlider
                  label="Mouth Y"
                  value={mouthY}
                  min={-18}
                  max={18}
                  step={0.25}
                  format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}px`}
                  onChange={setMouthY}
                />
                <EmojiSlider
                  label="Width"
                  value={mouthWidth}
                  min={0.62}
                  max={1.18}
                  step={0.01}
                  format={(v) => `${v.toFixed(2)}x`}
                  onChange={setMouthWidth}
                />
                <EmojiSlider
                  label="Height"
                  value={mouthHeight}
                  min={0.7}
                  max={1.24}
                  step={0.01}
                  format={(v) => `${v.toFixed(2)}x`}
                  onChange={setMouthHeight}
                />
                <EmojiSlider
                  label="Smile curve"
                  value={mouthCurve}
                  min={-1}
                  max={1}
                  step={0.01}
                  format={(v) => v.toFixed(2)}
                  onChange={setMouthCurve}
                />
                <EmojiSlider
                  label="D mouth"
                  value={mouthD}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={setMouthD}
                />
                <EmojiSlider
                  label="O mouth"
                  value={mouthO}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={setMouthO}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* JSON Import/Export Modal */}
      {showJsonModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
          }}
          onClick={() => setShowJsonModal(false)}
        >
          <div
            style={{
              background: "#18181b",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 560,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Expressions JSON</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.7 }}>
              Paste or copy expression recipe definitions in JSON format.
            </p>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              style={{
                width: "100%",
                background: "#09090b",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "#e4e4e7",
                padding: 12,
                fontFamily: "monospace",
                fontSize: "0.8rem",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="emoji-maker-button"
                onClick={() => setShowJsonModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="emoji-maker-button emoji-maker-button-primary"
                onClick={handleImportJson}
              >
                Import to Library
              </button>
            </div>
          </div>
        </div>
      )}
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
