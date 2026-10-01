/**
 * Host half of dsh-zoom.
 *
 * This package contributes browser-side presentation only (a global zoom
 * control), so the Host row is intentionally empty: it exists purely so the
 * Loader has a row to mount, while the browser half ships through
 * `exports["./client"]`.
 */

/** Host plugin body — no Host-side behaviour. */
export function apply() {}
