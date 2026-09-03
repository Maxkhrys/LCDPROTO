"use client";

import StatePlaceholder from "./StatePlaceholder";
import type { StateViewProps } from "@/lib/deviceStates";

/**
 * Connected — not designed yet.
 * Replace the placeholder below with this state's own animation.
 * Editing this file must not affect any other state.
 */
export default function ConnectedState(props: StateViewProps) {
  return <StatePlaceholder {...props} label="Connected" accent="#C4744F" />;
}
