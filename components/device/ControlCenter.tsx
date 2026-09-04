"use client";

import { useEffect } from "react";

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
  | "emoji";

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
        <>
          <button
            type="button"
            className="control-center-backdrop"
            aria-label="Close controls"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
          />
          <aside
            id="lcdproto-control-center"
            aria-label="LCDPROTO controls"
            aria-modal="true"
            className="control-center-panel"
            role="dialog"
          >
            <header className="control-center-header">
              <div className="control-center-title-block">
                <div className="control-center-wordmark">LCDPROTO</div>
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
                  ×
                </button>
              </div>
            </header>

            <div className="control-center-layout">
              <nav className="control-center-nav" aria-label="Control sections">
                {GROUPS.map((group) => (
                  <div className="control-center-nav-group" key={group}>
                    <div className="control-center-nav-heading">{group}</div>
                    <div className="control-center-nav-items">
                      {sections
                        .filter((section) => section.group === group)
                        .map((section) => {
                          const selected = section.id === active;
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
                              <span>{section.label}</span>
                              <small>{section.summary}</small>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </nav>

              <section className="control-center-workspace">
                <div className="control-center-section-header">
                  <div>
                    <h1>{activeSection.label}</h1>
                    <p>{activeSection.description}</p>
                  </div>
                  <output>{activeSection.summary}</output>
                </div>
                <div className="control-center-content">{children}</div>
              </section>
            </div>

            <footer className="control-center-footer">
              <span>466 × 466 authored canvas</span>
              <span>All controls stay outside the display</span>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
