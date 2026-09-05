"use client";

import { useCallback, useRef } from "react";
import { ActionIcon } from "./ConsoleIcons";

export interface PreviewSummaryRow {
  label: string;
  value: string;
  accent?: boolean;
}

interface PreviewRailProps {
  /** True while the console is docked, which reveals the dashboard cards. */
  docked: boolean;
  playing: boolean;
  /** Chip in the preview head — which scene colour the panel is showing. */
  viewLabel: string;
  /** One-line caption under the device. */
  caption: string;
  summary: PreviewSummaryRow[];
  statusTitle: string;
  statusDetail: string;
  onTogglePlay: () => void;
  onResetView: () => void;
  children: React.ReactNode;
}

/**
 * The right-hand dashboard: the live device, its transport, and the readouts
 * that used to sit in a monospace strip under the stage. Nothing in here
 * touches how the display renders — it only frames it.
 */
export default function PreviewRail({
  docked,
  playing,
  viewLabel,
  caption,
  summary,
  statusTitle,
  statusDetail,
  onTogglePlay,
  onResetView,
  children,
}: PreviewRailProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  const PlayIcon = playing ? ActionIcon.pause : ActionIcon.play;

  return (
    <div className={`preview-rail ${docked ? "preview-rail-docked" : ""}`}>
      <section className="preview-card">
        <header className="preview-card-head">
          <span className="preview-live">
            <span aria-hidden />
            Live preview
          </span>
          <span className="preview-view-chip">{viewLabel}</span>
        </header>

        <div ref={stageRef} className="preview-stage">
          {children}
        </div>

        <p className="preview-caption">{caption}</p>
      </section>

      <div className="preview-actions" role="group" aria-label="Preview controls">
        <button type="button" className="preview-action" onClick={onTogglePlay}>
          <PlayIcon className="console-icon" />
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
        <button type="button" className="preview-action" onClick={onResetView}>
          <ActionIcon.reset className="console-icon" />
          <span>Reset view</span>
        </button>
        <button type="button" className="preview-action" onClick={toggleFullscreen}>
          <ActionIcon.fullscreen className="console-icon" />
          <span>Fullscreen</span>
        </button>
      </div>

      <section className="preview-summary">
        <header className="preview-summary-head">
          <ActionIcon.sliders className="console-icon" />
          <h2>Parameter summary</h2>
        </header>
        <dl className="preview-summary-list">
          {summary.map((row) => (
            <div key={row.label} className="preview-summary-row">
              <dt>{row.label}</dt>
              <dd className={row.accent ? "preview-summary-accent" : undefined}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="preview-status">
        <ActionIcon.check className="console-icon preview-status-icon" />
        <div>
          <strong>{statusTitle}</strong>
          <small>{statusDetail}</small>
        </div>
      </section>
    </div>
  );
}
