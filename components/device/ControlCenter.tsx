"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionIcon, ConsoleIcon } from "./ConsoleIcons";

export type ControlSectionId =
  | "screens"
  | "character"
  | "activity"
  | "state"
  | "playback"
  | "blob"
  | "motion"
  | "display"
  | "environment"
  | "tools"
  | "expressions"
  | "emoji"
  | "performance";

export interface ControlSectionDefinition {
  id: ControlSectionId;
  label: string;
  description: string;
  summary: string;
  group: "Monitor" | "Character" | "World" | "System";
}

interface ControlCenterProps {
  open: boolean;
  active: ControlSectionId;
  sections: ControlSectionDefinition[];
  /** Short line under the nav — what the simulated hardware is doing. */
  statusLabel: string;
  statusDetail: string;
  /** The preview rail. It is always mounted so the display never remounts. */
  preview: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  onActiveChange: (section: ControlSectionId) => void;
  onReset: () => void;
  /** Steps the simulated scene colour — the light/theme control in the bar. */
  onCycleScene: () => void;
  /** Copies the current console configuration for flashing to the device. */
  onSaveToDevice: () => Promise<boolean> | boolean;
  children: React.ReactNode;
}

const GROUPS: ControlSectionDefinition["group"][] = [
  "Monitor",
  "Character",
  "World",
  "System",
];

export default function ControlCenter({
  open,
  active,
  sections,
  statusLabel,
  statusDetail,
  preview,
  onOpenChange,
  onActiveChange,
  onReset,
  onCycleScene,
  onSaveToDevice,
  children,
}: ControlCenterProps) {
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);

  const activeSection =
    sections.find((section) => section.id === active) ?? sections[0];

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sections;
    return sections.filter((section) =>
      `${section.label} ${section.group} ${section.summary} ${section.description}`
        .toLowerCase()
        .includes(needle)
    );
  }, [query, sections]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(id);
  }, [saved]);

  return (
    <div className={`control-center-root console-shell ${open ? "console-shell-open" : ""}`}>
      {!open && (
        <button
          type="button"
          className="control-center-launcher"
          aria-expanded="false"
          aria-controls="lcdproto-control-center"
          onClick={() => onOpenChange(true)}
        >
          <span className="control-center-launcher-mark" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>Controls</strong>
            <small>Open console</small>
          </span>
        </button>
      )}

      {open && (
        <header className="console-topbar">
          <div className="control-center-brand">
            <div className="control-center-wordmark">LCDPROTO</div>
            <div className="control-center-tagline">
              Creative hardware for a more expressive world
            </div>
          </div>

          <div className="control-center-live">
            <span aria-hidden />
            Console live
          </div>

          <label className="console-search">
            <ActionIcon.search className="console-icon" />
            <span className="sr-only">Search controls</span>
            <input
              type="search"
              value={query}
              placeholder="Search controls, run commands, or jump to..."
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || !matches[0]) return;
                onActiveChange(matches[0].id);
                setQuery("");
              }}
            />
            <kbd aria-hidden>⌘K</kbd>
          </label>

          <div className="control-center-header-actions">
            <button
              type="button"
              className="control-center-topbar-action control-center-topbar-icon"
              aria-label="Step the scene colour"
              onClick={onCycleScene}
            >
              <ActionIcon.sun className="console-icon" />
            </button>
            <button
              type="button"
              className="control-center-topbar-action control-center-topbar-icon"
              aria-label="Open tuning tools"
              onClick={() => onActiveChange("tools")}
            >
              <ActionIcon.terminal className="console-icon" />
            </button>
            <button type="button" className="control-center-topbar-action" onClick={onReset}>
              Reset all
            </button>
            <button
              type="button"
              className="control-center-topbar-action control-center-topbar-primary"
              title="Copy the current configuration for the device"
              onClick={async () => setSaved(await onSaveToDevice())}
            >
              <ActionIcon.save className="console-icon" />
              <span className="control-center-topbar-label">
                {saved ? "Copied config" : "Save to device"}
              </span>
            </button>
            <button
              type="button"
              className="control-center-topbar-action control-center-topbar-icon"
              aria-label="Close controls"
              autoFocus
              onClick={() => onOpenChange(false)}
            >
              <ActionIcon.close className="console-icon" />
            </button>
          </div>
        </header>
      )}

      <div className="console-body">
        {open && (
          <nav
            id="lcdproto-control-center"
            className="control-center-nav"
            aria-label="Control sections"
          >
            <div className="control-center-nav-scroll">
              {GROUPS.map((group) => {
                const items = matches.filter((section) => section.group === group);
                if (!items.length) return null;
                return (
                  <div className="control-center-nav-group" key={group}>
                    <div className="control-center-nav-heading">{group}</div>
                    <div className="control-center-nav-items">
                      {items.map((section) => {
                        const selected = section.id === active;
                        const Icon = ConsoleIcon[section.id];
                        return (
                          <button
                            key={section.id}
                            type="button"
                            className={`control-center-nav-item ${
                              selected ? "control-center-nav-item-active" : ""
                            }`}
                            aria-current={selected ? "page" : undefined}
                            onClick={() => onActiveChange(section.id)}
                          >
                            <Icon className="console-icon control-center-nav-icon" />
                            <span className="control-center-nav-text">
                              <span>{section.label}</span>
                              <small>{section.summary}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!matches.length && (
                <p className="control-center-nav-empty">No controls match “{query}”.</p>
              )}
            </div>

            <div className="control-center-device-card">
              <span className="control-center-device-dot" aria-hidden />
              <span className="control-center-device-text">
                <strong>{statusLabel}</strong>
                <small>{statusDetail}</small>
              </span>
              <ActionIcon.chevron className="console-icon" />
            </div>
          </nav>
        )}

        {open && (
          <section className="control-center-workspace">
            <div className="control-center-section-header">
              <div>
                <h1>{activeSection.label}</h1>
                <p>{activeSection.description}</p>
              </div>
              <div className="control-center-section-chip">
                <span>Active preset</span>
                <output>{activeSection.summary}</output>
                <ActionIcon.chevron className="console-icon" />
              </div>
            </div>
            <div className="control-center-content">{children}</div>
          </section>
        )}

        {preview}
      </div>
    </div>
  );
}
