"use client";

import StatePlaceholder from "./StatePlaceholder";
import type { StateViewProps } from "@/lib/deviceStates";

/**
 * Sync — not designed yet.
 * Replace the placeholder below with this state's own animation.
 * Editing this file must not affect any other state.
 */
export default function SyncState(props: StateViewProps) {
  return <StatePlaceholder {...props} label="Sync" accent="#B99A4F" />;
}
