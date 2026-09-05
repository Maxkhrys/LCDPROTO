"use client";

import { BorderBeam } from "border-beam";
import type { BorderBeamColorVariant, BorderBeamSize } from "border-beam";

export interface BeamStyle {
  /** Palette that suits the active console theme. */
  variant: BorderBeamColorVariant;
  /** Whether the surrounding surfaces are light or dark. */
  mode: "light" | "dark";
}

interface BeamProps {
  style: BeamStyle;
  /** The beam only animates while the thing it frames is actually live. */
  active: boolean;
  size?: BorderBeamSize;
  strength?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * House wrapper for the border beam.
 *
 * Deliberately dull defaults: low strength, static colours, and `active`
 * always bound to real state so nothing animates while it means nothing. The
 * palette follows the console theme rather than the library's rainbow default.
 */
export default function Beam({
  style,
  active,
  size = "pulse-inner",
  strength = 0.35,
  className,
  children,
}: BeamProps) {
  return (
    <BorderBeam
      className={className}
      size={size}
      colorVariant={style.variant}
      theme={style.mode}
      staticColors
      strength={strength}
      brightness={0.9}
      active={active}
    >
      {children}
    </BorderBeam>
  );
}
