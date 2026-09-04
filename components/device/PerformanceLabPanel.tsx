"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BlobCharacter from "@/components/blob/BlobCharacter";
import CloudCharacter from "@/components/blob/CloudCharacter";
import type { CharacterId, CloudSettings } from "@/lib/characters";
import { type BlobColour, type BlobRig } from "@/lib/blobRig";
import {
  CORE_PERFORMANCES,
  type PerformanceClip,
  sampleClipAt,
} from "@/lib/performances";
import {
  type ExpressionRecipe,
  CORE_EXPRESSIONS,
  loadCustomExpressions,
  recipeToBlobRig,
} from "@/lib/expressions";

const PRESET_COMBOS = [
  { label: "Joy Hop", exprId: "HAPPY", clipId: "JOY_HOP" },
  { label: "Laugh Squish", exprId: "HAPPY", clipId: "LAUGH_SQUISH" },
  { label: "Excited Wiggle", exprId: "EXCITED", clipId: "EXCITED_WIGGLE" },
  { label: "Curious Take", exprId: "CURIOUS", clipId: "CURIOUS_DOUBLE_TAKE" },
  { label: "Angry Flare", exprId: "ANGRY", clipId: "ANGRY_FLARE" },
  { label: "Surprise Pop", exprId: "SURPRISED", clipId: "SURPRISE_POP" },
  { label: "Sleepy Yawn", exprId: "SLEEPY", clipId: "SLEEPY_YAWN" },
  { label: "Sad Settle", exprId: "SAD", clipId: "SAD_SETTLE" },
];

export interface PerformanceLabPanelProps {
  colour: BlobColour;
  initialCharacter?: CharacterId;
  cloudSettings?: CloudSettings;
}

