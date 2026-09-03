"use client";

/**
 * Side-by-side harness for the procedural body experiment.
 *
 * LEFT  — the coded body.
 * RIGHT — the master reference artwork, drawn at the same authored size and
 *         the same BODY_FRACTION, so the two silhouettes can be compared
 *         one pixel against another rather than by eye at different scales.
 *
 * R&D ONLY. This page never touches the production rig or HOME.
 */

import { useCallback, useMemo, useState } from "react";
import { DEVICE_CONFIG } from "@/lib/deviceConfig";
import { BODY_FRACTION, RIG_ASSETS } from "@/lib/blobRig";
import BlobBody, { type DebugOverlays } from "./BlobBody";
import BlobControls, { type Pose } from "./BlobControls";
import type { PaletteId } from "./blobMaterial";

const NATIVE = DEVICE_CONFIG.resolution;

/** The reference body for each palette, so the comparison is like for like. */
const REFERENCE: Record<PaletteId, { src: string; solidWidth: number; width: number; height: number }> = {
  amber: { ...RIG_ASSETS.yellow.body },
  violet: { ...RIG_ASSETS.purple.body },
};

export default function ProceduralBlobTest() {
  const [pose, setPose] = useState<Pose>({});
  const [palette, setPalette] = useState<PaletteId>("amber");
  const [highlightShift, setHighlightShift] = useState(0);
  const [renderScale, setRenderScale] = useState(1);
  const [overlayRef, setOverlayRef] = useState(false);
  const [frameCost, setFrameCost] = useState(0);
  const [debug, setDebug] = useState<DebugOverlays>({
    silhouette: false,
    controlPoints: false,
    boundingBox: false,
    center: false,
  });

  const onFrameCost = useCallback((ms: number) => {
    // Sampled rather than set every frame; this is a dev readout, not state.
    setFrameCost((prev) => (Math.abs(prev - ms) > 0.05 ? ms : prev));
  }, []);

  const ref = REFERENCE[palette];
  // The reference PNG is drawn so its opaque core spans exactly the same
  // fraction of the 240px screen the procedural body uses.
  const refStyle = useMemo(() => {
    const scale = (NATIVE * BODY_FRACTION) / ref.solidWidth;
    return {
      width: `${(ref.width * scale * 100) / NATIVE}%`,
      height: `${(ref.height * scale * 100) / NATIVE}%`,
    };
  }, [ref]);

  const display = 320;

  return (
    <div className="flex w-full flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-end justify-center gap-6">
          <Panel label="Procedural (code)">
            <div style={{ width: display, height: display }} className="relative">
              <BlobBody
                size={NATIVE}
                renderScale={renderScale}
                target={pose}
                palette={palette}
                highlightShift={highlightShift}
                debug={debug}
                onFrameCost={onFrameCost}
              />
              {overlayRef && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.src} alt="" style={{ ...refStyle, opacity: 0.4 }} />
                </div>
              )}
            </div>
          </Panel>

          <Panel label="Master reference (PNG)">
            <div
              style={{ width: display, height: display }}
              className="relative flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ref.src} alt="Master Blob body reference" style={refStyle} />
            </div>
          </Panel>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Toggle
            label={`render scale ${renderScale}x`}
            active={renderScale === 1}
            onClick={() => setRenderScale((v) => (v === 1 ? 2 : 1))}
          />
          <Toggle label="overlay reference" active={overlayRef} onClick={() => setOverlayRef((v) => !v)} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/25">
            authored {NATIVE}×{NATIVE}
          </span>
        </div>
      </div>

      <BlobControls
        pose={pose}
        onPose={setPose}
        palette={palette}
        onPalette={setPalette}
        highlightShift={highlightShift}
        onHighlightShift={setHighlightShift}
        debug={debug}
        onDebug={setDebug}
        frameCost={frameCost}
      />
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="overflow-hidden rounded-full bg-black ring-1 ring-white/10">{children}</div>
      <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </figcaption>
    </figure>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
        active ? "border-white/50 text-white" : "border-white/15 text-white/50 hover:border-white/35"
      }`}
    >
      {label}
    </button>
  );
}
