"use client";

import { motion } from "framer-motion";
import {
  DISPLAY_BACKGROUNDS,
  type StateViewProps,
} from "@/lib/deviceStates";

interface StatePlaceholderProps extends StateViewProps {
  label: string;
  accent: string;
}

/**
 * Temporary stand-in used by every state that has not been designed yet.
 * A state graduates out of this by replacing the body of its own file —
 * nothing here is shared with HOME.
 */
export default function StatePlaceholder({
  size,
  playing,
  speed,
  label,
  accent,
  displayMode,
}: StatePlaceholderProps) {
  const duration = 6 / (speed || 1);
  const background = DISPLAY_BACKGROUNDS[displayMode];

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-full"
      style={{ width: size, height: size, background }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accent}26 0%, ${accent}0d 45%, ${background} 72%)`,
        }}
        animate={playing ? { opacity: [0.65, 1, 0.65] } : { opacity: 0.8 }}
        transition={
          playing
            ? { duration, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[9px] font-medium uppercase tracking-[0.32em]"
          style={{ color: `${accent}99` }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
