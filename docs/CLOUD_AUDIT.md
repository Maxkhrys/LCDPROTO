# LCDPROTO audit and Cloud refinement

Date: 2026-09-05. Branch: `feat/gpt6-project-polish`.
Started from verified latest `main`: `732079403e2383cda3d53c31b6ebded0f7c484b5`.
No merge to main. No dependency or framework migration. Locked Jelly assets unchanged.

**Verdict:** Cloud is now viable to continue as an alternate character prototype. Its interaction and face integration are substantially more credible; browser cost is no longer the main objection. Jelly still has the stronger visual identity and material depth. Cloud needs a focused art-direction review and an actual device benchmark before becoming a shipping character. This pass does not establish ESP32 frame rate.

## Implementation commits

| Commit | Change |
| --- | --- |
| `de7b98a` | Extract production eye, lid, brow and mouth drawing primitives without changing their geometry. |
| `ed915fd` | Common Cloud body/face transforms, cached volume stamps, shared radial drag, fixed-pool motion trails and stable lobe springs. |
| `1f35f89` | One production-expression clock, Cloud acting adapter, working transport/reset controls and native test console. |
| `9f96677` | Preserve simulator/environment clocks, correct initial SENSED field transform, and honor external lifecycle completion. |

Tests, measurements, screenshots and this report are in the subsequent audit commit.

## Cloud before / after

| Area | Before | After |
| --- | --- | --- |
| Silhouette | Seven masses plus 28 secondary stamps; many equally bright details. | Seven main masses, six selected secondary billows, joined front core. Existing lobe identities and lag hierarchy retained. |
| Volume | Per-frame gradients, repeated glow, dark circular face cavity and noisy billows. | Cached directional volume textures; continuous dense face region; restrained internal light and opposite-side shading. No runtime blur. |
| Face | Copied older coloured iris renderer; separate mist brows; missing D-mouth and several expression channels. | Same production solid black eyes, lids, brows and D/O mouth functions. Full brow/lid/D values passed from production controller. Mist brow accents and blush off by default. |
| Physics | Body position/scale parameters never reached renderer; face translated separately. Controllers received seconds despite millisecond APIs. | Body and face share translation, scale, rotation and radial wall deformation. Correct millisecond controller integration; lobe springs use substeps and exponential relaxation. |
| Trails | Frame-probability random emission from movement the body did not actually render; circular puffs; several unused settings. | Time-based emission from actual rendered centre velocity/acceleration; world-space trailing ellipses, paired curved wisps and puffs; deterministic pool of eight. Typically zero to three, stronger motion up to eight. |
| Idle | Expression clock effectively 1,000× too slow; per-frame React tree updates. | Shared behaviour/mind clock; independently twinkling lights, calm breathing intervals and lobe phases. React telemetry updates twice per second. |
| Interaction | Event-frequency velocity guess; CSS zoom ignored; whole display was grabbable. | Production drag controller, native pointer coordinates, body hit region, primary pointer ownership, release/cancel handling and radial wall contact. |
| Tooling | Return-to-centre changed labels only; clear-wisps toggled a timer; expression timers could overwrite later actions. | Actual reset/centre/pool commands, pause, 30/60 selection, eight emotion presets, full authored catalogue, bounded motion test clips and debug overlays. No emote timeouts. |
| Environment | Flat warm background; malformed standalone shadow transform. | Existing EnvironmentLayer available on sand; lighter Cloud shadow follows position and perceived height. No environment redesign. |

[Before screenshot](audit/cloud-before.png) · [After screenshot](audit/cloud-after.png)

## Measurement

All measurements use the actual 466×466 Cloud backing buffer. Headless Chromium in this execution container; software rendering configuration. The comparative runs used **production builds for both revisions**, the same browser and native buffer, with five seconds sampled after warm-up. No hardware measurement was possible.

| Metric | Baseline | Final |
| --- | ---: | ---: |
| Presented frames/s, five-second comparison | 59.92 | 59.98 |
| Radial gradients per Cloud frame | 50.03 | 0 |
| Linear gradients per Cloud frame | 3.01 | 1 |
| Sampled whole-page JS allocation | 11.54 MB/s | 1.98 MB/s |

Allocation is a Chrome sampling estimate including collected objects, not an exact byte counter or retained-memory figure. It includes the complete Cloud test page; roughly 83% lower in this sample. Remaining allocations include production rig/calibration objects, eye geometry, cached-texture key strings and the shared mouth gradient. No claim of zero allocation.

Thirty-second idle runs at each cadence measured:

