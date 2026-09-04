# LCDPROTO

Browser prototype for a 1.43" round **466×466** ESP32-S3 AMOLED device used in cars.

This is **not** the hardware app. It exists only to design and test the on-screen
UI and animations before the physical panel arrives.

## Locked hardware target

Waveshare ESP32 S3 1.43-inch AMOLED Round Display: 466×466 circular AMOLED,
capacitive touch, ESP32-S3R8, 8 MB PSRAM, 16 MB flash, QSPI, WiFi and BLE 5.
The UI canvas is native 466×466 with centre **233,233** and radius **233**.
The animation target is 60 FPS where practical, with stable 30 FPS as the floor.

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
lib/blobMind.ts          deterministic intention, mood, story and destination director
lib/blobPhysics.ts       lightweight soft-body spring follow-through
lib/blobDrives.ts        what Blob wants: drives, mood and behaviour utility
components/screens/      ScreenStage, SystemScreenLayer, ScreenBrowser
lib/screenCatalogue.ts   every screen, its timing and its flows (data only)
lib/screenLifecycle.ts   which screen is up and how far through it is
```

## Design space vs rasterisation

Everything inside the panel is **laid out and animated in 466×466 space**, so
the prototype can never rely on more pixels than the hardware has.

Rasterisation is a separate concern. The canvas backing store is sized to the
466×466 panel resolution and can be previewed larger on desktop
(`renderScale`, capped at 4×). Coordinates, touch hit testing, and asset sizing
all stay in 466-space, so the AMOLED preview matches the real pixel budget.

The **1:1** dev button forces a true 466×466 buffer with nearest-neighbour
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
```

All rigs are produced from their matching parts sheet by
`scripts/extractBlobParts.mjs` — rerun it any time a sheet changes:

```bash
node scripts/extractBlobParts.mjs [sheet]
```

Current colour selector: purple, teal, yellow, green, blue, and red. All six
colours reuse the same procedural eye, eyebrow, mouth, socket, and HOME physics
rig.

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
candidate grids and comparing at native 466x466, not derived from the old 240x240 target.

Normal rendering adds no glow, stroke, shadow, blur or colour correction.

## HOME behaviour system

HOME is a small character behaviour system, not a loop. Four stages compose:

**Ambient** (`lib/blobIdle.ts`) runs continuously — a gravity-like centre-of-mass
drift that eases between seeded waypoints every 2.2-4.2s, with a smaller
650-1250ms current layered over the broad path. It also provides composite
breathing, sub-degree rotation, and slow silhouette deformation. It starts
travelling on the first frame rather than sitting at zero for its first leg.

**Mind** (`lib/blobMind.ts`) chooses a short intention-led story from the
current mood: explore, inspect, play, watch, think, rest, or recover. Stories
choose a destination around the round display and retain it long enough to read
as a decision. Face cues lead the trip; the body follows toward the selected
point; depth, yaw and pitch add a restrained near/far turn using scalar
foreshortening rather than a 3D engine.

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
| body | settle, tiny squish, side squish, sway, tall stretch, twist, wall impact, 360 spin | 0.82-1.6 s |

A beat starts roughly every 2-4s, with no forced repeated pose. Blink events stay
independent and irregular; the mouth flip is deliberately rare.

Mind stories begin roughly every 4-6s, with a short quiet tail. Their travel
targets stay inside the display's safe centre area, so Blob can move around the
ring without clipping while still feeling materially less anchored.

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

**Auto** toggles the seeded HOME story playlist; the individual cue buttons and
Mind/Target controls remain available for manual testing when Auto is off. **Idle** toggles the
ambient layer. With both Auto and Idle off, the calibrated pose is static until
a cue is fired. The side tuning rail exposes Float, Drift, Breath, Squash,
Jelly, Ripple, Blink, Gaze, Rotate, and Activity controls beside the device so
changes can be judged live. **Screen** switches between Dark, Warm, and Brown
preview backgrounds, and **LCD colour** provides a custom screen colour picker.
Brown is the lower-luminance beige-brown testing theme; hardware/default view
remains true black.

The fixed **Expressions** tab exposes the authored catalogue without changing
the animation architecture. HOME is grouped into Gaze, Lids & eyes, Jelly body,
Mouth, Idle life, Angry, Sad, and Big beats. SENSED inherits that same global
catalogue and adds its own variants. Search filters the library without hiding
the currently selected state. Double tapping Blob opens three test orbs for
colour rigs, face expressions, and pupil visibility. The Mood control pins one
of the shared emotional presets or returns to automatic mood changes.

## SENSED state

SENSED uses the same layered Blob rig and HOME motion stack with quieter
settings: reduced float, jelly, ripple, gaze, and rotation amplitude; wider
action spacing; and a slower blink cadence. HOME's face-first/body-last
timing, independent lid/mouth channels, springs, and interruption behaviour
are shared rather than reimplemented as a separate animation language.

Behind Blob is a quiet proximity field: five thin green orbital rings and 18
sparse signal points. Each point has its own deterministic phase and period,
so only a few points twinkle at once; the field never becomes a dense radar or
a full-screen effect. The field is drawn at native 466-space and pauses with
the simulator.

Expressions → SENSED includes inherited HOME cues plus two coordinated
variants: Worried (look down, squint, frown, settle) and Surprised (look up,
widen, round O, stretch). Both can be previewed manually with Auto disabled.

## Adding a state's animation

Edit that state's file in `components/states/`. Each file is isolated — replace
the `StatePlaceholder` body with the real animation and no other state changes.
HOME and SENSED are built; SENSED owns its field in `components/states/` and
reuses the layered rig without changing HOME's physics.

## System screens

