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

## Idle motion

`lib/blobIdle.ts` builds the pose as a **pure function of elapsed time** — no
accumulated state, no runtime randomness — so a moment always yields the same
pose and pausing freezes cleanly. Float, breathing, squash, blink and gaze all
run on different periods, so nothing loops in lockstep.

| motion | default | effect |
| --- | --- | --- |
| Float | 1.4 px | whole character rises and falls |
| Breath | 0.7% | slow uniform scale |
| Squash | 0.6% | scaleX up while scaleY goes down |
| Blink | 5.5 s | 130 ms close, jittered per window |
| Gaze | 1.3 px | gated drift that settles back to neutral |

Float and breath are stated as total travel, squash as maximum deviation.

## Adding a state's animation

Edit that state's file in `components/states/`. Each file is isolated — replace
the `StatePlaceholder` body with the real animation and no other state changes.
Only HOME is built so far; it renders the layered rig in its neutral pose.
