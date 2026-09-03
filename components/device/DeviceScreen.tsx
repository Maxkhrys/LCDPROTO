"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DEVICE_CONFIG } from "@/lib/deviceConfig";
import {
  getStateMeta,
  type DeviceState,
  type StateViewProps,
} from "@/lib/deviceStates";

import BlobState from "@/components/states/BlobState";
import ApproachingState from "@/components/states/ApproachingState";
import VeryCloseState from "@/components/states/VeryCloseState";
import TogetherState from "@/components/states/TogetherState";
import SyncState from "@/components/states/SyncState";
import ConnectedState from "@/components/states/ConnectedState";
import RecognizedState from "@/components/states/RecognizedState";

type StateView = (p: StateViewProps & { state: DeviceState }) => React.ReactNode;

/** One entry per state — add a state here and in lib/deviceStates.ts only. */
const STATE_VIEWS: Record<DeviceState, StateView> = {
  // HOME and SENSED share BlobState so the reaction transition stays continuous.
  HOME: BlobState,
  SENSED: BlobState,
  APPROACHING: ApproachingState,
  VERY_CLOSE: VeryCloseState,
  TOGETHER: TogetherState,
  SYNC: SyncState,
  CONNECTED: ConnectedState,
  RECOGNIZED: RecognizedState,
};

interface DeviceScreenProps extends Omit<StateViewProps, "size"> {
  state: DeviceState;
  /** Rendered diameter in CSS pixels; the internal buffer stays 240x240. */
  screenSize: number;
}

/**
 * The panel itself. Everything inside is authored at the native 240x240
 * resolution and then scaled as a whole, so the prototype can never
 * accidentally rely on more pixels than the hardware has.
 */
export default function DeviceScreen({
  state,
  screenSize,
  ...viewProps
}: DeviceScreenProps) {
  const native = DEVICE_CONFIG.resolution;
  const scale = screenSize / native;
  const View = STATE_VIEWS[state];

  // States in a continuity group keep one mounted component, so switching
  // between them animates internally instead of crossfading the whole screen.
  const group = getStateMeta(state).continuity;
  const key = `${group ?? state}-${viewProps.runId}`;

  return (
    <div
      className="relative overflow-hidden rounded-full bg-black"
      style={{ width: screenSize, height: screenSize }}
    >
      <div
        style={{
          width: native,
          height: native,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={key}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            style={{ width: native, height: native }}
          >
            <View size={native} state={state} {...viewProps} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
