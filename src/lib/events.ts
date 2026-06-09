// Shared frontend event names emitted/listened across the overlay and editor
// windows. Centralized so both ends use the exact same string (a mismatch would
// silently break the cross-window reload).

/** Emitted by the editor after a build is saved/deleted; the overlay reloads. */
export const BUILDS_CHANGED_EVENT = "builds://changed";

/**
 * Emitted after the main window saves settings; the overlay reloads its
 * settings so click-through / voice / lead-time / active-build override take
 * effect live without a restart.
 */
export const SETTINGS_CHANGED_EVENT = "settings://changed";

/**
 * Emitted by the overlay's title-bar buttons to ask the main window to navigate
 * to a specific route. Unifies the former editor-only event so both the edit and
 * settings buttons share one reliable mechanism.
 *
 * Payload `{ route, filename? }`:
 * - `route` is a router path (`"/editor"`, `"/settings"`, …).
 * - `filename` is only meaningful for `"/editor"`: the build to auto-select. An
 *   empty/omitted filename means "just open the editor" without forcing a
 *   selection.
 */
export const NAVIGATE_EVENT = "navigate://to";

/** Payload for {@link NAVIGATE_EVENT}. */
export interface NavigatePayload {
  route: string;
  filename?: string;
}

/**
 * Emitted when the overlay's own visibility changes (e.g. its close button
 * hides it); the dashboard syncs its launch/hide toggle. Payload `{ shown }`.
 */
export const OVERLAY_VISIBILITY_EVENT = "overlay://visibility";

/** Payload for {@link OVERLAY_VISIBILITY_EVENT}. */
export interface OverlayVisibilityPayload {
  shown: boolean;
}
