"use client";

import { useMemo, useState } from "react";
import {
  SCREEN_CATEGORIES,
  SCREEN_FLOWS,
  SCREENS,
  getScreen,
  type FlowId,
  type ScreenId,
} from "@/lib/screenCatalogue";
import type { LifecycleSnapshot } from "@/lib/screenLifecycle";

interface ScreenBrowserProps {
  snapshot: LifecycleSnapshot;
  fps: number;
  nativeResolution: number;
  onSelect: (id: ScreenId) => void;
  onPlayFlow: (flow: FlowId) => void;
  onPlay: () => void;
  onPause: () => void;
  onReplay: () => void;
  onReset: () => void;
  onFps: (fps: number) => void;
}

const ms = (value: number) => `${Math.round(value)}ms`;

/** Developer-only browser. It never renders inside the 466x466 panel. */
export default function ScreenBrowser({
  snapshot,
  fps,
  nativeResolution,
  onSelect,
  onPlayFlow,
  onPlay,
  onPause,
  onReplay,
  onReset,
  onFps,
}: ScreenBrowserProps) {
  const [query, setQuery] = useState("");
  const active = getScreen(snapshot.screen);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SCREEN_CATEGORIES.map((category) => ({
      ...category,
      screens: SCREENS.filter(
        (screen) =>
          screen.category === category.id &&
          (needle === "" ||
            screen.label.toLowerCase().includes(needle) ||
            screen.id.toLowerCase().includes(needle) ||
            screen.description.toLowerCase().includes(needle))
      ),
    })).filter((group) => group.screens.length > 0);
  }, [query]);

  const progress = Math.round(snapshot.progress * 100);

  return (
    <div className="screen-browser">
      <section className="screen-browser-current" aria-label="Current screen">
        <div className="screen-browser-current-main">
          <span>Now showing</span>
          <strong>{active.label}</strong>
          <p>{active.description}</p>
        </div>
        <div className="screen-browser-metrics">
          <BrowserMetric
            label="Elapsed"
            value={
              active.durationMs > 0
                ? `${ms(snapshot.elapsedMs)} / ${ms(active.durationMs)}`
                : `${ms(snapshot.elapsedMs)} / hold`
            }
          />
          <BrowserMetric label="Progress" value={`${progress}%${snapshot.external ? " ext" : ""}`} />
          <BrowserMetric label="Native" value={`${nativeResolution} × ${nativeResolution}`} />
          <BrowserMetric label="Interrupt" value={active.interruptible ? "Yes" : "Locked"} />
        </div>
        <div className="screen-browser-progress" aria-label={`${progress}% complete`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <div className="screen-browser-command-row">
        <div className="screen-browser-actions" aria-label="Screen playback">
          <BrowserButton primary onClick={snapshot.playing ? onPause : onPlay}>
            {snapshot.playing ? "Pause screen" : "Play screen"}
          </BrowserButton>
          <BrowserButton onClick={onReplay}>Replay</BrowserButton>
          <BrowserButton onClick={onReset}>Reset</BrowserButton>
        </div>
        <div className="screen-browser-fps" aria-label="Frame rate">
          <span>Preview FPS</span>
          {[30, 60].map((option) => (
            <BrowserButton key={option} active={fps === option} onClick={() => onFps(option)}>
              {option}
            </BrowserButton>
          ))}
        </div>
      </div>

      <section className="screen-browser-flows">
        <div className="screen-browser-section-title">
          <strong>Run a complete flow</strong>
          <span>Sequences advance automatically</span>
        </div>
        <div className="screen-browser-flow-grid">
          {(Object.keys(SCREEN_FLOWS) as FlowId[]).map((flow) => (
            <BrowserButton
              key={flow}
              active={snapshot.flow === flow}
              onClick={() => onPlayFlow(flow)}
            >
              {SCREEN_FLOWS[flow].label}
            </BrowserButton>
          ))}
        </div>
      </section>

      <section className="screen-browser-library">
        <div className="screen-browser-library-head">
          <div className="screen-browser-section-title">
            <strong>Screen library</strong>
            <span>{SCREENS.length} authored slots</span>
          </div>
          <label className="screen-browser-search">
            <span className="sr-only">Search screens</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, state, or purpose"
            />
          </label>
        </div>

        <div className="screen-browser-groups">
          {groups.map((group) => (
            <section key={group.id} className="screen-browser-group">
              <div className="screen-browser-group-title">
                <h2>{group.label}</h2>
                <span>{group.screens.length}</span>
              </div>
              <div className="screen-browser-list">
                {group.screens.map((screen) => {
                  const isActive = screen.id === snapshot.screen;
                  return (
                    <button
                      key={screen.id}
                      type="button"
                      data-screen={screen.id}
                      aria-pressed={isActive}
                      onClick={() => onSelect(screen.id)}
                      className={`screen-browser-item ${isActive ? "screen-browser-item-active" : ""}`}
                    >
                      <span>
                        <strong>{screen.label}</strong>
                        <small>{screen.description}</small>
                      </span>
                      <em>{screen.status === "placeholder" ? "WIP" : isActive ? "LIVE" : "READY"}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {groups.length === 0 && (
            <div className="screen-browser-empty">No screens match “{query}”.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function BrowserMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function BrowserButton({
  children,
  onClick,
  active = false,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active || undefined}
      className={`screen-browser-button ${active ? "screen-browser-button-active" : ""} ${
        primary ? "screen-browser-button-primary" : ""
      }`}
    >
      {children}
    </button>
  );
}
