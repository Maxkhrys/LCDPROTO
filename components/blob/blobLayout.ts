import {
  BLOB_ASSETS,
  BODY_FRACTION,
  HOME_BODY,
  type BlobAsset,
  type BlobFrame,
} from "@/lib/blobConfig";

export interface FrameAnchor {
  /** Midpoint between the eyes, in source pixels. */
  midX: number;
  midY: number;
  /** Distance between the eye centres, in source pixels. */
  eyeDist: number;
}

export function anchorOf(asset: BlobAsset): FrameAnchor {
  const [lx, ly] = asset.eyeLeft;
  const [rx, ry] = asset.eyeRight;
  return {
    midX: (lx + rx) / 2,
    midY: (ly + ry) / 2,
    eyeDist: Math.hypot(rx - lx, ry - ly),
  };
}

export interface BlobLayout {
  /** Eye-to-eye distance once drawn on the 240px screen. */
  eyeScreen: number;
  /** Where the eye midpoint sits on the screen, in 240-space pixels. */
  anchorX: number;
  anchorY: number;
}

/**
 * Works out the on-screen eye anchor such that the HOME body is centred and
 * spans BODY_FRACTION of the screen. Every frame is then positioned by putting
 * its own eye midpoint on this anchor, scaled so eye distances match — which
 * is what keeps the two frames registered to each other.
 */
export function computeLayout(screen: number): BlobLayout {
  const home = anchorOf(BLOB_ASSETS.home);
  const bodyWidthInEyes = HOME_BODY.width / home.eyeDist;
  const eyeScreen = (screen * BODY_FRACTION) / bodyWidthInEyes;
  const scale = eyeScreen / home.eyeDist;
  return {
    eyeScreen,
    anchorX: screen / 2 - (HOME_BODY.centerX - home.midX) * scale,
    anchorY: screen / 2 - (HOME_BODY.centerY - home.midY) * scale,
  };
}

/** Scale applied to a frame's natural size to match the shared eye distance. */
export function frameScale(frame: BlobFrame, layout: BlobLayout): number {
  return layout.eyeScreen / anchorOf(BLOB_ASSETS[frame]).eyeDist;
}