export default function PerformanceLabPanel({
  colour,
  initialCharacter = "blob",
  cloudSettings,
}: PerformanceLabPanelProps) {
  const [character, setCharacter] = useState<CharacterId>(initialCharacter);
  const [selectedClipId, setSelectedClipId] = useState<string>("JOY_HOP");
  const [selectedExprId, setSelectedExprId] = useState<string>("HAPPY");
  const [customExpressions, setCustomExpressions] = useState<ExpressionRecipe[]>([]);
  const [autoFollowCues, setAutoFollowCues] = useState<boolean>(true);

  // Transport state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [isLoop, setIsLoop] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Load custom expressions
  useEffect(() => {
    setCustomExpressions(loadCustomExpressions());
  }, []);

  const allExpressions = useMemo(() => {
    return [...CORE_EXPRESSIONS, ...customExpressions];
  }, [customExpressions]);

  const activeClip: PerformanceClip = useMemo(() => {
    return (
      CORE_PERFORMANCES.find((c) => c.id === selectedClipId) ?? CORE_PERFORMANCES[0]
    );
  }, [selectedClipId]);

  // Sample clip body at current time
  const sample = useMemo(() => {
    return sampleClipAt(activeClip, currentTimeMs);
  }, [activeClip, currentTimeMs]);

  // Determine active expression (either followed from clip cue or manual)
  const activeExpressionRecipe = useMemo(() => {
    const targetId = autoFollowCues && sample.activeExpressionId
      ? sample.activeExpressionId
      : selectedExprId;
    return (
      allExpressions.find((e) => e.id.toUpperCase() === targetId.toUpperCase()) ??
      CORE_EXPRESSIONS[0]
    );
  }, [autoFollowCues, sample.activeExpressionId, selectedExprId, allExpressions]);

  // Build composite rig: Face (from active expression) + Body (from performance sample)
  const compositeRig: BlobRig = useMemo(() => {
    const baseRig = recipeToBlobRig(activeExpressionRecipe);
    const bodyPose = sample.body;

    // Apply performance transforms to rig.blob
    baseRig.blob.x = bodyPose.x;
    baseRig.blob.y = bodyPose.y;
    baseRig.blob.depth = bodyPose.depth;
    baseRig.blob.yaw = bodyPose.yaw;
    baseRig.blob.pitch = bodyPose.pitch;
    baseRig.blob.rotation = bodyPose.rotation;

    // Apply squash and stretch
    const squashX = 1 + bodyPose.squash - bodyPose.stretch;
    const squashY = 1 - bodyPose.squash + bodyPose.stretch;
    baseRig.blob.scaleX = (bodyPose.scaleX ?? 1) * squashX;
    baseRig.blob.scaleY = (bodyPose.scaleY ?? 1) * squashY;
    baseRig.blob.opacity = bodyPose.opacity ?? 1;

    // Apply body-specific lean/skew and scale for Cloud lobe deformation
    baseRig.body.scaleX = squashX;
    baseRig.body.scaleY = squashY;
    baseRig.body.skewX = bodyPose.skewX ?? (bodyPose.lean ? bodyPose.lean / 20 : 0);
    baseRig.body.skewY = bodyPose.skewY ?? 0;
    baseRig.body.rotation = bodyPose.lean ?? 0;

    return baseRig;
  }, [activeExpressionRecipe, sample.body]);

  // Animation playback loop
  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      return;
    }

    const onFrame = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }
      const dt = (now - lastTimeRef.current) * speed;
      lastTimeRef.current = now;

      setCurrentTimeMs((prev) => {
        let next = prev + dt;
        if (next >= activeClip.durationMs) {
          if (isLoop) {
            next = next % activeClip.durationMs;
          } else {
            next = activeClip.durationMs;
            setIsPlaying(false);
          }
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(onFrame);
    };

    animFrameRef.current = requestAnimationFrame(onFrame);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, speed, isLoop, activeClip.durationMs]);

  const togglePlay = () => {
    if (!isPlaying && currentTimeMs >= activeClip.durationMs) {
      setCurrentTimeMs(0);
    }
    setIsPlaying((prev) => !prev);
  };

  const handleReplay = () => {
    setCurrentTimeMs(0);
    setIsPlaying(true);
  };

  const handleSelectClip = (clip: PerformanceClip) => {
    setSelectedClipId(clip.id);
    setCurrentTimeMs(0);
    if (clip.defaultExpressionId) {
      setSelectedExprId(clip.defaultExpressionId);
    }
    setIsPlaying(true);
  };

  const handleSelectPreset = (preset: (typeof PRESET_COMBOS)[0]) => {
    setSelectedClipId(preset.clipId);
    setSelectedExprId(preset.exprId);
    setCurrentTimeMs(0);
    setIsPlaying(true);
  };

  const currentBeat = activeClip.beats[sample.currentBeatIndex];

  return (
    <div className="emoji-maker" style={{ maxWidth: 1100 }}>
      <div className="emoji-maker-layout">
        {/* Left: Interactive Preview & Scrub Timeline */}
        <section className="emoji-maker-preview-card" aria-label="Performance preview">
          <div className="emoji-maker-preview-heading">
            <div>
              <span>Performance Lab</span>
              <strong>{activeClip.label}</strong>
            </div>
            <output style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
              {(currentTimeMs / 1000).toFixed(2)}s / {(activeClip.durationMs / 1000).toFixed(2)}s
            </output>
          </div>

          {/* Character Body Switcher */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, marginTop: 4 }}>
            <button
              type="button"
              className={`emoji-maker-button ${character === "blob" ? "emoji-maker-button-primary" : ""}`}
              onClick={() => setCharacter("blob")}
              style={{ flex: 1, padding: "5px 8px", fontSize: "0.8rem" }}
            >
              Jelly Blob
            </button>
            <button
              type="button"
              className={`emoji-maker-button ${character === "cloud" ? "emoji-maker-button-primary" : ""}`}
              onClick={() => setCharacter("cloud")}
              style={{ flex: 1, padding: "5px 8px", fontSize: "0.8rem" }}
            >
              Fluffy Cloud
            </button>
          </div>

          <div className="emoji-maker-preview-stage">
            {character === "cloud" ? (
              <CloudCharacter
                size={466}
                viewportSize={250}
                renderScale={1}
                rig={compositeRig}
                colour={colour}
                canvasRef={canvasRef}
                cloudParams={cloudSettings?.params}
                cloudMotion={cloudSettings?.motion}
                cloudTrails={cloudSettings?.trails}
                cloudColour={cloudSettings?.colour}
                cloudFace={cloudSettings?.face}
              />
            ) : (
              <BlobCharacter
                size={466}
                viewportSize={250}
                renderScale={1}
                rig={compositeRig}
                colour={colour}
                canvasRef={canvasRef}
              />
            )}
          </div>

          {/* Current Beat & Expression Indicator */}
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: 8,
              fontSize: "0.8rem",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.65 }}>Active Expression:</span>
              <strong style={{ color: "#a5b4fc" }}>{activeExpressionRecipe.label}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.65 }}>Current Beat:</span>
              <span style={{ fontWeight: 500 }}>
                {currentBeat ? `${currentBeat.label || `Beat ${sample.currentBeatIndex + 1}`} (${currentBeat.atMs}ms)` : "Settled"}
              </span>
            </div>
          </div>

          {/* Transport Controls */}
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Timeline Scrubber */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <input
                type="range"
                min={0}
                max={activeClip.durationMs}
                step={10}
                value={Math.round(currentTimeMs)}
                onChange={(e) => {
                  setCurrentTimeMs(Number(e.target.value));
                }}
                style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }}
              />
              {/* Beat tick marks */}
              <div
                style={{
                  position: "relative",
                  height: 12,
                  width: "100%",
                }}
              >
                {activeClip.beats.map((b, i) => {
                  const pct = (b.atMs / activeClip.durationMs) * 100;
                  return (
                    <span
                      key={i}
                      title={`${b.label ?? `Beat ${i}`} at ${b.atMs}ms`}
                      onClick={() => setCurrentTimeMs(b.atMs)}
                      style={{
                        position: "absolute",
                        left: `${pct}%`,
                        top: 0,
                        width: 4,
                        height: 8,
                        borderRadius: 2,
                        background: b.expressionId ? "#818cf8" : "rgba(255,255,255,0.35)",
                        cursor: "pointer",
                        transform: "translateX(-50%)",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Buttons row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className={`emoji-maker-button ${isPlaying ? "emoji-maker-button-primary" : ""}`}
                  onClick={togglePlay}
                  style={{ minWidth: 72 }}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button type="button" className="emoji-maker-button" onClick={handleReplay}>
                  Replay
                </button>
                <button
                  type="button"
                  className={`emoji-maker-button ${isLoop ? "emoji-maker-button-primary" : ""}`}
                  onClick={() => setIsLoop(!isLoop)}
                >
                  Loop
                </button>
              </div>

              {/* Speed Buttons */}
              <div style={{ display: "flex", gap: 4 }}>
                {[0.5, 1.0, 2.0].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`emoji-maker-button ${speed === s ? "emoji-maker-button-primary" : ""}`}
                    onClick={() => setSpeed(s)}
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Clip, Expression & Preset Selectors */}
        <div className="emoji-maker-controls">
          {/* Card 1: Quick Combos */}
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Quick Character Moments</h2>
              <p>Instant pairings of emotional expressions and physical performances.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div className="emoji-maker-preset-grid">
                {PRESET_COMBOS.map((combo) => (
                  <button
                    key={combo.label}
                    type="button"
                    className="emoji-maker-button"
                    onClick={() => handleSelectPreset(combo)}
                    style={{ fontSize: "0.8rem", textAlign: "left" }}
                  >
                    {combo.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Card 2: Performance Clips (Physical Acting) */}
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Physical Performance (Body)</h2>
              <p>Golden rule: Face leads &rarr; Body follows &rarr; Body settles last.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 8,
                }}
              >
                {CORE_PERFORMANCES.map((clip) => {
                  const isSelected = clip.id === selectedClipId;
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      className={`emoji-maker-button ${isSelected ? "emoji-maker-button-primary" : ""}`}
                      onClick={() => handleSelectClip(clip)}
                      style={{
                        padding: 10,
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <strong style={{ fontSize: "0.85rem" }}>{clip.label}</strong>
                      <span style={{ fontSize: "0.7rem", opacity: 0.65 }}>
                        {(clip.durationMs / 1000).toFixed(1)}s &bull; {clip.beats.length} beats
                      </span>
                    </button>
                  );
                })}
              </div>
              <p style={{ marginTop: 10, fontSize: "0.75rem", opacity: 0.7 }}>
                {activeClip.description}
              </p>
            </div>
          </section>

          {/* Card 3: Expression Pairing (Face) */}
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Facial Expression (Face)</h2>
              <p>Pair with any core emotion or custom recipe from the Expression Maker.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="autoFollowCues"
                  checked={autoFollowCues}
                  onChange={(e) => setAutoFollowCues(e.target.checked)}
                  style={{ accentColor: "#6366f1" }}
                />
                <label htmlFor="autoFollowCues" style={{ fontSize: "0.8rem", cursor: "pointer" }}>
                  Auto-follow performance expression cues
                </label>
              </div>

              <div
                className="emoji-maker-preset-grid"
                style={{ maxHeight: 160, overflowY: "auto", paddingRight: 4 }}
              >
                {allExpressions.map((expr) => {
                  const isSelected = expr.id === activeExpressionRecipe.id;
                  return (
                    <button
                      key={expr.id}
                      type="button"
                      className={`emoji-maker-button ${isSelected ? "emoji-maker-button-primary" : ""}`}
                      onClick={() => {
                        setSelectedExprId(expr.id);
                        setAutoFollowCues(false);
                      }}
                      style={{ fontSize: "0.8rem" }}
                    >
                      {expr.label} {expr.isCustom ? "(Custom)" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Card 4: Beat Breakdown */}
          <section className="emoji-maker-card">
            <div className="emoji-maker-card-heading">
              <h2>Performance Keyframes ({activeClip.beats.length} beats)</h2>
              <p>Click any beat to scrub directly to that keyframe.</p>
            </div>
            <div className="emoji-maker-card-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem" }}>
                {activeClip.beats.map((beat, idx) => {
                  const isCurrent = sample.currentBeatIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentTimeMs(beat.atMs);
                        setIsPlaying(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: isCurrent
                          ? "rgba(99, 102, 241, 0.2)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: isCurrent
                          ? "1px solid rgba(99, 102, 241, 0.4)"
                          : "1px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                            color: "#818cf8",
                            minWidth: 46,
                          }}
                        >
                          {beat.atMs}ms
                        </span>
                        <span>{beat.label || `Beat ${idx + 1}`}</span>
                      </div>
                      {beat.expressionId && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            background: "rgba(129, 140, 248, 0.2)",
                            color: "#a5b4fc",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          CUE: {beat.expressionId}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
