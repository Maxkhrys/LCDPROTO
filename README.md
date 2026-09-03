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
public/blob/rig/green/body.png   593x591
public/blob/rig/green/eye-left.png 275x405
public/blob/rig/green/eye-right.png 279x421
public/blob/rig/green/mouth-home.png 429x171
public/blob/rig/blue/body.png    509x504
public/blob/rig/red/body.png     506x504
public/blob/rig/pink/body.png    572x567
public/blob/rig/orange/body.png  569x579
public/blob/rig/galaxy/body.png  570x579
```

All rigs are produced from their matching parts sheet by
`scripts/extractBlobParts.mjs` — rerun it any time a sheet changes:

```bash
node scripts/extractBlobParts.mjs [sheet]
```

Body-only colour sheets use the companion extractor:

```bash
node scripts/extractBlobColourBodies.mjs [sheet] [output-directory]
```

Current colour selector: purple, teal, yellow, green, blue, red, pink,
orange, and galaxy. New colour bodies reuse the same procedural eye, eyebrow,
mouth, socket, and HOME physics rig.

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

**Ambient** (`lib/blobIdle.ts`) runs continuously — a gravity-like centre-of-mass
drift that eases between seeded waypoints every 2.2-4.2s, with a smaller
650-1250ms current layered over the broad path. It also provides composite
breathing, sub-degree rotation, and slow silhouette deformation. It starts
travelling on the first frame rather than sitting at zero for its first leg.

**Behaviours** (`lib/blobBehaviour.ts`) are staged thought beats. A beat cues
gaze or eyes first, mouth/lids 50-120ms later, then body mass last. Micro-saccades
and blinks remain independent overlays, so the face keeps living while the body
settles.

| behaviour | weight | duration |
| --- | --- | --- |
| NORMAL_BLINK | timed | 180 ms |
| DOUBLE_BLINK | 14% of blink events | 510 ms |
| gaze | glances, look up/down, curious left/right tilts | 1.45-1.85 s |
| eyes | soft squint, independent one-eye squints, curious wide | 1.35-1.75 s |
| mouth | relax, twitch, rounded O, 180-degree expression flip | 0.62-2.1 s |
| body | settle, tiny squish, side squish, sway, tall stretch, twist | 0.82-1.6 s |

A beat starts roughly every 2-4s, with no forced repeated pose. Blink events stay
independent and irregular; the mouth flip is deliberately rare.

### Face and body stay connected

Glances move one clean black eye mass inside a fixed body-space socket; there is
no white pupil dot. The lower eye edge stays planted while the aperture closes
for blinks and squints. Small filled eyebrows inherit the socket transform and
follow expression tension without dropping during a blink. Eye and mouth anchors
inherit the body's final pivot, scale, skew, rotation, and translation; their
artwork receives partial scale compensation to stay crisp. A 9% re-render of
the same body texture crosses the facial region, softening the cut-out edge.

**Jelly physics** (`lib/blobPhysics.ts`) filters whole-character and secondary
body translation, rotation, skew, and squash through underdamped scalar springs.
The secondary mass automatically trails the broad float, then passes its target
once and loses energy. Acceleration feeds four decaying surface bands, creating
short internal ripples without mesh deformation. Spring integration uses small
substeps so 30 and 60 FPS previews have matching motion. It remains directly
portable to embedded code and needs no mesh, blur, shader, video, or sprite
sequence.

### Interruption

`BehaviourController` is stateful precisely so it can be interrupted.
`cancel()` abandons whatever is running and returns to REST, and `trigger(id)`
cuts in immediately. Every behaviour is a delta on the neutral pose, so a
future device state can take the rig over on any frame without inheriting a
half-finished glance. Primary deformation is clamped to +/-10%; independent
secondary body deformation is clamped to +/-5%.

Scheduling uses a seeded PRNG advanced only inside the animation loop, so runs
are reproducible, `Reset` restarts the schedule exactly, `Pause` freezes it,
and nothing random happens during render.

**Auto** toggles the seeded HOME behaviour playlist; the individual cue buttons
remain available for manual testing when Auto is off. **Idle** toggles the
ambient layer. With both Auto and Idle off, the calibrated pose is static until
a cue is fired. The side tuning rail exposes Float, Drift, Breath, Squash,
Jelly, Ripple, Blink, Gaze, Rotate, and Activity controls beside the device so
changes can be judged live. **Warm** changes the complete simulator UI and LCD
preview to a low-glare warm testing theme; hardware/default view remains dark.

The fixed **Expressions** tab exposes the authored catalogue without changing
the animation architecture. HOME is grouped into Gaze, Lids & eyes, Jelly body
and Mouth. Future state catalogues are added in `lib/expressionCatalog.ts` and
appear under their own state filter when authored.

## SENSED state

SENSED now uses the same layered Blob rig with a quiet proximity field behind
it: five thin green orbital rings and 18 sparse signal points. Each point has
its own deterministic phase and period, so only a few points twinkle at once;
the field never becomes a dense radar or a full-screen effect. The field is
drawn at native 240-space and pauses with the simulator.

## Adding a state's animation

Edit that state's file in `components/states/`. Each file is isolated — replace
the `StatePlaceholder` body with the real animation and no other state changes.
HOME and SENSED are built; SENSED owns its field in `components/states/` and
reuses the layered rig without changing HOME's physics.