The device lifecycle — boot, loading, sleep, pairing, faults, updates — lives in
a screen library that is separate from Blob. Blob's rig, face, behaviour system
and environment are untouched by it.

### The catalogue

`lib/screenCatalogue.ts` is the single source of truth and contains no
rendering code. Every screen declares its `id`, `category`, `label`,
`description`, `durationMs`, `interruptible` and `previewable` flags, its
`transitionIn` / `transitionOut`, whether it `showsBlob`, and whether it is
`complete` or a `placeholder`. The eight existing device states are listed
there too, so the browser can reach every screen from one place.

Transitions come from one shared vocabulary — `cut`, `fade`, `dim`, `rise`,
`bloom` — and the timing for all of them lives in a single `envelope()` in
`SystemScreenLayer.tsx`. A screen picks a name; it never writes its own timing.

### Lifecycle flows

`lib/screenLifecycle.ts` owns only which screen is showing and how far through
it is. It knows nothing about moods or behaviours, which keep running
underneath whichever screen is up.

```
Initial boot   BOOT_BLACK → DISPLAY_INIT → ASSET_LOADING → BLOB_WAKE → BLOB_READY → HOME
Sleep          HOME → PAUSE → DIMMED_PAUSE → SLEEP
Wake           SLEEP → WAKE → BLOB_READY → HOME
Connectivity   SEARCHING → PAIRING → CONNECTING → CONNECTED_CONFIRMATION → HOME
Failure        CONNECTING → OFFLINE → RECONNECTING → HOME
```

`LCDPROTO_MARK` is deliberately not in the boot flow. It is reachable on its own
for brand work; the device boots straight into loading.

### Previewing one screen

Open the **SCREENS** tab on the left edge of the window — it mirrors the
EXPRESSIONS tab on the right. The browser is a developer tool and is rendered
outside the circular display — nothing in it is ever drawn
inside the 466×466 canvas.

Click any screen to preview it alone, without running a flow. Play, Pause,
Replay and Reset act on the current screen; the Auto sequence buttons run a
whole flow. The readout shows the active screen, elapsed against duration,
progress, native resolution, whether the screen is interruptible, and its
status. Single-screen previews loop so motion can be watched, except screens
that end by cutting to black (SLEEP), which hold their final frame — looping a
sleep preview back to a bright Blob would misrepresent the device.

### How Blob screens work

Screens that show Blob mount the ordinary HOME view: same rig, same behaviour
system, same environment. The screen controls only two things — a veil, which
decides how much of him the panel reveals, and a speed multiplier, which
quietens his motion without freezing it. That is why PAUSE, DIMMED_PAUSE and
SLEEP needed no new Blob code, and why his breathing still runs on a paused
device.

### Simulated timing, and replacing it with firmware events

All timing is simulated and deterministic — no `Math.random`, and no clock
reads beyond the frame delta the controller is handed. Loading, pairing and
update arcs read `snapshot.simulated`, an eased ramp across the screen's
duration.

Two hooks replace that with real events, and nothing else has to change:

- `lifecycle.setProgress(0..1)` drives an arc from a real source — an OTA
  progress callback, a BLE pairing state machine — instead of the clock. Pass
  `null` to hand control back. The readout marks the screen `ext` while an
  external source is driving it.
- `lifecycle.complete()` ends the current screen immediately and advances the
  flow, for when the real event finishes early or late.

`lifecycle.interrupt(id)` is the entry point for an unsolicited event (a
disconnect arriving mid-flow). It refuses when the running screen sets
`interruptible: false`, which is what protects `BOOT_BLACK` and
`FIRMWARE_UPDATE`. Selecting a screen in the developer browser deliberately
bypasses that guard — an editor tool must always be able to jump anywhere.

### What is complete and what is a placeholder

Complete: every BOOT, STARTUP, POWER, CONNECTIVITY, PROBLEMS and MAINTENANCE
screen, plus HOME and SENSED.

Placeholder: APPROACHING, VERY_CLOSE, TOGETHER, SYNC, CONNECTED and RECOGNIZED
still render their existing `StatePlaceholder` bodies. They are marked `wip` in
the browser and carry `status: "placeholder"` in the catalogue.

## Drives

Blob chooses what to do from what he currently wants, rather than from a
shuffled playlist.

`lib/blobDrives.ts` holds five drives — curiosity, energy, social, comfort and
boredom — plus a habituation term. They rise and fall from real events fed in
each frame by HomeState: being grabbed, how hard he is pressed against the
edge, how much he is being shaken, how fast he is moving, and how long it has
been since anyone touched him. Each drive decays back toward its own resting
level when nothing is happening.

Before this the behaviour system had an energy and a curiosity number, but
both came from a mood lookup table plus noise. Nothing that happened to Blob
ever reached them, so being shaken for ten seconds and being left alone for
two minutes produced exactly the same internal state.

Two things read off the drives:

- **Mood** is now their output rather than a 6-11 second timer. Rough handling
  drops comfort and he becomes DISTRACTED; a long quiet spell drops energy and
  raises boredom and he becomes SLEEPY. The dev Mood control still overrides.
- **Behaviour choice** scores every candidate story against the drives instead
  of filtering and picking at random, so he investigates because curiosity is
  high and settles because comfort or energy is low.

Habituation falls as the same treatment repeats and recovers slowly, so the
tenth shake lands far more weakly than the first.

He also reacts in the moment: being picked up widens his eyes, and a jolt that
knocks comfort down makes him squint or scowl. A more severe event pre-empts a
milder reaction already playing.

The whole model is about a dozen scalars with no allocation and no
`Math.random`, so it ports to the ESP32 unchanged. The Activity readout shows
all five drives live.
