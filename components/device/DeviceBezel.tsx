"use client";

import type { ReactNode } from "react";
import { DEVICE_CONFIG } from "@/lib/deviceConfig";

interface DeviceBezelProps {
  /** Rendered diameter of the screen (not including the bezel), in CSS px. */
  screenSize: number;
  children: ReactNode;
}

/**
 * Premium black bezel ring around the round panel. Purely cosmetic — it
 * sits outside the 466x466 render surface and never clips it.
 *
 * The ring is built from three concentric layers rather than one gradient plus
 * a blurred inset:
 *
 *  1. a conic base, so the housing reads as a turned metal ring lit from above
 *     instead of a flat diagonal wash that broke down on the left side;
 *  2. a soft top-lit radial pass for form;
 *  3. a crisp seam drawn exactly on the glass boundary.
 *
 * The previous inner lip sat two pixels *inside* that boundary with a 6px
 * blur, so it smeared over the outermost ring of live pixels — which is what
 * made the bottom arc, where the environment is brightest, look dirty. Nothing
 * now overlaps the display: the seam is a hairline on the edge itself, and the
 * shading falls outward into the housing.
 */
export default function DeviceBezel({ screenSize, children }: DeviceBezelProps) {
  const bezel = Math.round(screenSize * DEVICE_CONFIG.bezelRatio);
  const outer = screenSize + bezel * 2;

  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: outer,
        height: outer,
        padding: bezel,
        // Even, symmetric housing shading. The conic stops are mirrored across
        // the vertical axis so left and right catch the light identically.
        background: `
          radial-gradient(circle at 50% 8%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 42%),
          conic-gradient(from 180deg at 50% 50%,
            #1b1b20 0deg, #0c0c0f 42deg, #08080a 90deg, #0c0c0f 138deg,
            #1b1b20 180deg, #232329 216deg, #26262d 270deg, #232329 324deg, #1b1b20 360deg)
        `,
        // The outer hairline follows the UI theme. A fixed white ring was a
        // rim light on the old dark chrome, but on a light surface the same
        // ring read as an unintended pale halo around the housing.
        boxShadow: `
          0 30px 70px -30px rgba(0,0,0,0.55),
          0 0 0 1px var(--bezel-rim, rgba(0,0,0,0.06)),
          inset 0 1px 1px rgba(255,255,255,0.07)
        `,
      }}
    >
      {/* Housing shading, kept entirely outside the glass. */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: 0,
          boxShadow: `inset 0 0 ${Math.max(3, bezel * 0.55)}px rgba(0,0,0,0.55)`,
        }}
      />

      {children}

      {/*
        Seam and glass reflection, both anchored exactly on the display edge so
        they can never bleed inward over live pixels.
      */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: bezel,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.85), 0 0 3px 1px rgba(0,0,0,0.45)",
          background:
            "linear-gradient(198deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.011) 22%, rgba(255,255,255,0) 46%)",
        }}
      />
    </div>
  );
}
