"use client";

import BlobStage from "@/components/blob/BlobStage";
import type { DeviceState, StateViewProps } from "@/lib/deviceStates";

/**
 * HOME and SENSED are rendered by this one component on purpose.
 *
 * SENSED is currently the HOME -> REACTION test, and that transition has to be
 * continuous — the body must never blink or crossfade. Sharing a single mounted
 * canvas (see `continuity` in lib/deviceStates.ts) is what makes the body
 * provably stationary while only the face changes.
 *
 * Every other state stays fully independent.
 */
export default function BlobState({
  state,
  ...props
}: StateViewProps & { state: DeviceState }) {
  return <BlobStage {...props} expression={state === "SENSED" ? "reaction" : "home"} />;
}
