"use client";

import DeviceScreen from "@/components/device/DeviceScreen";
import SystemScreenLayer, {
  screenStillness,
  screenVeil,
} from "./SystemScreenLayer";
import { DEVICE_CONFIG } from "@/lib/deviceConfig";
import { getScreen, isDeviceState, type ScreenId } from "@/lib/screenCatalogue";
import type { DeviceState, StateViewProps } from "@/lib/deviceStates";

interface ScreenStageProps extends Omit<StateViewProps, "size"> {
  /** Which catalogue screen is showing. */
  screen: ScreenId;
  /** 0..1 through the screen's own duration. */
  progress: number;
  /** Deterministic loading/pairing/update progress. */
  simulated: number;
  /** Monotonic clock for the few screens with continuous motion. */
  time: number;
  /** Rendered diameter in CSS pixels; the buffer stays 466x466. */
  screenSize: number;
  reducedMotion?: boolean;
}

/**
 * Composes one device screen: the existing state views underneath, a veil, and
 * the system-screen marks on top.
 *
 * Blob is never re-implemented here. Screens that show him mount the ordinary
 * HOME view — same rig, same behaviour system, same environment — and control
 * only how much of it the panel reveals and how quickly it moves. That is why
 * PAUSE and SLEEP need no new Blob code at all.
 */
export default function ScreenStage({
  screen,
  progress,
  simulated,
  time,
  screenSize,
  reducedMotion = false,
  speed,
  screenColour,
  ...viewProps
}: ScreenStageProps) {
  const native = DEVICE_CONFIG.resolution;
  const scale = screenSize / native;
  const definition = getScreen(screen);
  const veil = screenVeil(screen, progress);
  const stillness = screenStillness(screen);
  // A device state renders itself; every system screen borrows HOME as its
  // Blob surface.
  const deviceState: DeviceState = isDeviceState(screen) ? screen : "HOME";

  return (
    <div
      className="relative overflow-hidden rounded-full"
      style={{ width: screenSize, height: screenSize, background: screenColour }}
    >
      {definition.showsBlob && (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <DeviceScreen
            state={deviceState}
            screenSize={screenSize}
            screenColour={screenColour}
            // Quietening Blob is a speed change, not a new behaviour: his
            // breathing and idle keep running, just slower, so a paused device
            // never looks like a frozen one.
            speed={speed * (1 - stillness)}
            {...viewProps}
          />
        </div>
      )}

      {veil > 0.001 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background: "#000",
            opacity: veil,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: native,
          height: native,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <SystemScreenLayer
          size={native}
          renderScale={viewProps.renderScale}
          screen={screen}
          progress={progress}
          simulated={simulated}
          time={time}
          reducedMotion={reducedMotion}
        />
      </div>
    </div>
  );
}
