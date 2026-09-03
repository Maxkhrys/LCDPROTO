"use client";

import StatePlaceholder from "./StatePlaceholder";
import type { StateViewProps } from "@/lib/deviceStates";

/**
 * Approaching — not designed yet.
 * Replace the placeholder below with this state's own animation.
 * Editing this file must not affect any other state.
 */
export default function ApproachingState(props: StateViewProps) {
  return <StatePlaceholder {...props} label="Approaching" accent="#4F86C6" />;
}
