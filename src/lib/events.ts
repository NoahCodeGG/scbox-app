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
