/**
 * Blob's drives — the part of him that actually wants things.
 *
 * The behaviour system before this had an "energy" and a "curiosity" number,
 * but both were derived from a mood lookup table plus noise. Nothing that
 * happened to Blob ever reached them: being grabbed, shaken, pressed into a
 * wall or left alone for two minutes all produced exactly the same internal
 * state. That is why he read as a shuffled playlist rather than a character.
 *
 * Here, drives rise and fall from real events, decay toward their own resting
 * levels, and are what behaviour is chosen against. Mood is an *output* of
 * this model, not a timer.
 *
 * Deterministic and allocation-free: no Math.random, no wall clock, one
 * reused snapshot. The whole model is a dozen scalars, so it ports to the
 * ESP32 unchanged.
 */

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/** What the world did to Blob this frame. */
export interface DriveSignals {
  /** Someone is holding him right now. */
  held: boolean;
  /** 0..1 how hard he is pressed against the display edge. */
  wallPressure: number;
  /** Recent shake energy, 0..1. */
  shake: number;
  /** How fast he is moving, in 466-space pixels per second. */
  speed: number;
  /** True on the frame a grab begins. */
  touched: boolean;
}

export interface DriveState {
  /** Wants to look at and investigate things. */
  curiosity: number;
  /** Physical liveliness. Spent by big movement, recovered by rest. */
  energy: number;
  /** Wants attention. Builds while alone, satisfied by being handled. */
  social: number;
  /** Sense of being settled. Knocked down by rough handling. */
  comfort: number;
  /** Builds when nothing changes. Reset by anything novel. */
  boredom: number;
  /** Seconds since a person last touched him. */
  sinceTouch: number;
  /**
   * Falls as the same treatment repeats, so the tenth shake in a row lands
   * far more weakly than the first. This is what stops him over-reacting.
   */
  habituation: number;
}

/** Resting levels each drive returns to when nothing is happening. */
const REST: Record<keyof Omit<DriveState, "sinceTouch" | "habituation">, number> =
  {
    curiosity: 0.55,
    energy: 0.6,
    social: 0.5,
    comfort: 0.8,
    boredom: 0,
  };

/** Seconds for a drive to close most of the gap to its resting level. */
const RETURN_TAU = 14;

export class BlobDrives {
  private readonly state: DriveState = {
    curiosity: REST.curiosity,
    energy: REST.energy,
    social: REST.social,
    comfort: REST.comfort,
    boredom: 0,
    sinceTouch: 999,
    habituation: 1,
  };
  /** Rolling measure of how eventful the last few seconds were. */
  private stimulation = 0;

  reset() {
    this.state.curiosity = REST.curiosity;
    this.state.energy = REST.energy;
    this.state.social = REST.social;
    this.state.comfort = REST.comfort;
    this.state.boredom = 0;
    this.state.sinceTouch = 999;
    this.state.habituation = 1;
    this.stimulation = 0;
  }

  get snapshot(): Readonly<DriveState> {
    return this.state;
  }

