"use client";

import StatePlaceholder from "./StatePlaceholder";
import type { StateViewProps } from "@/lib/deviceStates";

/**
 * Recognized — not designed yet.
 * Replace the placeholder below with this state's own animation.
 * Editing this file must not affect any other state.
 */
export default function RecognizedState(props: StateViewProps) {
  return <StatePlaceholder {...props} label="Recognized" accent="#B0587E" />;
}
