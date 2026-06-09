// Cross-component handoff for "navigate to editor and select this build".
//
// The overlay emits NAVIGATE_EVENT (route "/editor"); the main window's
// NavigationBridge
// (inside the router) catches it, stashes the target filename here, then
// navigates to /editor. The BuildEditor mounts AFTER the navigation, so it can
// miss a live listener — instead it reads (and consumes) this stash on mount.
// Stored at module level (a singleton in the main window) so it survives the
// brief gap between navigate() and BuildEditor mounting.

let pendingFilename: string | null = null;

/** Record the build to select once the editor mounts (empty string = none). */
export function setPendingEditorNav(filename: string): void {
  pendingFilename = filename.trim() === "" ? null : filename;
}

/** Read and clear the pending selection; returns null when nothing is pending. */
export function consumePendingEditorNav(): string | null {
  const filename = pendingFilename;
  pendingFilename = null;
  return filename;
}