  update(dtMs: number, signals: DriveSignals): Readonly<DriveState> {
    const dt = clamp(dtMs, 0, 250) / 1000;
    if (dt <= 0) return this.state;
    const s = this.state;

    // How much is happening to him right now, 0..1.
    const handling =
      clamp(signals.speed / 220, 0, 1) * 0.5 +
      signals.wallPressure * 0.3 +
      signals.shake * 0.6 +
      (signals.held ? 0.25 : 0);
    const event = clamp(handling, 0, 1);
    this.stimulation += (event - this.stimulation) * (1 - Math.exp(-dt / 0.8));

    if (signals.touched) {
      s.sinceTouch = 0;
      // Being picked up is interesting the first time and less so the tenth.
      s.curiosity = clamp(s.curiosity + 0.22 * s.habituation, 0, 1);
      s.social = clamp(s.social - 0.45 * s.habituation, 0, 1);
      s.boredom = clamp(s.boredom - 0.6, 0, 1);
      s.habituation = clamp(s.habituation - 0.14, 0.25, 1);
    } else {
      s.sinceTouch += dt;
    }

    // Rough handling costs comfort; being left in peace restores it.
    const roughness = signals.wallPressure * 0.6 + signals.shake * 0.9;
    s.comfort = clamp(
      s.comfort + (roughness > 0.05 ? -roughness * dt * 1.4 : dt * 0.06),
      0,
      1
    );

    // Movement burns energy, stillness rebuilds it.
    const exertion = clamp(signals.speed / 260, 0, 1) + signals.shake * 0.5;
    s.energy = clamp(s.energy - exertion * dt * 0.34 + dt * 0.045, 0, 1);

    // Attention hunger grows the longer nobody touches him.
    s.social = clamp(s.social + dt * 0.02 * (s.sinceTouch > 12 ? 1.6 : 0.4), 0, 1);

    // Boredom is the absence of stimulation, not the passage of time: it only
    // climbs while nothing is happening, and any event clears it.
    s.boredom = clamp(
      s.boredom + (this.stimulation < 0.06 ? dt * 0.035 : -dt * 0.6),
      0,
      1
    );

    // Curiosity is spent by boredom and topped back up by novelty.
    s.curiosity = clamp(
      s.curiosity + this.stimulation * dt * 0.25 - s.boredom * dt * 0.05,
      0,
      1
    );

    // Everything drifts back toward its resting level. Habituation recovers
    // slowest, so he stays desensitised for a while after repeated handling.
    const k = 1 - Math.exp(-dt / RETURN_TAU);
    s.curiosity += (REST.curiosity - s.curiosity) * k;
    s.energy += (REST.energy - s.energy) * k;
    s.social += (REST.social - s.social) * k;
    s.comfort += (REST.comfort - s.comfort) * k * 0.5;
    s.habituation = clamp(s.habituation + dt * 0.012, 0.25, 1);

    return s;
  }
}

// --- Turning drives into behaviour ----------------------------------------

export type DriveMood =
  | "CONTENT"
  | "CURIOUS"
  | "SLEEPY"
  | "AMUSED"
  | "DISTRACTED"
  | "THOUGHTFUL";

/**
 * The mood his current drives add up to.
 *
 * Mood used to change on a 6-11 second timer regardless of what was happening,
 * which is why it never seemed connected to anything. Now it is read off the
 * drives, so being shaken makes him distracted and being left alone makes him
 * sleepy, without either being scripted.
 */
export function moodFromDrives(d: Readonly<DriveState>): DriveMood {
  if (d.energy < 0.3 && d.boredom > 0.35) return "SLEEPY";
  if (d.comfort < 0.45) return "DISTRACTED";
  if (d.curiosity > 0.72) return "CURIOUS";
  if (d.energy > 0.72 && d.comfort > 0.6) return "AMUSED";
  if (d.boredom > 0.55) return "THOUGHTFUL";
  return "CONTENT";
}

/**
 * How strongly each drive argues for a given behaviour flavour.
 *
 * Utility scoring rather than filter-and-shuffle: every candidate gets a score
 * from the current drive state, and the best one wins. That is what makes his
 * choices legible — he investigates because he is curious, not because a
 * random number came up.
 */
export interface UtilityWeights {
  /** Wants to move around and explore. */
  explore: number;
  /** Wants to look closely at something. */
  inspect: number;
  /** Wants to be playful. */
  play: number;
  /** Wants to watch quietly. */
  watch: number;
  /** Wants to think / drift. */
  think: number;
  /** Wants to settle and recover. */
  recover: number;
}

export function utilityFromDrives(d: Readonly<DriveState>): UtilityWeights {
  const restless = d.boredom * 0.8 + d.social * 0.4;
  return {
    explore: d.energy * 0.7 + restless * 0.6 + d.curiosity * 0.3,
    inspect: d.curiosity * 1.0 + d.boredom * 0.3 - d.energy * 0.1,
    play: d.energy * 0.8 + d.comfort * 0.5 + (1 - d.social) * 0.3,
    watch: d.curiosity * 0.5 + (1 - d.energy) * 0.4,
    think: d.boredom * 0.6 + (1 - d.energy) * 0.3,
    // Recovery is what he wants after being handled roughly or tired out.
    recover: (1 - d.comfort) * 1.2 + (1 - d.energy) * 0.7,
  };
}
