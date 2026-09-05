"use client";

import { useCallback, useRef, useState } from "react";
import { ActionIcon } from "./ConsoleIcons";
import Beam, { type BeamStyle } from "./Beam";

export interface PreviewSummaryRow {
  label: string;
  value: string;
  accent?: boolean;
}

interface PreviewRailProps {
  /** True while the console is docked, which reveals the dashboard cards. */
  docked: boolean;
  playing: boolean;
  /** Chip in the preview head — which scene the panel is showing. */
  viewLabel: string;
  /** One-line caption under the device. */
  caption: string;
  summary: PreviewSummaryRow[];
  /** Deeper read-only diagnostics, shown on the Inspector tab. */
  inspector: PreviewSummaryRow[];
  statusTitle: string;
  statusDetail: string;
  /** Beam palette for the active console theme. */
  beam: BeamStyle;
  onTogglePlay: () => void;
  onResetView: () => void;
  children: React.ReactNode;
}

function SummaryList({ rows }: { rows: PreviewSummaryRow[] }) {
  return (
    <dl className="preview-summary-list">
      {rows.map((row) => (
        <div key={row.label} className="preview-summary-row">
          <dt>{row.label}</dt>
          <dd className={row.accent ? "preview-summary-accent" : undefined}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
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
  inspector,
  statusTitle,
  statusDetail,
  beam,
  onTogglePlay,
  onResetView,
  children,
}: PreviewRailProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"preview" | "inspector">("preview");

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  const PlayIcon = playing ? ActionIcon.pause : ActionIcon.play;

  return (
    <div className={`preview-rail ${docked ? "preview-rail-docked" : ""}`}>
      {docked && (
        <div className="preview-tabs" role="tablist" aria-label="Preview mode">
          {(["preview", "inspector"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`preview-tab ${tab === id ? "preview-tab-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {id === "preview" ? "Preview" : "Inspector"}
            </button>
          ))}
        </div>
      )}

      <div className="preview-panel">
        {/* The stage stays mounted on both tabs: hiding it would restart the
            display. The Inspector simply stacks its readout above it. */}
        <section className="preview-card" hidden={docked && tab !== "preview"}>
          <header className="preview-card-head">
            <Beam style={beam} active={playing} strength={0.3} className="beam-inline">
              <span className="preview-live">
                <span aria-hidden />
                Live preview
              </span>
            </Beam>
            <span className="preview-view-chip">{viewLabel}</span>
          </header>

          <div ref={stageRef} className="preview-stage">
            {children}
          </div>

          <p className="preview-caption">{caption}</p>
        </section>

        {docked && tab === "inspector" && (
          <section className="preview-inspector">
            <h2>Device inspector</h2>
            <SummaryList rows={inspector} />
          </section>
        )}

        <div className="preview-actions" role="group" aria-label="Preview controls">
          <button type="button" className="preview-action" onClick={onTogglePlay}>
            <i>
              <PlayIcon className="console-icon" />
            </i>
            <span>{playing ? "Pause" : "Play"}</span>
          </button>
          <button type="button" className="preview-action" onClick={onResetView}>
            <i>
              <ActionIcon.reset className="console-icon" />
            </i>
            <span>Reset view</span>
          </button>
          <button type="button" className="preview-action" onClick={toggleFullscreen}>
            <i>
              <ActionIcon.fullscreen className="console-icon" />
            </i>
            <span>Fullscreen</span>
          </button>
        </div>

        <section className="preview-summary">
          <header className="preview-summary-head">
            <ActionIcon.sliders className="console-icon" />
            <h2>Parameter summary</h2>
          </header>
          <SummaryList rows={summary} />
        </section>

        <Beam style={beam} active={playing} strength={0.22} className="beam-block">
          <section className="preview-status">
            <ActionIcon.check className="console-icon preview-status-icon" />
            <div>
              <strong>{statusTitle}</strong>
              <small>{statusDetail}</small>
            </div>
          </section>
        </Beam>
      </div>
    </div>
  );
}
