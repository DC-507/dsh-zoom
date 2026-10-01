#!/usr/bin/env node
/**
 * Smoke test for the dsh-zoom browser half.
 *
 * Runs the shipped client bundle against a minimal DOM stub: no browser, no
 * DeepSeek Harness, no dependencies. It pins the observable contract that the
 * shell relies on — the module registers under the package name, exposes
 * `apply`/`inject`, walks the zoom ladder on the documented chords, persists the
 * level, ignores unrelated chords, and cleans everything up on disposal.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const bundlePath = path.join(__dirname, "..", "lib", "client.js");
const source = fs.readFileSync(bundlePath, "utf8");
const pkg = require("../package.json");

// --- DOM stub -------------------------------------------------------------
let registered;
const listeners = [];
const styleTags = [];
const rootStyle = new Map();

globalThis.window = {};
const window = globalThis.window;
window.addEventListener = (type, fn, capture) => listeners.push({ type, fn, capture });
window.removeEventListener = () => {};
window.dispatchEvent = () => {};

const store = new Map();
window.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
};

const element = () => ({
  dataset: {},
  style: {},
  textContent: "",
  isConnected: false,
  remove() {
    this.isConnected = false;
  },
});

globalThis.document = {
  documentElement: {
    dataset: {},
    style: {
      setProperty: (name, value) => rootStyle.set(name, value),
      removeProperty: (name) => rootStyle.delete(name),
    },
  },
  head: {
    appendChild(tag) {
      tag.isConnected = true;
      styleTags.push(tag);
    },
  },
  createElement: element,
  querySelector: () => null,
};

window.__ModuleLoader__ = {
  load(entry) {
    registered = { id: entry.id, exports: entry.factory(() => {
      throw new Error("dsh-zoom must not require another module");
    }) };
  },
};

// --- helpers --------------------------------------------------------------
/** Build a keydown-like event; `code` is what the handler matches on. */
const chord = (code, overrides = {}) => ({
  code,
  key: code,
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  defaultPrevented: false,
  stopImmediatePropagation() {
    this.propagationStopped = true;
  },
  preventDefault() {
    this.defaultPrevented = true;
  },
  ...overrides,
});

const press = (event) =>
  listeners.filter((listener) => listener.type === "keydown").forEach((listener) => listener.fn(event));

const zoom = () => window.__dshZoom.get();

// --- assertions -----------------------------------------------------------
eval(source);

assert.equal(registered.id, pkg.name, "registration id must equal the package name");
assert.equal(typeof registered.exports.apply, "function", "client half must export apply()");
assert.ok(Array.isArray(registered.exports.inject), "client half must export an inject array");

let dispose;
registered.exports.apply({
  effect(run) {
    dispose = run();
  },
});

assert.equal(zoom(), 1, "default level is 100%");
assert.equal(rootStyle.has("zoom"), false, "100% must not set a zoom override");
assert.equal(styleTags.length, 1, "one viewport-patch style tag is created");
assert.equal(document.documentElement.dataset.dshZoom, "1");

const zoomIn = chord("Equal");
press(zoomIn);
assert.equal(zoom(), 1.1, "Cmd+= steps up");
assert.equal(store.get("dsh-zoom:level"), "1.1", "level is persisted");
assert.equal(zoomIn.defaultPrevented, true, "the chord is consumed");
assert.equal(rootStyle.get("zoom"), "1.1", "the root element carries the zoom");

press(chord("Equal"));
press(chord("Equal"));
assert.equal(zoom(), 1.5, "the ladder keeps stepping");

press(chord("Minus"));
assert.equal(zoom(), 1.25, "Cmd+- steps down");

press(chord("Digit0"));
assert.equal(zoom(), 1, "Cmd+0 resets");
assert.equal(rootStyle.has("zoom"), false, "reset removes the override");

press(chord("Equal", { altKey: true }));
assert.equal(zoom(), 1, "Option+Cmd+= is ignored");

press(chord("KeyA"));
assert.equal(zoom(), 1, "unrelated chords are ignored");

assert.deepEqual(window.__dshZoom.levels, [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]);

dispose();
assert.equal(rootStyle.has("zoom"), false, "disposal drops the override");
assert.equal(rootStyle.has("--dsh-ui-zoom"), false, "disposal drops the exposed scale");
assert.equal(styleTags[0].isConnected, false, "disposal removes the patch tag");
assert.equal(window.__dshZoom, undefined, "disposal removes the debug handle");

console.log("dsh-zoom smoke test: ok");
