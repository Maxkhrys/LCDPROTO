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

The Blob is a **layered rig**, not a set of pre-rendered state images.

```
public/blob/Blob-body.png   permanent, locked body — never morphed or replaced
public/blob/eye-left.png    tight crops lifted from the original master
public/blob/eye-right.png
public/blob/mouth-smile.png
```

`components/blob/BlobCharacter.tsx` draws them in order — body, left eye, right
eye, mouth — with every facial element independently transformable
(x, y, scaleX, scaleY, rotation, opacity) and a whole-character transform
(x, y, scale, rotation, opacity) on top. Facial transforms never touch the body.

### Where the face sits

The facial PNGs are tight crops with no positioning information, so their
placement was **recovered, not guessed**. FFT template matching located each
crop's exact original position inside the master (`home.png`); re-compositing
them back at those positions reproduces the master with **zero differing
pixels**. Those positions are stored in `lib/blobRig.ts` as fractions of the
master body width, so the face lands correctly at any render size.

Note the supplied body is *not* the master's body with the face erased — it is
redrawn art, about 5% wider and 7% taller with a different silhouette. The
reconstruction therefore matches the master's face placement exactly but not
its outline.

`Blob-body.png` is exported as RGB on black with no alpha channel, so its
transparency is keyed from luminance at load time; otherwise it would paint an
opaque black square over the screen.

### Calibration controls

**Calibrate** exposes X / Y / Scale for each facial element. Offsets are in
240-space pixels — 1 unit is one real pixel on the target panel. All default to
0 / 0 / 1.000x because the measured anchors already reproduce the master.
**Save calibration** prints the current numbers to copy back for hardcoding.

## Adding a state's animation

Edit that state's file in `components/states/`. Each file is isolated — replace
the `StatePlaceholder` body with the real animation and no other state changes.
Only HOME is built so far; it renders the layered rig in its neutral pose.
