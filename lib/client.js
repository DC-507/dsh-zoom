window.__ModuleLoader__.load({
	id: "dsh-zoom",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		//#region global zoom
		/** localStorage key holding the persisted zoom level. */
		const STORAGE_KEY = "dsh-zoom:level";
		/** Zoom ladder walked by the shortcuts (100% is the reset point). */
		const LEVELS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
		/** Level used when nothing has been persisted. */
		const DEFAULT_LEVEL = 1;
		/** Accepted persisted range; anything else counts as corrupt and resets. */
		const MIN_LEVEL = 0.5;
		/** @see MIN_LEVEL */
		const MAX_LEVEL = 3;
		/** Style-tag identity used for the viewport-unit patch below. */
		const PATCH_TAG_ID = "dsh-zoom/viewport-patch.css";

		/** Read the persisted zoom level, falling back to 100%. */
		function readLevel() {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY);
				if (raw === null) return DEFAULT_LEVEL;
				const parsed = Number(raw);
				if (!Number.isFinite(parsed) || parsed < MIN_LEVEL || parsed > MAX_LEVEL) return DEFAULT_LEVEL;
				return parsed;
			} catch (_error) {
				return DEFAULT_LEVEL;
			}
		}

		/** Persist the zoom level; storage faults never break the live view. */
		function writeLevel(level) {
			try {
				window.localStorage.setItem(STORAGE_KEY, String(level));
			} catch (_error) {}
		}

		/** Index of the ladder step closest to a level, so restored values snap onto the ladder. */
		function ladderIndex(level) {
			let best = 0;
			for (let index = 1; index < LEVELS.length; index += 1) {
				if (Math.abs(LEVELS[index] - level) < Math.abs(LEVELS[best] - level)) best = index;
			}
			return best;
		}

		/** Whether a selector matches something in this app build. */
		function has(selector) {
			try {
				return document.querySelector(selector) !== null;
			} catch (_error) {
				return false;
			}
		}

		/**
		* CSS zoom scales every length it multiplies, but viewport units resolve
		* against the unzoomed viewport and are then scaled — so a handful of
		* overlay clamp rules that use `100vh`/`100dvh` would overshoot. This patch
		* divides inside those rules, and the hashed selectors are guarded because
		* they change on any app rebuild.
		* @param level - current zoom factor.
		* @returns CSS text for the rules this build actually has.
		*/
		function viewportPatchCss(level) {
			const rules = [];
			if (has("._scrollable_4ub78_19")) rules.push(`._scrollable_4ub78_19{max-height:calc(100vh/${level} - 12px - max(12px,var(--dsh-frame-overlay-top,12px)))!important}`);
			if (has("._confirmation_cjd8z_1")) rules.push(`._confirmation_cjd8z_1{max-height:calc(100dvh/${level} - 48px)!important}`);
			if (has("._image_1hos8_18")) rules.push(`._image_1hos8_18{max-height:calc(100vh/${level} - 80px)!important}`);
			if (has("._toast_l6cvn_6")) rules.push(`._toast_l6cvn_6{max-width:min(calc(640px/${level}),calc(100vw/${level} - 48px))!important}`);
			return rules.join("\n");
		}

		/** The patch style tag, created in `apply` and removed with the client context. */
		let patchTag;

		/** Create or refresh the patch style tag. */
		function ensurePatchTag() {
			if (patchTag !== undefined && patchTag.isConnected) return patchTag;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-zoom";
			tag.dataset.pluginCss = PATCH_TAG_ID;
			document.head.appendChild(tag);
			patchTag = tag;
			return tag;
		}

		/**
		* Apply a zoom level to the whole shell.
		*
		* The property lives on the root element: that is the only placement that
		* scales the fixed-px chrome (sidebar, menus, settings) while keeping
		* body-level overlays viewport-anchored and leaving no document overflow.
		* A wrapper element collapses the app frame, so this must stay on <html>.
		* @param level - Zoom factor; 1 removes the override entirely.
		*/
		function applyLevel(level) {
			const root = document.documentElement;
			if (level === DEFAULT_LEVEL) root.style.removeProperty("zoom");
			else root.style.setProperty("zoom", String(level));
			root.style.setProperty("--dsh-ui-zoom", String(level));
			root.dataset.dshZoom = String(level);
			ensurePatchTag().textContent = viewportPatchCss(level);
			// Canvas-backed surfaces (terminal, editors, previews) rasterize at the
			// unzoomed size, so let them re-measure.
			try {
				window.dispatchEvent(new Event("resize"));
			} catch (_error) {}
		}

		/** Current level, shared by the shortcuts and the debugging handle. */
		let level = readLevel();

		/** Move one ladder step and apply + persist the result; clamps at both ends. */
		function step(direction) {
			const next = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, ladderIndex(level) + direction))];
			if (next === level) return level;
			level = next;
			applyLevel(level);
			writeLevel(level);
			return level;
		}

		/** Jump back to 100%. */
		function reset() {
			level = DEFAULT_LEVEL;
			applyLevel(level);
			writeLevel(level);
			return level;
		}

		/** Jump to an exact level (used by the debugging handle). */
		function setLevel(next) {
			const parsed = Number(next);
			if (!Number.isFinite(parsed) || parsed < MIN_LEVEL || parsed > MAX_LEVEL) return level;
			level = parsed;
			applyLevel(level);
			writeLevel(level);
			return level;
		}

		/** Whether the event selects "zoom in" (Cmd/Ctrl + plus or equals). */
		function isZoomIn(event) {
			return event.code === "Equal" || event.code === "NumpadAdd" || event.key === "+" || event.key === "=";
		}

		/** Whether the event selects "zoom out". */
		function isZoomOut(event) {
			return event.code === "Minus" || event.code === "NumpadSubtract" || event.key === "-" || event.key === "_";
		}

		/** Whether the event selects "reset zoom". */
		function isZoomReset(event) {
			return event.code === "Digit0" || event.code === "Numpad0" || event.key === "0";
		}

		/**
		* Handle the zoom shortcuts in the window capture phase.
		*
		* The shell's own dispatcher listens on `document` in the capture phase, so
		* a window capture listener runs first; stopping immediate propagation keeps
		* the chord away from editors and the terminal. Shift is allowed because
		* `Cmd+Shift+=` is how most layouts type "+"; only Option is excluded.
		* @param event - Keydown event from the window.
		*/
		function onKeyDown(event) {
			if (event.altKey) return;
			if (!(event.metaKey || event.ctrlKey)) return;
			if (isZoomIn(event)) {
				event.preventDefault();
				event.stopImmediatePropagation();
				step(1);
				return;
			}
			if (isZoomOut(event)) {
				event.preventDefault();
				event.stopImmediatePropagation();
				step(-1);
				return;
			}
			if (isZoomReset(event)) {
				event.preventDefault();
				event.stopImmediatePropagation();
				reset();
			}
		}

		/** Required client services: none — this plugin only touches the DOM. */
		const inject = [];

		/**
		* Install the zoom control: apply the persisted level immediately, so the
		* shell's first painted surfaces already sit at the right scale, then bind
		* the shortcuts for the lifetime of the client context.
		* @param ctx - Client root context.
		*/
		function apply(ctx) {
			applyLevel(level);
			window.__dshZoom = {
				get: () => level,
				set: setLevel,
				step,
				reset,
				levels: [...LEVELS]
			};
			const listener = (event) => onKeyDown(event);
			window.addEventListener("keydown", listener, true);
			ctx.effect(() => () => {
				window.removeEventListener("keydown", listener, true);
				const root = document.documentElement;
				root.style.removeProperty("zoom");
				root.style.removeProperty("--dsh-ui-zoom");
				delete root.dataset.dshZoom;
				patchTag?.remove();
				patchTag = undefined;
				delete window.__dshZoom;
			});
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
