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
components/blob/         BlobStage (canvas renderer) + alignment maths
components/states/       one file per device state
public/blob/             home.png, reaction.png
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

## Blob character (HOME -> REACTION)

`public/blob/home.png` and `public/blob/reaction.png` are the master character
and the first reaction keyframe. They are rendered by `components/blob/`.

The two frames were authored independently, so their canvases, body scale and
**silhouettes** differ. Two things follow from that:

1. **Alignment is measured, not eyeballed.** Both frames are anchored on the
   midpoint between the eyes, scaled so their eye-to-eye distances match. The
   landmark coordinates live in `lib/blobConfig.ts`. This lands the eyes within
   a fraction of a pixel and matches body scale to ~0.2%.
2. **Only the face crossfades.** A full-image crossfade double-edges the body
   rim. Instead the HOME body is held at full opacity for the whole transition
   and a feathered ellipse over the eyes and mouth is the only region that
   blends — so the body is provably stationary.

`HOME` and `SENSED` are rendered by one mounted component (`BlobState`) so the
transition is continuous; see `continuity` in `lib/deviceStates.ts`.

### Calibration controls

The **Calibrate** dev button exposes temporary X / Y / Scale sliders for
`reaction.png`. Offsets are in 240-space pixels, i.e. real pixels on the target
panel. They default to `0 / 0 / 1.000x` because the measured anchors already
align the frames. If you find better numbers, fold them into
`DEFAULT_CALIBRATION` in `lib/blobConfig.ts` and the panel can be removed.

## Adding a state's animation

Edit that state's file in `components/states/`. Each file is isolated — replace
the `StatePlaceholder` body with the real animation and no other state changes.
Only the HOME/SENSED blob pair is built so far.
