import type { BehaviourId } from "./blobBehaviour";
import type { DeviceState } from "./deviceStates";

export type ExpressionCategory =
  | "Gaze"
  | "Lids"
  | "Body"
  | "Mouth"
  | "Idle"
  | "Angry"
  | "Sad"
  | "Action"
  | "Emotion"
  | "Variants";
export type ExpressionFilter = "ALL" | ExpressionCategory;

export interface ExpressionEntry {
  id: BehaviourId;
  label: string;
  hint: string;
}

export interface ExpressionGroup {
  id: ExpressionCategory;
  label: string;
  entries: readonly ExpressionEntry[];
}

/**
 * HOME's authored vocabulary. Keep future state vocabularies beside this
 * catalog rather than scattering preview buttons through the simulator UI.
 */
export const HOME_EXPRESSION_GROUPS: readonly ExpressionGroup[] = [
  {
    id: "Gaze",
    label: "Gaze",
    entries: [
      { id: "GLANCE_LEFT", label: "Glance left", hint: "eyes lead" },
      { id: "GLANCE_RIGHT", label: "Glance right", hint: "eyes lead" },
      { id: "LOOK_UP", label: "Look up", hint: "curious lift" },
      { id: "LOOK_DOWN", label: "Look down", hint: "soft retreat" },
      { id: "CURIOUS_TILT_LEFT", label: "Curious left", hint: "tilt + lean" },
      { id: "CURIOUS_TILT_RIGHT", label: "Curious right", hint: "tilt + lean" },
    ],
  },
  {
    id: "Lids",
    label: "Lids & eyes",
    entries: [
      { id: "NORMAL_BLINK", label: "Blink", hint: "single closure" },
      { id: "DOUBLE_BLINK", label: "Double blink", hint: "quick repeat" },
      { id: "SOFT_SQUINT", label: "Soft squint", hint: "both eyes" },
      { id: "ONE_EYE_SQUINT_LEFT", label: "Left squint", hint: "asymmetric" },
      { id: "ONE_EYE_SQUINT_RIGHT", label: "Right squint", hint: "asymmetric" },
      { id: "CURIOUS_WIDE", label: "Curious wide", hint: "open + alert" },
    ],
  },
  {
    id: "Body",
    label: "Jelly body",
    entries: [
      { id: "BODY_SETTLE", label: "Body settle", hint: "drop + recover" },
      { id: "TINY_SQUISH", label: "Tiny squish", hint: "quick compression" },
      { id: "SOFT_SWAY_LEFT", label: "Sway left", hint: "weight shift" },
      { id: "SOFT_SWAY_RIGHT", label: "Sway right", hint: "weight shift" },
      { id: "SIDE_SQUISH_LEFT", label: "Side squish left", hint: "volume shift" },
      { id: "SIDE_SQUISH_RIGHT", label: "Side squish right", hint: "volume shift" },
      { id: "TALL_STRETCH", label: "Tall stretch", hint: "upward pull" },
      { id: "JELLY_TWIST_LEFT", label: "Twist left", hint: "surface twist" },
      { id: "JELLY_TWIST_RIGHT", label: "Twist right", hint: "surface twist" },
      { id: "BREATH_STRETCH", label: "Breath stretch", hint: "slow inhale" },
    ],
  },
  {
    id: "Mouth",
    label: "Mouth",
    entries: [
      { id: "MOUTH_RELAX", label: "Relax", hint: "soft smile" },
      { id: "MOUTH_TWITCH", label: "Twitch", hint: "tiny asymmetry" },
      { id: "MOUTH_O", label: "Round O", hint: "open shape" },
      { id: "MOUTH_FLIP", label: "Frown", hint: "curve morph" },
    ],
  },
  {
    id: "Idle",
    label: "Idle life",
    entries: [
      {
        id: "IDLE_SOFT_BREATH",
        label: "Soft breath",
        hint: "quiet inhale",
      },
      {
        id: "IDLE_LOOK_AROUND",
        label: "Look around",
        hint: "small glance",
      },
      { id: "IDLE_SETTLE", label: "Idle settle", hint: "weight drops" },
      { id: "CASUAL_SQUINT", label: "Casual squint", hint: "laid-back pause" },
      { id: "LAZY_LOOK", label: "Lazy look", hint: "slow glance" },
      { id: "SOFT_SIGH", label: "Soft sigh", hint: "settle + release" },
    ],
  },
  {
    id: "Angry",
    label: "Angry",
    entries: [
      { id: "ANGRY_BROWS", label: "Angry brows", hint: "inner corners down" },
      { id: "ANGRY_STARE", label: "Stare", hint: "tight + weighted" },
      { id: "ANGRY_SQUINT", label: "Hard squint", hint: "side compression" },
      { id: "ANGRY_TILT", label: "Angry tilt", hint: "one eye + twist" },
    ],
  },
  {
    id: "Sad",
    label: "Sad",
    entries: [
      { id: "SAD_DOWNCAST", label: "Downcast", hint: "drop + frown" },
      { id: "SAD_WOBBLE", label: "Small wobble", hint: "soft sway" },
      { id: "SAD_SMALL", label: "Small sad", hint: "quiet retreat" },
    ],
  },
  {
    id: "Action",
    label: "Big beats",
    entries: [
      { id: "SPIN_360", label: "360 spin", hint: "full turn" },
      { id: "WALL_IMPACT_LEFT", label: "Wall hit left", hint: "hard squash" },
      { id: "WALL_IMPACT_RIGHT", label: "Wall hit right", hint: "hard squash" },
      { id: "CREEP_IN_LEFT", label: "Creep in left", hint: "peek from edge" },
      { id: "CREEP_IN_RIGHT", label: "Creep in right", hint: "peek from edge" },
      { id: "POP_OUT_IN", label: "Pop in", hint: "drop from above" },
      { id: "VANISH_REAPPEAR", label: "Vanish + reappear", hint: "emote return" },
    ],
  },
  {
    id: "Emotion",
    label: "Major emotions",
    entries: [
      { id: "HAPPY_BOUNCE", label: "Happy bounce", hint: "bright squish" },
      { id: "SHOCKED_RECOIL", label: "Shocked recoil", hint: "wide + retreat" },
      { id: "CONFUSED_TILT", label: "Confused tilt", hint: "crooked look" },
      { id: "SLEEPY_MELT", label: "Sleepy melt", hint: "down + soften" },
      { id: "LAUGH_SQUISH", label: "Laugh squish", hint: "happy compression" },
      { id: "PLAYFUL_WINK", label: "Playful wink", hint: "wink + sway" },
      { id: "PANIC_SHAKE", label: "Panic shake", hint: "quick wobble" },
      { id: "PROUD_STRETCH", label: "Proud stretch", hint: "lift + hold" },
    ],
  },
] as const satisfies readonly ExpressionGroup[];

export const EXPRESSION_FILTERS: readonly ExpressionFilter[] = [
  "ALL",
  "Gaze",
  "Lids",
  "Body",
  "Mouth",
  "Idle",
  "Angry",
  "Sad",
  "Action",
  "Emotion",
  "Variants",
];

const SENSED_VARIANT_GROUP: ExpressionGroup = {
  id: "Variants",
  label: "SENSED variants",
  entries: [
    {
      id: "SENSED_WORRIED",
      label: "Worried",
      hint: "down + frown + settle",
    },
    {
      id: "SENSED_SURPRISED",
      label: "Surprised",
      hint: "wide + O + stretch",
    },
  ],
};

/** Add each future device-state vocabulary here as it gets authored. */
export const EXPRESSION_GROUPS_BY_STATE: Partial<
  Record<DeviceState, readonly ExpressionGroup[]>
> = {
  HOME: HOME_EXPRESSION_GROUPS,
  SENSED: [...HOME_EXPRESSION_GROUPS, SENSED_VARIANT_GROUP],
};