| Requested cadence | Mean CPU frame work | P95 of half-second mean windows | Maximum sampled active wisps |
| --- | ---: | ---: | ---: |
| 60 FPS | 0.284 ms | 0.427 ms | 2 |
| 30 FPS | 0.267 ms | 0.331 ms | 1 |

Those longer runs preceded the final cached-lighting adjustment; the final production comparison above verifies the resulting gradient counts and cadence. CPU timings measure simulation plus drawing submission, excluding GPU completion, compositor and physical panel transfer. They are not ESP32 predictions. Strong motion test reached four sampled wisps. The pool hard limit is eight.

Five cached source textures use 45,056 pixels in total: two 128×128 volume textures and three 64×64 soft textures. Browser RGBA payload is 176 KiB, excluding object and GPU overhead. Textures rebuild only when colour, light or translucency inputs change. Dynamic lobes transform those cached resources. Primary-frame paths remain cheap Canvas primitives; there is no WebGL, convolution blur, video or sprite sequence.

Raw records: [measurements.json](audit/measurements.json).

## Production fixes and audit findings

* Extracted face drawing into `components/blob/faceRenderer.ts`. Matching seeded timestamps produced **pixel-identical Jelly canvas PNGs** between baseline and final production builds. This also keeps Emoji Maker and Cloud on the same primitive implementation.
* Lifecycle animation clock now survives playback pause and speed changes. Previously each effect restart reset the clock to zero.
* Environment dust/light phase survives pause/configuration changes; paused renders use zero delta. Shadow springs use substeps and respect playback speed. Static scene artwork and controls unchanged.
* Initial SENSED field paint applies raster scale before drawing; previously a paused initial paint could use an unscaled transform in a larger backing buffer.
* Lifecycle flows preserve frame remainder across boundaries. External progress holds timed screens until explicit `complete()`; a simulated timer can no longer advance a slow real operation behind its progress source.

Reviewed README, package scripts, assets, BlobCharacter, rig/calibration, mind, idle, behaviour, physics, drag, expression catalogue/Emoji Maker, HOME/SENSED, device/screen composition, lifecycle library, environment and both body experiments. No dependency change, speculative cleanup, placeholder-state completion or production body redraw.

The architecture already trends toward **mind → expressions/performance → body rendering**. This pass strengthens the shared face and controller boundary and uses a small Cloud adapter. It does not force HOME and SENSED into a new generic renderer framework.

## Validation

Passed:

* `npm run lint`
* `npm run build`
* `node tests/character-audit.cjs`
* Production browser checks via `tests/browser-audit.cjs`
* Cloud: native buffer, 30-second idle at both cadences, eight emotions, blink/glance/tilt/hop/laugh/flare/pop/yawn/side-eye with auto off, all eight radial drag directions at 30 and 60, release/settle, pixel-stable pause, reset, centre, trail test, clear/disable, sand, debug and 390px overflow check.
* Equivalent 30-native-pixel drags at 75%, 100% and 120% CSS previews measured approximately 30.62, 30.53 and 30.40 native pixels.
* Browser-native mobile touch drag and cancellation settle.
* Production: HOME happy/angry/sleepy/surprised/blink/gaze, radial drag at 30/60, native buffers and pixel-identical paused canvases; SENSED variants; 19 lifecycle screens and pause/replay/reset.
* Unit coverage: 30/60 lobe/expression cadence, fixed-pool overflow/lifetime, pause/reset, all-direction drag settling, external lifecycle completion, and boot-flow duration.
* No page errors in completed browser matrices.

