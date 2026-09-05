/** Adapter only: production controller owns every facial value and cue clock. */
import {
  BehaviourController,
  type BehaviourId,
  type BehaviourConfig,
} from "@/lib/blobBehaviour";
import { BlobJellyPhysics, type JellyTarget } from "@/lib/blobPhysics";
import {
  NEUTRAL_RIG,
  NEUTRAL_BLOB,
  NEUTRAL_ELEMENT,
  type BlobRig,
} from "@/lib/blobRig";
import {
  applyCalibration,
  DEFAULT_FACE_CALIBRATION,
} from "@/lib/blobCalibration";
import { DEFAULT_IDLE } from "@/lib/blobIdle";
export const CLOUD_EMOTIONS = {
  NEUTRAL: "REST",
  HAPPY: "HAPPY_BOUNCE",
  EXCITED: "EXCITED_WIGGLE",
  CURIOUS: "CURIOUS_TILT_LEFT",
  ANGRY: "ANGRY_FLARE",
  SAD: "SAD_DOWNCAST",
  SLEEPY: "SLEEPY_YAWN",
  SURPRISED: "SURPRISE_POP",
} as const satisfies Record<string, BehaviourId>;
export type CloudEmotion = keyof typeof CLOUD_EMOTIONS;
const config: BehaviourConfig = {
  gazePx: DEFAULT_IDLE.gazeDriftPx,
  squash: DEFAULT_IDLE.squashAmount,
  paceScale: DEFAULT_IDLE.activityPace,
  blinkIntervalMs: DEFAULT_IDLE.blinkInterval * 1000,
};
export class CloudPerformance {
  readonly controller = new BehaviourController();
  readonly physics = new BlobJellyPhysics();
  private rig: BlobRig = applyCalibration(
    NEUTRAL_RIG,
    DEFAULT_FACE_CALIBRATION,
  );
  private cue = "REST" as BehaviourId;
  private cueTime = 10;
  private target: JellyTarget = {
    x: 0,
    y: 0,
    depth: 0,
    yaw: 0,
    pitch: 0,
    rotation: 0,
    scaleX: 0,
    scaleY: 0,
    bodyX: 0,
    bodyY: 0,
    bodyRotation: 0,
    bodyScaleX: 0,
    bodyScaleY: 0,
    bodySkewX: 0,
    bodySkewY: 0,
    bodyOriginX: 0,
    bodyOriginY: 0.82,
    bodyDeformAngle: 0,
    jellyAmount: 0.5,
    rippleAmount: 0,
  };
  reset() {
    this.controller.reset();
    this.physics.reset();
    this.cue = "REST";
    this.cueTime = 10;
    this.rig = applyCalibration(NEUTRAL_RIG, DEFAULT_FACE_CALIBRATION);
  }
  trigger(id: BehaviourId) {
    this.controller.cancel();
    this.controller.trigger(id, config);
    this.cue = id;
    this.cueTime = 0;
  }
  update(dtMs: number, auto: boolean): BlobRig {
    if (dtMs <= 0) return this.rig;
    this.controller.update(dtMs, config, auto);
    this.cueTime += dtMs / 1000;
    const d = this.controller.pose(),
      t = this.target;
    // Production face leads. A delayed, finite body envelope adds material acting.
    const phase = Math.max(0, this.cueTime - 0.1);
    const beat = phase < 2.4 ? Math.sin((Math.PI * phase) / 2.4) ** 2 : 0;
    const sad = this.cue.includes("SAD") || this.cue === "TEARY_POUT";
    const sleepy = this.cue.includes("SLEEPY");
    const angry = this.cue.includes("ANGRY");
    const happy =
      this.cue.includes("HAPPY") ||
      this.cue.includes("JOY") ||
      this.cue.includes("LAUGH");
    const surprised = this.cue.includes("SURPRISE") || this.cue.includes("SHOCKED");
    const curious = this.cue.includes("CURIOUS") || this.cue.includes("CONFUSED");

    // Dynamic acting envelopes for NEUTRAL, HAPPY, ANGRY, SURPRISED, SLEEPY, CURIOUS:
    let emotionHopY = 0;
    let emotionBodyScaleX = 0;
    let emotionBodyScaleY = 0;
    let emotionCloudScale = 0;
    let emotionShakeX = 0;
    let emotionBrowLiftLeft = 0;
    let emotionBrowLiftRight = 0;
    let emotionBrowRotLeft = 0;
    let emotionBrowRotRight = 0;
    let emotionEyeOpen = 1.0;
    let emotionEyeScale = 0;
    let emotionMouthCrescent = d.mouthCrescent ?? 0;
    let emotionMouthO = d.mouthO;
    let emotionMouthCurve = d.mouthCurve;
    let emotionMouthD = d.mouthD;

    if (happy && beat > 0.05) {
      // Small anticipation squash -> joy hop -> upward puff -> sharp crescent smile -> settle
      if (phase < 0.35) {
        emotionBodyScaleY -= 0.14 * beat;
        emotionBodyScaleX += 0.1 * beat;
      } else {
        const hop = Math.sin((phase - 0.35) * Math.PI * 1.6);
        emotionHopY = -16 * Math.max(0, hop);
        emotionCloudScale = 0.08 * beat;
      }
      emotionMouthD = Math.max(emotionMouthD, 0.42 * beat);
      emotionMouthCrescent = Math.max(emotionMouthCrescent, 0.88 * beat);
      emotionBrowLiftLeft += 0.16 * beat;
      emotionBrowLiftRight += 0.16 * beat;
    } else if (angry && beat > 0.05) {
      // Compact body, tightened lobes, angry inward brow angle, frustrated shake
      emotionBodyScaleX -= 0.08 * beat;
      emotionBodyScaleY -= 0.06 * beat;
      emotionCloudScale = -0.05 * beat;
      emotionBrowRotLeft += 7 * beat;
      emotionBrowRotRight -= 7 * beat;
      emotionEyeOpen = 1 - 0.28 * beat;
      emotionShakeX = Math.sin(phase * 34) * 2.5 * beat;
      emotionMouthCurve = Math.min(emotionMouthCurve, -0.6 * beat);
    } else if (surprised && beat > 0.05) {
      // Instant vertical puff, wide eyes, O mouth
      emotionHopY = -14 * beat;
      emotionCloudScale = 0.14 * beat;
      emotionEyeScale = 0.22 * beat;
      emotionEyeOpen = 1 + 0.25 * beat;
      emotionMouthO = Math.max(emotionMouthO, 0.95 * beat);
      emotionBrowLiftLeft += 0.35 * beat;
      emotionBrowLiftRight += 0.35 * beat;
    } else if (sleepy && beat > 0.05) {
      // Heavy lids, widened/soft body, sagging lobes, yawn
      emotionBodyScaleX += 0.15 * beat;
      emotionBodyScaleY -= 0.16 * beat;
      emotionHopY = 8 * beat;
      emotionEyeOpen = Math.max(0.25, 1 - 0.65 * beat);
      if (phase > 0.4 && phase < 1.6) {
        emotionMouthO = Math.max(emotionMouthO, 0.7 * Math.sin((phase - 0.4) * Math.PI));
      }
    } else if (curious && beat > 0.05) {
      // Gaze leads, asymmetrical brow raise (left higher), core tilt
      emotionBrowLiftLeft += 0.42 * beat;
      emotionBrowLiftRight -= 0.06 * beat;
      t.bodySkewX = 6 * beat;
      t.bodyRotation = 4 * beat;
      t.x += 10 * beat;
    }

    t.x = d.blobX * 0.55 + emotionShakeX;
    t.y = d.blobY * 0.6 + emotionHopY + (sad ? 10 * beat : 0);
    t.rotation = d.blobRotation;
    t.scaleX = d.blobScaleX;
    t.scaleY = d.blobScaleY;
    t.bodyX = d.bodyX;
    t.bodyY = d.bodyY;
    t.bodyScaleX = d.bodyScaleX + emotionBodyScaleX;
    t.bodyScaleY = d.bodyScaleY + emotionBodyScaleY;
    t.bodyRotation = d.bodyRotation;
    t.bodySkewX = d.bodySkewX;
    t.bodySkewY = d.bodySkewY;
    const physical = this.physics.update(dtMs, t);
    this.rig = applyCalibration(
      {
        blob: {
          ...NEUTRAL_BLOB,
          x: physical.x,
          y: physical.y,
          rotation: physical.rotation,
          scale: 1 + d.blobScale * 0.4 + emotionCloudScale,
          opacity: d.blobOpacity,
        },
        body: {
          ...NEUTRAL_ELEMENT,
          x: physical.bodyX,
          y: physical.bodyY,
          rotation: physical.bodyRotation,
          scaleX: 1 + physical.scaleX + physical.bodyScaleX,
          scaleY: 1 + physical.scaleY + physical.bodyScaleY,
          skewX: physical.bodySkewX,
          skewY: physical.bodySkewY,
        },
        leftEye: {
          ...NEUTRAL_ELEMENT,
          x: d.eyeX + d.leftEyeX,
          y: d.eyeY + d.leftEyeY,
          eyeOpen: d.eyeLid * d.leftEyeTension * emotionEyeOpen,
          eyeSocketScaleX: 1 + d.leftEyeScaleX + emotionEyeScale,
          eyeSocketScaleY: 1 + d.leftEyeScaleY + emotionEyeScale,
          browLift: d.leftEyeTension - 1 + emotionBrowLiftLeft,
          browRotation: d.leftBrowRotation + emotionBrowRotLeft,
          lidBias: d.leftLidBias,
          pupilX: d.leftPupilX,
          pupilY: d.leftPupilY,
          pupilScale: d.pupilScale,
          rotation: d.leftEyeRotation,
        },
        rightEye: {
          ...NEUTRAL_ELEMENT,
          x: d.eyeX + d.rightEyeX,
          y: d.eyeY + d.rightEyeY,
          eyeOpen: d.eyeLid * d.rightEyeTension * emotionEyeOpen,
          eyeSocketScaleX: 1 + d.rightEyeScaleX + emotionEyeScale,
          eyeSocketScaleY: 1 + d.rightEyeScaleY + emotionEyeScale,
          browLift: d.rightEyeTension - 1 + emotionBrowLiftRight,
          browRotation: d.rightBrowRotation + emotionBrowRotRight,
          lidBias: d.rightLidBias,
          pupilX: d.rightPupilX,
          pupilY: d.rightPupilY,
          pupilScale: d.pupilScale,
          rotation: d.rightEyeRotation,
        },
        mouth: {
          ...NEUTRAL_ELEMENT,
          x: d.mouthX,
          y: d.mouthY,
          scaleX: 1 + d.mouthScaleX,
          scaleY: 1 + d.mouthScaleY,
          opacity: d.mouthOpacity,
          mouthCurve: emotionMouthCurve,
          mouthO: emotionMouthO,
          mouthD: emotionMouthD,
          mouthCrescent: emotionMouthCrescent,
        },
      },
      DEFAULT_FACE_CALIBRATION,
    );
    return this.rig;
  }
}
