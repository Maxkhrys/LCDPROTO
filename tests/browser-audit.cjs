/* eslint-disable @typescript-eslint/no-require-imports -- Node-only CommonJS test harness, not bundled application code. */
/* Production browser regression pass. No browser dependency added to app.
 * PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-audit.cjs
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const output = process.env.AUDIT_OUTPUT || path.join(root, ".audit");
fs.mkdirSync(output, { recursive: true });
const result = { errors: [], cloud: {}, production: {}, checks: [] };
(async () => {
  let browser, server;
  try {
    server = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/next/dist/bin/next"),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3010",
      ],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (d) => {
        if (String(d).includes("Ready")) resolve();
      });
      server.stderr.on("data", (d) => process.stderr.write(d));
      server.on("exit", (c) => reject(Error("server " + c)));
    });
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    await context.addInitScript(() => {
      window.__canvasStats = { radial: 0, linear: 0, draws: 0, clears: 0 };
      for (const [name, key] of [
        ["createRadialGradient", "radial"],
        ["createLinearGradient", "linear"],
        ["drawImage", "draws"],
        ["clearRect", "clears"],
      ]) {
        const orig = CanvasRenderingContext2D.prototype[name];
        CanvasRenderingContext2D.prototype[name] = function (...args) {
          if (
            this.canvas.getAttribute("aria-label") === "Cloud character preview"
          )
            window.__canvasStats[key]++;
          return orig.apply(this, args);
        };
      }
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => result.errors.push(e.message));
    if (!process.env.PRODUCTION_ONLY) {
      await page.goto("http://127.0.0.1:3010/experimental/cloud");
      const canvas = page.getByLabel("Cloud character preview");
      await canvas.waitFor();
      await page.waitForTimeout(700);
      assert.deepEqual(
        await canvas.evaluate((c) => [c.width, c.height]),
        [466, 466],
      );
      await page.screenshot({ path: path.join(output, "cloud-desktop.png") });
      await canvas.screenshot({ path: path.join(output, "cloud-native.png") });
      for (const fps of process.env.SKIP_PROFILE ? [] : ["60", "30"]) {
        await page.getByLabel("Frame rate", { exact: true }).selectOption(fps);
        await page.waitForTimeout(700);
        const start = await page.evaluate(() => ({ ...window.__canvasStats }));
        const samples = [];
        // 30 seconds includes blink/gaze scheduling and calm idle intervals.
        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(1000);
          samples.push(
            await canvas.evaluate((c) => ({
              ms: Number(c.dataset.frameMs),
              wisps: Number(c.dataset.wisps),
              x: Number(c.dataset.x),
              y: Number(c.dataset.y),
            })),
          );
        }
        const end = await page.evaluate(() => ({ ...window.__canvasStats }));
        const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
        result.cloud[fps] = {
          samples: 30,
          meanMs: samples.reduce((a, s) => a + s.ms, 0) / samples.length,
          p95WindowMeanMs: sorted[Math.floor(sorted.length * 0.95)],
          maxWisps: Math.max(...samples.map((s) => s.wisps)),
          radialGradients: end.radial - start.radial,
          linearGradients: end.linear - start.linear,
          frames: end.clears - start.clears,
          drawImages: end.draws - start.draws,
        };
        console.log("idle " + fps, JSON.stringify(result.cloud[fps]));
      }
      await page.getByText("Motion", { exact: true }).click();
      await page.getByLabel("Automatic idle", { exact: true }).uncheck();
      await page
        .getByRole("button", { name: "Reset all", exact: true })
        .click();
      await page.waitForTimeout(500);
      for (const emotion of [
        "happy",
        "excited",
        "curious",
        "angry",
        "sad",
        "sleepy",
        "surprised",
        "neutral",
      ]) {
        await page.getByRole("button", { name: emotion, exact: true }).click();
        await page.waitForTimeout(600);
        await canvas.screenshot({
          path: path.join(output, "cloud-" + emotion + ".png"),
        });
      }
      await page.getByText("Face", { exact: true }).click();
      for (const cue of [
        "NORMAL_BLINK",
        "GLANCE_LEFT",
        "CURIOUS_TILT_LEFT",
        "JOY_HOP",
        "LAUGH_SQUISH",
        "ANGRY_FLARE",
        "SURPRISE_POP",
        "SLEEPY_YAWN",
        "DEADPAN_SIDE_EYE",
      ]) {
        await page.getByLabel("Production action").selectOption(cue);
        await page.waitForTimeout(220);
      }
      result.checks.push(
        "8 emotions and 9 production actions with automatic idle disabled",
      );
      await page
        .getByRole("button", { name: "Reset all", exact: true })
        .click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.waitForTimeout(200);
      const frozen = await canvas.evaluate((c) => c.toDataURL());
      await page.waitForTimeout(600);
      assert.equal(
        await canvas.evaluate((c) => c.toDataURL()),
        frozen,
        "Cloud pause pixel equality",
      );
      await page.getByRole("button", { name: "Play", exact: true }).click();
      for (const fps of ["30", "60"]) {
        await page.getByLabel("Frame rate", { exact: true }).selectOption(fps);
        for (let dir = 0; dir < 8; dir++) {
          await page
            .getByRole("button", { name: "Return to centre", exact: true })
            .click();
          await page.waitForTimeout(100);
          const r = await canvas.boundingBox(),
            cx = r.x + r.width / 2,
            cy = r.y + r.height / 2,
            a = (dir * Math.PI) / 4;
          await page.mouse.move(cx, cy);
          await page.mouse.down();
          for (let j = 1; j <= 10; j++) {
            await page.mouse.move(
              cx + (Math.cos(a) * 300 * j) / 10,
              cy + (Math.sin(a) * 300 * j) / 10,
            );
            await page.waitForTimeout(17);
          }
          await page.waitForTimeout(180);
          if (fps === "60" && dir === 1)
            await canvas.screenshot({
              path: path.join(output, "cloud-wall.png"),
            });
          await page.mouse.up();
        }
      }
      await page.waitForTimeout(3000);
      assert.ok(
        await canvas.evaluate(
          (c) => Math.hypot(Number(c.dataset.x), Number(c.dataset.y)) < 3,
        ),
        "Cloud release settles",
      );
      result.checks.push(
        "Cloud pause pixel equality; mouse drag/release in 8 directions at 30/60 FPS",
      );
      // Same native drag distance at each CSS preview scale.
      const displacements = [];
      for (const zoom of ["0.75", "1", "1.2"]) {
        await page
          .getByLabel("Preview zoom", { exact: true })
          .selectOption(zoom);
        await page
          .getByRole("button", { name: "Return to centre", exact: true })
          .click();
        await page.waitForTimeout(100);
        const r = await canvas.boundingBox();
        await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          r.x + r.width / 2 + (30 * r.width) / 466,
          r.y + r.height / 2,
        );
        await page.waitForTimeout(800);
        displacements.push(await canvas.evaluate((c) => Number(c.dataset.x)));
        await page.mouse.up();
      }
      assert.ok(
        Math.max(...displacements) - Math.min(...displacements) < 3,
        "zoom-native drag coordinates",
      );
      result.cloud.zoomDisplacements = displacements;
      await page.getByText("Trails", { exact: true }).click();
      await page
        .getByRole("button", { name: "Trail test", exact: true })
        .click();
      let maxWisps = 0;
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(350);
        maxWisps = Math.max(
          maxWisps,
          await canvas.evaluate((c) => Number(c.dataset.wisps)),
        );
      }
      assert.ok(maxWisps > 0 && maxWisps <= 8, "motion emits bounded trails");
      result.cloud.trailTestMax = maxWisps;
      await page
        .getByRole("button", { name: "Clear wisps", exact: true })
        .click();
      await page.getByLabel("Motion trails", { exact: true }).uncheck();
      await page.waitForTimeout(600);
      assert.equal(await canvas.evaluate((c) => Number(c.dataset.wisps)), 0);
      await page
        .getByRole("button", { name: "Reset all", exact: true })
        .click();
      await page.getByRole("button", { name: "Black", exact: true }).click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(output, "cloud-sand.png") });
      await page.getByText("Debug", { exact: true }).click();
      await page.getByLabel("Bounds, centres, velocity, face anchor").check();
      await page.waitForTimeout(100);
      await canvas.screenshot({ path: path.join(output, "cloud-debug.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "mobile overflow",
      );
      await page.screenshot({ path: path.join(output, "cloud-mobile.png") });
      result.checks.push(
        "preview zoom parity; finite trail test; clear/disable wisps; sand scene; debug; 390px layout",
      );
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("http://127.0.0.1:3010");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Controls/ }).click();
    await page.waitForTimeout(200);
    fs.writeFileSync(
      path.join(output, "production-controls.txt"),
      await page.locator("body").innerText(),
    );
    await page.screenshot({
      path: path.join(output, "production-controls.png"),
    });
    console.log("production controls captured");
    result.production.canvasSizes = await page
      .locator("canvas")
      .evaluateAll((cs) => cs.map((c) => [c.width, c.height]));
    const nav = page.getByRole("navigation", { name: "Control sections" });
    const choose = async (name) => {
      await nav.getByRole("button", { name: new RegExp("^" + name) }).click();
    };
    await choose("Display");
    await page
      .getByRole("button", { name: "Native pixels 1:1 off", exact: true })
      .click();
    await page.waitForTimeout(150);
    assert.ok(
      await page
        .locator("canvas")
        .evaluateAll((cs) =>
          cs.every((c) => c.width === 466 && c.height === 466),
        ),
      "production native buffers",
    );
    await choose("Blob");
    await page.getByRole("button", { name: "Auto on", exact: true }).click();
    await page.getByRole("button", { name: "Idle on", exact: true }).click();
    await choose("Expressions");
    const search = page.getByLabel("Search expressions");
    for (const cue of [
      "Blink",
      "Glance left",
      "Happy bounce",
      "Angry flare",
      "Sleepy yawn",
      "Surprise pop",
    ]) {
      await search.fill(cue);
      await page
        .locator("#expression-library button")
        .filter({ hasText: new RegExp("^" + cue, "i") })
        .first()
        .click();
      await page.waitForTimeout(500);
    }
    await search.fill("");
    await page.getByRole("button", { name: /Return to neutral/ }).click();
    await page.waitForTimeout(700);
    for (const fps of ["30", "60"]) {
      await choose("Playback");
      await page
        .getByRole("button", { name: fps + " FPS", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Pause playback", exact: true })
        .click();
      await page.waitForTimeout(200);
      const frozen = await page
        .locator("canvas")
        .evaluateAll((cs) => cs.map((c) => c.toDataURL()));
      await page.waitForTimeout(400);
      assert.deepEqual(
        await page
          .locator("canvas")
          .evaluateAll((cs) => cs.map((c) => c.toDataURL())),
        frozen,
        "production pause " + fps,
      );
      await page
        .getByRole("button", { name: "Resume playback", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close controls", exact: true })
        .click();
      const blob = page.locator('canvas[style*="cursor"]');
      for (let dir = 0; dir < 8; dir++) {
        const r = await blob.boundingBox();
        const x = r.x + r.width / 2,
          y = r.y + r.height / 2,
          a = (dir * Math.PI) / 4;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + Math.cos(a) * 270, y + Math.sin(a) * 270, {
          steps: 12,
        });
        await page.waitForTimeout(250);
        await page.mouse.up();
        await page.waitForTimeout(600);
      }
      await blob.screenshot({
        path: path.join(output, "jelly-native-" + fps + ".png"),
      });
      await page.getByRole("button", { name: /Controls/ }).click();
    }
    result.checks.push(
      "HOME expressions, all-direction drag at 30/60, native buffers and pixel-identical pause",
    );
    await choose("Screens");
    await page.locator('[data-screen="SENSED"]').click();
    await page.waitForTimeout(650);
    await choose("Expressions");
    for (const cue of ["Worried", "Surprised"]) {
      await search.fill(cue);
      await page
        .locator("#expression-library button")
        .filter({ hasText: new RegExp("^" + cue, "i") })
        .first()
        .click();
      await page.waitForTimeout(500);
    }
    await choose("Screens");
    for (const screen of [
      "BOOT_BLACK",
      "DISPLAY_INIT",
      "ASSET_LOADING",
      "BLOB_WAKE",
      "BLOB_READY",
      "PAUSE",
      "DIMMED_PAUSE",
      "SLEEP",
      "WAKE",
      "SEARCHING",
      "PAIRING",
      "CONNECTING",
      "CONNECTED_CONFIRMATION",
      "OFFLINE",
      "RECONNECTING",
      "ERROR",
      "FIRMWARE_UPDATE",
      "UPDATE_COMPLETE",
      "LOW_POWER",
    ]) {
      await page.locator('[data-screen="' + screen + '"]').click();
      await page.waitForTimeout(100);
    }
    await page
      .getByRole("button", { name: "Pause screen", exact: true })
      .click();
    const screenFrozen = await page
      .locator("canvas")
      .evaluateAll((cs) => cs.map((c) => c.toDataURL()));
    await page.waitForTimeout(300);
    assert.deepEqual(
      await page
        .locator("canvas")
        .evaluateAll((cs) => cs.map((c) => c.toDataURL())),
      screenFrozen,
      "lifecycle pause",
    );
    await page.getByRole("button", { name: "Replay", exact: true }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    result.checks.push(
      "SENSED variants, 19 lifecycle screens, pause/replay/reset",
    );
    // Browser-native touch input exercises pointer capture and cancellation on mobile.
    const touch = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const tp = await touch.newPage();
    tp.on("pageerror", (e) => result.errors.push(e.message));
    await tp.goto("http://127.0.0.1:3010/experimental/cloud?idle=0");
    await tp.waitForTimeout(400);
    const tc = tp.getByLabel("Cloud character preview"),
      r = await tc.boundingBox();
    const cdp = await touch.newCDPSession(tp);
    const x = r.x + r.width / 2,
      y = r.y + r.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 40, y: y - 20 }],
    });
    await tp.waitForTimeout(700);
    assert.ok(
      await tc.evaluate((c) => Number(c.dataset.x) > 10),
      "native touch moves Cloud",
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await tp.waitForTimeout(2500);
    assert.ok(
      await tc.evaluate(
        (c) => Math.hypot(Number(c.dataset.x), Number(c.dataset.y)) < 3,
      ),
      "touch cancel settles",
    );
    await touch.close();
    result.checks.push("mobile native touch drag and cancellation");
    assert.equal(result.errors.length, 0, result.errors.join("\n"));
    console.log("BROWSER PASS", result.checks);
  } finally {
    fs.writeFileSync(
      path.join(output, "browser-results.json"),
      JSON.stringify(result, null, 2),
    );
    if (browser) await browser.close();
    if (server) server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