Browser harness needs an existing Playwright installation and Chromium. It starts the production server itself so server and browser share one network environment:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
CHROMIUM_EXECUTABLE=/absolute/path/to/chromium \
AUDIT_OUTPUT=/absolute/path/to/output \
node tests/browser-audit.cjs
```

`PRODUCTION_ONLY=1` runs the production/mobile portion; `SKIP_PROFILE=1` skips the two long idle samples. Screenshots and metrics otherwise default to `.audit/`.

## ESP32 feasibility

These are engineering classifications, not measured firmware guarantees. Target supplied in brief: ESP32-S3R8, 8 MB PSRAM, 16 MB flash, 466×466 round QSPI AMOLED, centre/radius 233.

| System | Classification | Embedded approach / limitation |
| --- | --- | --- |
| Production Jelly body | SAFE WITH SIMPLIFICATION | Pre-downsample locked art to native-scale RGB565 plus alpha; transform cached image or bounded strips. Avoid loading large authoring sheets. |
| Cloud body | SAFE WITH SIMPLIFICATION | Blend cached small alpha/colour volume stamps with bounded transforms. Transparent pixel fill and panel transfer need measurement. |
| Cloud billows | SAFE WITH SIMPLIFICATION | Keep six secondary stamps; disable them first if fill cost is high. No procedural fluid. |
| Mist trails | SAFE WITH SIMPLIFICATION | Eight fixed records; small alpha sprites oriented by velocity. Start at three visible for hardware budget. |
| Internal particles | SAFE | Fourteen fixed phase records, most dim/invisible; tiny alpha sprites or circles. |
| Face system | SAFE WITH SIMPLIFICATION | Rasterize the same contours with bounded polygon/curve samples or small cached masks. Replace live Canvas mouth gradient with palette shading. |
| Environment | SAFE WITH SIMPLIFICATION | Cache sand backdrop; bounded parallax and four/eight tiny motes. Avoid reproducing browser full-screen layered canvases literally. |
| Contact shadow | SAFE | One small soft ellipse sprite with position/scale/alpha modulation. |
| Bounce light | SAFE WITH SIMPLIFICATION | Small cached tinted patch or palette modulation; no live full-screen gradient generation. |
| Screen effects | SAFE WITH SIMPLIFICATION | Lines, arcs, small alpha stamps and scalar transition envelopes; simplify any full-panel additive composition. |
| Behaviour / mind | SAFE | Seeded schedules, finite state, scalar targets; translate objects to fixed structs/tables. |
| Physics | SAFE | Fixed scalar springs and 120 Hz bounded substeps; no mesh/fluid simulation. |
| Literal browser/React rendering pipeline on MCU | NOT SUITABLE | Port visual primitives and state; do not attempt to run this web application on ESP32. |
| Unmeasured 60 FPS full-frame multi-layer alpha rendering | RISKY | Establish panel DMA/transfer and blending budgets before promising 60 FPS. Stable 30 remains the acceptance floor. |

A 466×466 RGB565 framebuffer is 434,312 bytes; two require 868,624 bytes before textures and application memory. Full-frame RGB565 payload alone is about 13.0 MB/s at 30 FPS or 26.1 MB/s at 60 FPS, before bus overhead. These are arithmetic requirements, not claims about achieved QSPI throughput.

## Remaining weaknesses

* Cloud is more coherent, but still softer and less materially distinctive than Jelly. It is not yet the final animated-film quality target. Native brightness/contrast and inter-lobe shading need user review.
* Production D mouth remains the current somewhat square geometry. It was deliberately reused unchanged; this pass does not introduce a new smile system.
* HOME and SENSED still own separate controller instances and use a transition crossfade. Seamless shared brain handoff across states remains future work.
* SENSED still has its original interaction scope; this pass did not add HOME's drag controller to it.
* Production pages still use React pose updates; Cloud removes its own per-frame page updates but does not globally refactor all render loops.
* Native touch was tested in Chromium, not on the physical capacitive panel. No flash build, panel latency, memory placement, power or burn-in test performed.
* Debug overlay is a testing aid. Native canvas clips extreme manual deformation to the circular panel; arbitrary combinations of all shape sliders were not exhaustively validated.
* Environment borrowing uses the existing scene; Cloud-specific surface bounce tint is not a new material pipeline.

## Next five steps

1. Review Cloud at 466×466 in black and sand, especially happy/angry mouth readability and light direction.
2. Port a minimal scene to the actual board: one buffer, cached Cloud stamps, shared face and drag springs. Measure 30 FPS first.
3. Measure alpha blending and panel transfer separately; choose RGB565/A8 assets, dirty regions or a reduced billow preset from evidence.
4. Address shared HOME/SENSED brain continuity in a separate regression-tested pass.
5. Decide whether Cloud earns production character selection after the art review and device benchmark; keep Jelly as reference meanwhile.

## Files changed

* `components/blob/BlobCharacter.tsx`, `components/blob/faceRenderer.ts`
* `components/experimental/cloud-blob/CloudBlobBody.tsx`
* `components/experimental/cloud-blob/CloudBlobControls.tsx`
* `components/experimental/cloud-blob/CloudBlobTest.tsx`
* `components/experimental/cloud-blob/cloudLobeSystem.ts`
* `components/experimental/cloud-blob/cloudMistTrails.ts`
* `components/experimental/cloud-blob/cloudRenderer.ts`
* `components/experimental/cloud-blob/cloudTypes.ts`
* `components/experimental/cloud-blob/cloudPerformance.ts`
* `components/experimental/cloud-blob/cloudLab.css`
* `components/device/DeviceSimulator.tsx`
* `components/states/EnvironmentLayer.tsx`, `components/states/SensedField.tsx`
* `lib/screenLifecycle.ts`
* `tests/character-audit.cjs`, `tests/browser-audit.cjs`
* `.gitignore`, `docs/CLOUD_AUDIT.md`, `docs/audit/*`
