"use client";

import { useEffect } from "react";
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
  onOpenChange: (open: boolean) => void;
  onActiveChange: (section: ControlSectionId) => void;
  onReset: () => void;
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
  onOpenChange,
  onActiveChange,
  onReset,
  children,
}: ControlCenterProps) {
  const activeSection =
    sections.find((section) => section.id === active) ?? sections[0];

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onOpenChange, open]);

  return (
    <div className="control-center-root">
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
        <aside
          id="lcdproto-control-center"
          aria-label="LCDPROTO controls"
          className="control-center-panel"
          role="region"
        >
          <header className="control-center-header">
            <div className="control-center-title-block">
              <div className="control-center-brand">
                <div className="control-center-wordmark">LCDPROTO</div>
                <div className="control-center-tagline">Creative hardware console</div>
              </div>
              <div className="control-center-live">
                <span aria-hidden />
                Console live
              </div>
            </div>
            <div className="control-center-header-actions">
              <button type="button" className="control-center-reset" onClick={onReset}>
                Reset all
              </button>
              <button
                type="button"
                className="control-center-close"
                aria-label="Close controls"
                autoFocus
                onClick={() => onOpenChange(false)}
              >
                <ActionIcon.close className="console-icon" />
              </button>
            </div>
          </header>

          <div className="control-center-layout">
            <nav className="control-center-nav" aria-label="Control sections">
              <div className="control-center-nav-scroll">
                {GROUPS.map((group) => (
                  <div className="control-center-nav-group" key={group}>
                    <div className="control-center-nav-heading">{group}</div>
                    <div className="control-center-nav-items">
                      {sections
                        .filter((section) => section.group === group)
                        .map((section) => {
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
                ))}
              </div>

              <div className="control-center-device-card">
                <span className="control-center-device-dot" aria-hidden />
                <span className="control-center-device-text">
                  <strong>{statusLabel}</strong>
                  <small>{statusDetail}</small>
                </span>
              </div>
            </nav>

            <section className="control-center-workspace">
              <div className="control-center-section-header">
                <div>
                  <h1>{activeSection.label}</h1>
                  <p>{activeSection.description}</p>
                </div>
                <div className="control-center-section-chip">
                  <span>Active</span>
                  <output>{activeSection.summary}</output>
                </div>
              </div>
              <div className="control-center-content">{children}</div>
            </section>
          </div>
        </aside>
      )}
    </div>
  );
}
