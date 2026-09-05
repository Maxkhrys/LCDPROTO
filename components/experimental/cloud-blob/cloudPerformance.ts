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
    t.x = d.blobX * 0.55;
    t.y = d.blobY * 0.6 + beat * (sad ? 10 : sleepy ? 5 : happy ? -5 : 0);
    t.rotation = d.blobRotation;
    t.scaleX = d.blobScaleX;
    t.scaleY = d.blobScaleY;
    t.bodyX = d.bodyX;
    t.bodyY = d.bodyY;
    t.bodyScaleX =
      d.bodyScaleX + beat * (sad || sleepy ? 0.1 : angry ? -0.06 : 0);
    t.bodyScaleY =
      d.bodyScaleY - beat * (sad || sleepy ? 0.12 : angry ? 0.08 : 0);
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
          scale:
            1 + d.blobScale * 0.4 + beat * (happy ? 0.035 : angry ? -0.035 : 0),
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
          eyeOpen: d.eyeLid * d.leftEyeTension,
          eyeSocketScaleX: 1 + d.leftEyeScaleX,
          eyeSocketScaleY: 1 + d.leftEyeScaleY,
          browLift: d.leftEyeTension - 1,
          browRotation: d.leftBrowRotation,
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
          eyeOpen: d.eyeLid * d.rightEyeTension,
          eyeSocketScaleX: 1 + d.rightEyeScaleX,
          eyeSocketScaleY: 1 + d.rightEyeScaleY,
          browLift: d.rightEyeTension - 1,
          browRotation: d.rightBrowRotation,
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
          mouthCurve: d.mouthCurve,
          mouthO: d.mouthO,
          mouthD: d.mouthD,
        },
      },
      DEFAULT_FACE_CALIBRATION,
    );
    return this.rig;
  }
}
