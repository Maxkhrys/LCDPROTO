# Procedural Blob body — R&D experiment

**Status: experiment only. Nothing here is imported by the production rig,
HOME, or any state view. Do not merge into production without approval.**

Route: `/lab/procedural-blob` (deliberately unlinked from the simulator).

![Procedural body vs master reference](./reference-comparison.png)

## Why Canvas 2D

SVG was the alternative. Canvas 2D won on three counts:

- The rig already renders through canvas (`components/blob/BlobCharacter.tsx`,
  `components/blob/downscale.ts`), so this drops into the same pipeline and the
  same supersample-then-resolve trick that keeps 240px artwork crisp.
- The material needs ~12 clipped gradient washes plus 22 nested shell fills per
  frame. In SVG each of those is a live DOM node the browser must re-layout and
  re-composite when the path data changes every frame; in canvas it is a fill.
- Canvas keeps the model portable. Everything here is paths, linear/radial
  ramps and alpha blends — the operations an ESP32-class 2D blitter can be made
  to approximate. An SVG version would have been harder to translate.

WebGL was not needed and would have been the wrong signal for the target.

## Shape

`blobShape.ts` — **10 anchor points**, closed Catmull-Rom converted to cubic
Beziers, each anchor carrying its own tension.

The neutral table is fitted, not guessed. The master body
(`public/blob/rig/yellow/body.png`) was traced radially from its bounding-box
centre, ten anchors were placed on the trace extrema — the real lobes, notches
and folds — and angle/radius/tension were then optimised against the trace.

Fit quality against the master, measured at the authored 240px size:

| metric | value |
| --- | --- |
| silhouette IoU | **0.988** |
| radial luminance RMS | **8.8 / 255** |
| mean colour error inside the silhouette | ~22 / 255 |

Parameters: `scale`, `scaleX`, `scaleY`, `rotation`, `lean`, `topHeight`,
`leftBulge`, `rightBulge`, `lowerLeftBulge`, `lowerRightBulge`, `bottomSag`,
`squash`, `stretch`, `centerShiftX`, `centerShiftY`, `wobbleAmount`.

Deformation is local, not a uniform transform. Each parameter reaches a
weighted subset of anchors, squash pivots on the base and pushes volume into
the mid lobes, and `centerShift` moves mass — anchors facing the shift travel
with it while trailing anchors follow only partly and so compress.

## Deformation model

`blobPhysics.ts` — one damped spring per parameter, integrated semi-implicitly
with sub-stepping, plus a per-parameter start delay. No mesh, no solver: a few
dozen multiply-adds per frame, and it ports to fixed point.

Damping sits just under critical, so poses overshoot slightly and settle. The
staging the behaviour system will eventually want — eyes react, body follows,
jelly settles last — is expressed as increasing lag and decreasing stiffness
down the parameter list: gross pose first, volume next, lobe bulges and ripple
last, so the jelly is still moving after the pose has arrived.

## Material layers

1. Shell — bright translucent gel, darkening toward the base.
2. Depth shading — 22 nested copies of the silhouette carrying a measured
   luminance curve. This is the layer that makes it read as a volume. A radial
   gradient gets the curve right but the wrong shape; nested silhouettes keep
   the bright shell band a constant distance inside the outline all the way
   round, and deform with the body.
3. Shell lobes — five offset silhouette copies whose overlapping edges are the
   internal folds.
4. Internal illumination — warm light suspended in the core.
5. Particles — 52 sparks and 6 bubbles, deterministic (seeded PRNG, generated
   once at module load, never regenerated per frame).
6. Star flares — three four-point flares.
7. Specular — five soft elliptical highlights, no blur filter.
8. Rim — three stroke passes, all clipped to the silhouette so only the inner
   half of each line survives. Crisp edge, no halo.

Highlights, folds, flares, bubbles and sparks are authored in (angle, depth)
around the centroid and resolved through the live surface ring, so every one of
them deforms with the body instead of sliding over it.

Two palettes: `amber` (the supplied master) and `violet` (the production
Blob's colour, sampled from `public/blob/rig/body.png`).

## Cost

~7.5 ms per frame in Chromium at 2x supersample, measured on the lab page —
roughly 130 fps of headroom against a 60 fps budget. Per frame: one 480x480
buffer, ~34 path fills/strokes, ~10 gradient objects, one halving drawImage to
the 240x240 output. Deterministic detail is cached; nothing is allocated per
frame beyond the gradients.

## What still differs from the master

- The master has fine internal filament texture — wispy striations through the
  core — that is painted, not structural. Not reproduced.
- The master's specular highlights are slightly larger and hotter, with softer
  falloff into the shell.
- The master's fold edges are irregular and hand-drawn; the five nested lobes
  here read as slightly more regular.
- Rim is marginally wider and softer than the master's hardest edge.

## ESP32 limitations

- The 22-shell depth stack is the expensive part. On a framebuffer part it
  should become a precomputed depth LUT sampled per pixel, or a coarser stack.
- No `createRadialGradient` on embedded 2D libraries; ramps become small LUTs.
- Supersampling a 480x480 buffer needs ~900 KB at RGB565. Either render at 240
  with an edge-only AA pass, or supersample the silhouette alone.
- Float springs should become Q16.16 fixed point; the model is already scalar
  and small enough for that.
