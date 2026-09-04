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
        background:
          "linear-gradient(160deg, #24242a 0%, #101013 38%, #08080a 62%, #1c1c21 100%)",
        boxShadow:
          "0 30px 70px -30px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 1px rgba(255,255,255,0.07)",
      }}
    >
      {/* Inner lip where the glass meets the housing. */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: bezel - 2,
          boxShadow:
            "inset 0 0 0 1px rgba(0,0,0,0.9), inset 0 0 6px 2px rgba(0,0,0,0.8)",
        }}
      />
      {children}
      {/* Faint glass reflection across the top edge. */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: bezel,
          background:
            "linear-gradient(198deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.012) 22%, rgba(255,255,255,0) 46%)",
        }}
      />
    </div>
  );
}
