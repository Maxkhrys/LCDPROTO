"use client";

import type { ControlSectionId } from "./ControlCenter";

/**
 * The console icon set.
 *
 * One stroked 24-grid family so every nav row, card heading and preview action
 * shares the same weight. Icons are decorative: the label next to them always
 * carries the meaning, so they stay aria-hidden.
 */
type IconProps = { className?: string };

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const ConsoleIcon = {
  screens: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
      <path d="M9 20h6M12 16.5V20" />
    </Svg>
  ),
  activity: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 12h3.5l2.5 6 3.5-13 2.5 9 1.8-2H21" />
    </Svg>
  ),
  character: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7.5 17.5a4.5 4.5 0 0 1-.7-8.95 5.2 5.2 0 0 1 10-1.2A3.9 3.9 0 0 1 17 17.5Z" />
    </Svg>
  ),
  blob: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9.6" cy="10.4" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9.5 15c1.6 1.2 3.4 1.2 5 0" />
    </Svg>
  ),
  motion: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 16c3 0 3.5-8 6.5-8s3.5 8 6.5 8" />
      <path d="M17 16h3M4 16H3" />
    </Svg>
  ),
  expressions: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.6 9.8h.01M15.4 9.8h.01" />
      <path d="M8.4 14.2c1.9 1.9 5.3 1.9 7.2 0" />
    </Svg>
  ),
  emoji: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8.5 9h.01M15.5 9h.01M8.8 14.2c1.8 1.6 4.6 1.6 6.4 0" />
    </Svg>
  ),
  performance: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 6.5h9M4 12h16M4 17.5h6" />
      <circle cx="16" cy="6.5" r="2" />
      <circle cx="12.5" cy="17.5" r="2" />
    </Svg>
  ),
  display: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2.8" y="5" width="18.4" height="12.5" rx="2.5" />
      <circle cx="12" cy="11.25" r="3.2" />
    </Svg>
  ),
  environment: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.6 10h16.8M4.6 15h14.8M12 3.6c2.4 2.6 2.4 14.2 0 16.8-2.4-2.6-2.4-14.2 0-16.8Z" />
    </Svg>
  ),
  state: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="7" cy="8" r="2.6" />
      <circle cx="17" cy="16" r="2.6" />
      <path d="M9.6 8H15a2.4 2.4 0 0 1 0 4.8H9a2.4 2.4 0 0 0 0 3.2h5.4" />
    </Svg>
  ),
  playback: (p: IconProps) => (
    <Svg {...p}>
      <path d="M5 16.5V11M9.7 16.5V6.5M14.3 16.5V9M19 16.5v-4" />
    </Svg>
  ),
  tools: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Svg>
  ),
} satisfies Record<ControlSectionId, (p: IconProps) => React.ReactElement>;

export const ActionIcon = {
  search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m15.8 15.8 3.7 3.7" />
    </Svg>
  ),
  sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </Svg>
  ),
  terminal: (p: IconProps) => (
    <Svg {...p}>
      <path d="m5 8 3.6 3.6L5 15.2M11.5 16h7" />
    </Svg>
  ),
  save: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 5.5 18.5 12 8 18.5Z" />
    </Svg>
  ),
  body: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3.5 20 8v8l-8 4.5L4 16V8Z" />
      <path d="M12 12.2 20 8M12 12.2V20.5M12 12.2 4 8" />
    </Svg>
  ),
  scale: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.5 9.5v-5h5M19.5 14.5v5h-5" />
      <path d="M4.5 4.5 19.5 19.5" />
    </Svg>
  ),
  palette: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 2-1.7 2.6-3.4 2.6h-1.4a2 2 0 0 0-1.4 3.4c.5.6.2 2.5-2.3 2.5Z" />
      <circle cx="8.4" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  pause: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9.5 5.5v13M14.5 5.5v13" />
    </Svg>
  ),
  play: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 5.6 18 12 8 18.4Z" />
    </Svg>
  ),
  reset: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
      <path d="M4.2 5.5v4h4" />
    </Svg>
  ),
  fullscreen: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />
    </Svg>
  ),
  check: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.2l2.5 2.4 4.7-4.9" />
    </Svg>
  ),
  copy: (p: IconProps) => (
    <Svg {...p}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.4" />
      <path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9" />
    </Svg>
  ),
  close: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  ),
  chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </Svg>
  ),
  sliders: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  ),
};
