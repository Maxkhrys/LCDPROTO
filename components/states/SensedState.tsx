"use client";

import StatePlaceholder from "./StatePlaceholder";
import type { StateViewProps } from "@/lib/deviceStates";

/**
 * Sensed — not designed yet.
 * Will be rebuilt as facial-layer transforms on the locked body rig; the old
 * full-image crossfade has been retired.
 */
export default function SensedState(props: StateViewProps) {
  return <StatePlaceholder {...props} label="Sensed" accent="#5B6BD0" />;
}
