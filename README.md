# LCDPROTO

Browser prototype for a 1.28" round **240×240** ESP32 LCD device used in cars.

This is **not** the hardware app. It exists only to design and test the on-screen
UI and animations before the physical panel arrives.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run lint
npm run build
```

Vercel-ready: no env vars, no backend, fully static.

## Structure

```
app/                     page shell + global styles
components/device/       DeviceSimulator, DeviceScreen, DeviceBezel
components/blob/         BlobCharacter (layered rig renderer)
scripts/                 extractBlobParts.mjs
components/states/       one file per device state
public/blob/             Blob-body.png + facial layers
lib/deviceConfig.ts      resolution, bezel, fps/speed options
lib/deviceStates.ts      DeviceState type, state table, StateViewProps
lib/blobPhysics.ts       lightweight soft-body spring follow-through
```

## Design space vs rasterisation

Everything inside the panel is **laid out and animated in 240×240 space**, so
the prototype can never rely on more pixels than the hardware has.

Rasterisation is a separate concern. Drawing into a literal 240×240 buffer and
magnifying it to ~500pt on a desktop display throws away ~87% of the artwork's
linear detail and looks mushy — softness the real 32mm panel will not have. So
the canvas backing store is sized to the resolution the panel is actually
displayed at (`renderScale`, capped at 4×), while every coordinate stays in
240-space. Design fidelity is unchanged; only sampling improves.

The **1:1** dev button forces a true 240×240 buffer with nearest-neighbour
scaling, to check exactly what the hardware will show.

Large source art is downscaled by repeated halving (`components/blob/downscale.ts`)
rather than one big `drawImage`, which canvas does with cheap bilinear
filtering.

## Blob character rig

The Blob is a layered rig, never a pre-rendered image per state.

```
public/blob/rig/body.png         606x589  permanent, locked body
public/blob/rig/eye-left.png     281x409
public/blob/rig/eye-right.png    285x426
public/blob/rig/mouth-home.png   440x176
```

All four are produced from `public/blob/Blob-parts2.png` by
`scripts/extractBlobParts.mjs` — rerun it any time the sheet changes:

```bash
node scripts/extractBlobParts.mjs [sheet]
```

### How transparency is recovered

The eyes and mouth are largely black, so keying on darkness would hollow them
out. Instead the background is identified by how far a pixel sits from the flat
sheet background (luminance *and* chroma, since the background is achromatic),
and a flood fill runs inward from the sheet border. Anything the fill cannot
reach is artwork — which is what preserves black interiors and the white eye
highlights alike.

The flood fill deliberately travels *through* the soft glow and stops only at
solid artwork; stopping at the glow would mark every glow pixel "enclosed" and
force it opaque, flattening the edges.

The checkerboard is not recoverable — its contrast measures 4.6/255 against
6.4/255 of compression noise — so it is treated as flat grey. Compositing the
extracted layers back over that grey reproduces the sheet with mean error 4.78
and no pixel off by more than 25, i.e. within the source's own noise.

### Placement

`FACE_PLACEMENT` in `lib/blobRig.ts` positions each facial layer as a fraction
of the body's solid width, with a scale relative to the body's own — the parts
are drawn far larger than life on the sheet. Values were chosen by rendering
candidate grids and comparing at 240x240, not derived from the old artwork.

Nothing in the render pipeline adds glow, stroke, shadow, blur or colour
correction; the layers are drawn exactly as supplied.

## HOME behaviour system

HOME is a small character behaviour system, not a loop. Three stages compose:

**Ambient** (`lib/blobIdle.ts`) runs continuously — a weightless centre-of-mass
drift that eases between seeded targets every 3.2-6s, composite breathing,
sub-degree rotation, and slow silhouette deformation. It starts travelling on
the first frame rather than sitting at zero for its first leg.

**Behaviours** (`lib/blobBehaviour.ts`) fire one at a time with quiet gaps
between them. A separate blink deadline prevents expressive actions from
starving natural eye activity; a due blink waits for the current pose to settle.

| behaviour | weight | duration |
| --- | --- | --- |
| NORMAL_BLINK | timed | 180 ms |
| DOUBLE_BLINK | 14% of blink events | 510 ms |
| GLANCE_LEFT / GLANCE_RIGHT | 14 each | 1450 ms |
| BODY_SETTLE | 16 | 1080 ms |
| TINY_SQUISH | 14 | 820 ms |
| LOOK_UP | 10 | 1550 ms |
| SOFT_SWAY_LEFT / SOFT_SWAY_RIGHT | 8 each | 1600 ms |
| MOUTH_RELAX | 9 | 1550 ms |
| MOUTH_TWITCH | 7 | 620 ms |

A non-blink behaviour never repeats back to back. Default action starts average
about 2.6s apart in a five-minute 30 FPS deterministic run. Blink events average
9/minute, with double blinks bringing visible lid closures to about 10.2/minute.

### Face and body stay connected

Glances move the eyes first and the body follows about 102ms later, leaning 1.1
degrees and shifting 1.15px. The eyes begin returning before the body, and body
settles last. Body deformation is applied to the **whole character**, so the
face is never left sliding across the body.

**Jelly physics** (`lib/blobPhysics.ts`) filters translation, rotation, and
squash targets through five underdamped scalar springs. The body trails, passes
its target once, then loses energy quickly. Spring integration uses small
substeps so 30 and 60 FPS previews have matching motion. It is directly portable
to embedded code and needs no mesh, blur, shader, video, or sprite sequence.

### Interruption

`BehaviourController` is stateful precisely so it can be interrupted.
`cancel()` abandons whatever is running and returns to REST, and `trigger(id)`
cuts in immediately. Every behaviour is a delta on the neutral pose, so a
future device state can take the rig over on any frame without inheriting a
half-finished glance. Total body deformation is clamped to +/-2% regardless
of what the layers add up to.

Scheduling uses a seeded PRNG advanced only inside the animation loop, so runs
are reproducible, `Reset` restarts the schedule exactly, `Pause` freezes it,
and nothing random happens during render.

**Behaviour** toggles the micro-behaviours (leaving the neutral pose plus
ambient); **Idle** toggles the ambient layer. Both off is a completely static
calibrated pose.

## Adding a state's animation

Edit that state's file in `components/states/`. Each file is isolated — replace
the `StatePlaceholder` body with the real animation and no other state changes.
Only HOME is built so far; it renders the layered rig in its neutral pose.
