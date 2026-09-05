/* eslint-disable @typescript-eslint/no-require-imports -- Node-only CommonJS test harness, not bundled application code. */
/* Run: node tests/character-audit.cjs. Uses project's TypeScript compiler only. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return originalResolve.call(
    this,
    name.startsWith("@/") ? path.join(__dirname, "..", name.slice(2)) : name,
    parent,
    ...rest,
  );
};
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText,
    filename,
  );
const {
  createLobeStates,
  stepLobePhysics,
  DEFAULT_DEFORMATION,
  DEFAULT_MOTION_CONFIG,
} = require("../components/experimental/cloud-blob/cloudLobeSystem.ts");
const {
  createWispPool,
  spawnWisp,
  updateWisps,
} = require("../components/experimental/cloud-blob/cloudMistTrails.ts");
const {
  CloudPerformance,
  CLOUD_EMOTIONS,
} = require("../components/experimental/cloud-blob/cloudPerformance.ts");
const { ScreenLifecycle } = require("../lib/screenLifecycle.ts");
const { BlobDragController } = require("../lib/blobDrag.ts");
function lobes(fps) {
  const states = createLobeStates();
  for (let i = 0; i < fps * 4; i++)
    stepLobePhysics(
      states,
      { ...DEFAULT_DEFORMATION, lean: i < fps ? 18 : 0 },
      DEFAULT_MOTION_CONFIG,
      i < fps ? 180 : 0,
      0,
      (i + 1) / fps,
      1 / fps,
    );
  return states;
}
const a = lobes(30),
  b = lobes(60);
for (const id in a) {
  assert.ok(
    Math.hypot(a[id].x - b[id].x, a[id].y - b[id].y) < 0.25,
    id + " 30/60 drift",
  );
  assert.ok(Number.isFinite(a[id].vx));
}
const paused = JSON.stringify(a);
stepLobePhysics(a, DEFAULT_DEFORMATION, DEFAULT_MOTION_CONFIG, 900, 0, 30, 0);
assert.equal(JSON.stringify(a), paused);
const pool = createWispPool(100);
assert.equal(pool.length, 8);
for (let i = 0; i < 8; i++)
  assert.ok(spawnWisp(pool, 233, 233, -100, 0, 20, "#fff", 1, 0.3, i));
assert.equal(spawnWisp(pool, 0, 0, 0, 0, 20, "#fff"), false);
const poolPause = JSON.stringify(pool);
updateWisps(pool, 0);
assert.equal(JSON.stringify(pool), poolPause);
for (let i = 0; i < 90; i++) updateWisps(pool, 1 / 60);
assert.ok(pool.every((w) => !w.active));
function pose(fps, id) {
  const p = new CloudPerformance();
  p.trigger(id);
  let r;
  for (let i = 0; i < fps; i++) r = p.update(1000 / fps, false);
  return r;
}
for (const id of Object.values(CLOUD_EMOTIONS)) {
  const a = pose(30, id),
    b = pose(60, id);
  assert.ok(
    Math.abs(a.mouth.mouthD - b.mouth.mouthD) < 0.1,
    id + " mouth cadence",
  );
  assert.ok(Math.abs(a.blob.y - b.blob.y) < 3, id + " body cadence");
}
const happy = pose(60, "HAPPY_BOUNCE");
assert.ok(happy.mouth.mouthD > 0.1, "production D mouth advances in ms");
const angry = pose(60, "ANGRY_FLARE");
assert.notEqual(angry.leftEye.browRotation, angry.rightEye.browRotation);
const performance = new CloudPerformance();
performance.trigger("JOY_HOP");
performance.update(500, false);
const frozen = JSON.stringify(performance.update(0, false));
assert.equal(JSON.stringify(performance.update(0, false)), frozen);
performance.reset();
const clean = new CloudPerformance();
assert.deepEqual(performance.update(0, false), clean.update(0, false));
for (let direction = 0; direction < 8; direction++) {
  const drag = new BlobDragController(),
    angle = (direction * Math.PI) / 4;
  drag.begin(233, 233, 0);
  drag.move(233 + Math.cos(angle) * 450, 233 + Math.sin(angle) * 450, 100);
  let p;
  for (let i = 0; i < 120; i++) p = drag.step(1000 / 60, 466, 170);
  assert.ok(Math.hypot(p.x, p.y) < 123, "contained radial drag");
  assert.ok(p.wallPressure > 0.5);
  drag.end();
  for (let i = 0; i < 600; i++) p = drag.step(1000 / 60, 466, 170);
  assert.ok(Math.hypot(p.x, p.y) < 0.1, "settles after release");
}
const lifecycle = new ScreenLifecycle();
lifecycle.select("FIRMWARE_UPDATE");
lifecycle.setProgress(0.3);
for (let i = 0; i < 1000; i++) lifecycle.update(100);
assert.equal(lifecycle.update(0).external, true);
assert.equal(lifecycle.update(0).simulated, 0.3);
assert.equal(lifecycle.currentScreen, "FIRMWARE_UPDATE");
lifecycle.playFlow("boot");
lifecycle.pause();
const before = JSON.stringify(lifecycle.update(0));
assert.equal(JSON.stringify(lifecycle.update(100)), before);
console.log(
  "PASS: lobe cadence/pause, bounded pool/lifetime, production expressions/reset, eight wall directions/settle, external lifecycle completion.",
);
// External progress must hold a timed flow until the firmware explicitly completes it.
const externalFlow = new ScreenLifecycle();
externalFlow.playFlow("connectivity");
externalFlow.setProgress(0.3);
for (let i = 0; i < 1000; i++) externalFlow.update(100);
assert.equal(externalFlow.currentScreen, "SEARCHING");
assert.equal(externalFlow.update(0).simulated, 0.3);
externalFlow.complete();
assert.equal(externalFlow.currentScreen, "PAIRING");
const { SCREEN_FLOWS, getScreen } = require("../lib/screenCatalogue.ts");
const bootDuration = SCREEN_FLOWS.boot.screens.reduce(
  (n, id) => n + getScreen(id).durationMs,
  0,
);
for (const fps of [30, 60]) {
  const c = new ScreenLifecycle();
  c.playFlow("boot");
  let elapsed = 0;
  while (c.currentScreen !== "HOME" && elapsed < 30000) {
    c.update(1000 / fps);
    elapsed += 1000 / fps;
  }
  assert.ok(
    Math.abs(elapsed - bootDuration) <= 1000 / fps + 0.01,
    "flow preserves frame remainder",
  );
}
console.log("PASS: external flow completion and boot duration at 30/60 FPS.");
