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
  onClose: () => void;
}

const ms = (value: number) => `${Math.round(value)}ms`;

/**
 * Developer-only screen browser.
 *
 * This is an editor tool and is deliberately rendered outside the circular
 * display: nothing in this file may ever be drawn inside the 466x466 canvas.
 * Any screen can be previewed on its own here without running a whole flow.
 */
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
  onClose,
}: ScreenBrowserProps) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SCREEN_CATEGORIES.map((category) => ({
      ...category,
      screens: SCREENS.filter(
        (screen) =>
          screen.category === category.id &&
          (needle === "" ||
            screen.label.toLowerCase().includes(needle) ||
            screen.id.toLowerCase().includes(needle))
      ),
    })).filter((group) => group.screens.length > 0);
  }, [query]);

  const active = getScreen(snapshot.screen);

  return (
    <div className="screen-browser flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
            Screen browser
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/35">
            Preview any lifecycle screen on its own.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close screen browser"
          className="rounded-md px-1.5 text-lg leading-none text-white/35 transition-colors hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
        >
          ×
        </button>
      </div>
      <div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          className="mt-2 w-full rounded-md border border-white/[0.08] bg-black/50 px-2 py-1.5 font-mono text-[10px] tracking-wide text-white/70 outline-none placeholder:text-white/20 focus:border-white/25"
        />
      </div>

      <div className="flex flex-wrap gap-1">
        <BrowserButton onClick={snapshot.playing ? onPause : onPlay}>
          {snapshot.playing ? "Pause" : "Play"}
        </BrowserButton>
        <BrowserButton onClick={onReplay}>Replay</BrowserButton>
        <BrowserButton onClick={onReset}>Reset</BrowserButton>
      </div>

      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
          Auto sequence
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
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
      </div>

      {/* Readout: everything the brief asks to be visible while previewing. */}
      <div className="flex flex-col gap-1 rounded-md border border-white/[0.07] bg-black/50 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
        <Row label="Screen" value={active.label} highlight />
        <Row
          label="Elapsed"
          value={
            active.durationMs > 0
              ? `${ms(snapshot.elapsedMs)} / ${ms(active.durationMs)}`
              : `${ms(snapshot.elapsedMs)} / hold`
          }
        />
        <Row
          label="Progress"
          value={`${Math.round(snapshot.progress * 100)}%${
            snapshot.external ? " ext" : ""
          }`}
        />
        <Row label="Native" value={`${nativeResolution}x${nativeResolution}`} />
        <Row label="Interrupt" value={active.interruptible ? "yes" : "locked"} />
        <Row label="Status" value={active.status} />
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-white/25">FPS</span>
          <span className="flex gap-1">
            {[30, 60].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onFps(option)}
                className={`rounded px-1.5 py-0.5 transition-colors ${
                  fps === option
                    ? "bg-white/15 text-white/80"
                    : "text-white/30 hover:text-white/60"
                }`}
              >
                {option}
              </button>
            ))}
          </span>
        </div>
      </div>

      {/* Progress bar for the running screen. */}
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-white/45 transition-[width] duration-100"
          style={{ width: `${Math.round(snapshot.progress * 100)}%` }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.id} className="mb-3">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.screens.map((screen) => {
                const isActive = screen.id === snapshot.screen;
                return (
                  <button
                    key={screen.id}
                    type="button"
                    data-screen={screen.id}
                    title={screen.description}
                    onClick={() => onSelect(screen.id)}
                    className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                      isActive
                        ? "bg-white/[0.12] text-white/90"
                        : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
                    }`}
                  >
                    <span className="truncate">{screen.label}</span>
                    {screen.status === "placeholder" && (
                      <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/25">
                        wip
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/25">{label}</span>
      <span className={highlight ? "text-white/75" : "text-white/50"}>
        {value}
      </span>
    </div>
  );
}

function BrowserButton({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[10px] tracking-wide transition-colors ${
        active
          ? "border-white/25 bg-white/[0.1] text-white/85"
          : "border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}
