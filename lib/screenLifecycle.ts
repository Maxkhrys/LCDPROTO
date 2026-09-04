/**
 * Lifecycle controller for the system screens.
 *
 * This owns *only* which screen is showing and how far through it is. It knows
 * nothing about Blob's personality, moods or behaviour scheduler — those keep
 * running underneath whichever screen is up, exactly as they do today.
 *
 * All timing here is simulated and deterministic: no Math.random, no wall-clock
 * reads beyond the frame delta it is handed. Every place a real device event
 * would eventually drive things is marked, and `complete()` / `setProgress()`
 * are the two hooks firmware, WiFi or BLE events will call instead.
 */

import {
  SCREEN_FLOWS,
  getScreen,
  isTerminal,
  type FlowId,
  type ScreenId,
} from "./screenCatalogue";

/**
 * How long a screen with no duration of its own dwells when it appears in the
 * middle of a flow.
 *
 * Device states hold indefinitely by design, which is correct at the end of a
 * flow but stalls one in the middle: the sleep flow starts at HOME, so without
 * this it could never reach PAUSE.
 */
const FLOW_DWELL_MS = 1400;

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** Smootherstep — flat at both ends, so progress never starts or stops hard. */
const ease = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

export interface LifecycleSnapshot {
  screen: ScreenId;
  flow: FlowId | null;
  /** Position within the running flow, or -1 in single-screen preview. */
  index: number;
  elapsedMs: number;
  /** 0 for terminal screens, which hold until something interrupts them. */
  durationMs: number;
  /** Raw 0..1 through the screen's own duration. */
  progress: number;
  /**
   * Eased 0..1 for loading, pairing and update arcs. Replaced wholesale when
   * a real progress source is attached with setProgress().
   */
  simulated: number;
  playing: boolean;
  interruptible: boolean;
  /** True while a real event source is driving progress instead of the clock. */
  external: boolean;
}

export class ScreenLifecycle {
  private screen: ScreenId = "HOME";
  private flow: FlowId | null = null;
  private index = -1;
  private elapsed = 0;
  private playing = true;
  private externalProgress: number | null = null;
  private readonly snapshot: LifecycleSnapshot = {
    screen: "HOME",
    flow: null,
    index: -1,
    elapsedMs: 0,
    durationMs: 0,
    progress: 0,
    simulated: 0,
    playing: true,
    interruptible: true,
    external: false,
  };

  /** Preview one screen on its own, outside any flow. */
  select(id: ScreenId) {
    this.screen = id;
    this.flow = null;
    this.index = -1;
    this.elapsed = 0;
    this.externalProgress = null;
    this.playing = true;
  }

  /** Run a named flow from its first screen. */
  playFlow(flow: FlowId) {
    this.flow = flow;
    this.index = 0;
    this.screen = SCREEN_FLOWS[flow].screens[0];
    this.elapsed = 0;
    this.externalProgress = null;
    this.playing = true;
  }

  play() {
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    this.playing = !this.playing;
  }

  /** Restart the current screen from zero, keeping the flow position. */
  replay() {
    this.elapsed = 0;
    this.externalProgress = null;
    this.playing = true;
  }

  /** Back to the start: first screen of the flow, or the same single screen. */
  reset() {
    this.elapsed = 0;
    this.externalProgress = null;
    this.playing = true;
    if (this.flow) {
      this.index = 0;
      this.screen = SCREEN_FLOWS[this.flow].screens[0];
    }
  }

  /**
   * Cut to another screen mid-flow. Honoured only when the running screen
   * allows it, which is what makes BOOT_BLACK and FIRMWARE_UPDATE safe from
   * being interrupted by an incoming event.
   */
  interrupt(id: ScreenId): boolean {
    if (!getScreen(this.screen).interruptible) return false;
    this.select(id);
    return true;
  }

  /**
   * Firmware hook. Hand it 0..1 to drive a loading, pairing or update arc from
   * a real source; pass null to hand control back to the simulated clock.
   */
  setProgress(value: number | null) {
    this.externalProgress = value === null ? null : clamp(value, 0, 1);
  }

  /** Firmware hook: end the current screen now and advance the flow. */
  complete() {
    this.advance();
  }

  private advance() {
    this.elapsed = 0;
    this.externalProgress = null;
    if (this.flow === null) return;
    const screens = SCREEN_FLOWS[this.flow].screens;
    if (this.index + 1 < screens.length) {
      this.index += 1;
      this.screen = screens[this.index];
      return;
    }
    // Flow finished; hold on its last screen.
    this.flow = null;
    this.index = -1;
  }

  /**
   * Effective duration of the running screen: its own, or a dwell if it is a
   * hold-forever screen sitting mid-flow.
   */
  private effectiveDuration(): number {
    const own = getScreen(this.screen).durationMs;
    if (own > 0) return own;
    if (this.flow === null) return 0;
    const screens = SCREEN_FLOWS[this.flow].screens;
    return this.index >= 0 && this.index < screens.length - 1
      ? FLOW_DWELL_MS
      : 0;
  }

  /** Advances the clock. Returns the reused snapshot object. */
  update(dtMs: number): LifecycleSnapshot {
    const definition = getScreen(this.screen);
    const duration = this.effectiveDuration();

    if (this.playing && duration > 0) {
      this.elapsed += clamp(dtMs, 0, 250);
      if (this.elapsed >= duration) {
        if (this.flow) {
          this.advance();
        } else if (definition.transitionOut === "cut") {
          // Screens that end by cutting to black — SLEEP above all — hold
          // their final frame instead of looping. Looping a sleep preview back
          // to a bright Blob misrepresents what the device actually does; the
          // Replay button is there to watch it again.
          this.elapsed = duration;
        } else {
          // Every other single-screen preview loops, so the developer can keep
          // watching the motion without pressing replay.
          this.elapsed = 0;
        }
      }
    }

    const current = getScreen(this.screen);
    const currentDuration = this.effectiveDuration();
    const progress =
      currentDuration > 0 ? clamp(this.elapsed / currentDuration, 0, 1) : 0;

    this.snapshot.screen = this.screen;
    this.snapshot.flow = this.flow;
    this.snapshot.index = this.index;
    this.snapshot.elapsedMs = this.elapsed;
    this.snapshot.durationMs = currentDuration;
    this.snapshot.progress = progress;
    this.snapshot.simulated =
      this.externalProgress === null ? ease(progress) : this.externalProgress;
    this.snapshot.playing = this.playing;
    this.snapshot.interruptible = current.interruptible;
    this.snapshot.external = this.externalProgress !== null;
    return this.snapshot;
  }

  get currentScreen() {
    return this.screen;
  }

  get isTerminal() {
    return isTerminal(this.screen);
  }
}
