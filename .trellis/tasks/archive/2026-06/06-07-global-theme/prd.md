# Global light/dark theme in Settings

## Goal

Replace the overlay-only Moon toggle with a GLOBAL theme control in Settings
(浅色 / 深色 / 跟随系统) that applies to the whole app — the main window AND the
overlay — persisted and synced across windows.

## What I already know

- `src/index.css` already defines a full shadcn `.dark` palette (`.dark { --background... }`, line ~134) — but the dark variant is currently overlay-scoped: `@custom-variant dark (&:is(.theme-dark *))` and `.overlay-card.theme-dark` gives the overlay its cyan dark-glass. The main window has no dark mode today.
- `src/App.tsx` (overlay) has a local `darkTheme` state + a Moon button that toggles `.theme-dark` on the overlay card (not persisted, overlay-only).
- Settings flow: `Settings` (Rust `settings.rs` + TS `useSettings.ts`) is the persisted, cross-window source; `SETTINGS_CHANGED_EVENT` already makes the overlay reload settings live after the main window saves. `SettingsPanel.tsx` is the settings page.
- Both windows render the same bundle (main → MainWindow, overlay → App); each loads settings via `useSettings`.

## Decision

- Add a persisted `theme: "light" | "dark" | "system"` to `Settings` (default `"system"`). Settings page gets a theme control (浅色/深色/跟随系统).
- Apply globally: a `.dark` class on `document.documentElement` driven by the resolved theme (for `"system"`, follow `prefers-color-scheme` + listen for changes). Both the main window and the overlay apply it from `settings.theme`, synced via `SETTINGS_CHANGED`.
- The overlay's dark-glass now follows the GLOBAL theme (the `--ov-*` cyan look applies when the app is dark), not a local toggle. REMOVE the overlay Moon button + local `darkTheme` state.
- Switch the dark variant from overlay-scoped (`.theme-dark`) to the standard global `.dark`.

## Requirements

- A theme setting persisted in `Settings` (`theme`), default `system`.
- Settings page control to choose 浅色/深色/跟随系统.
- Changing it applies to the main window AND overlay live (no restart), via the existing settings + SETTINGS_CHANGED sync.
- `system` follows the OS and updates when the OS theme changes.
- Overlay Moon toggle removed; overlay dark-glass follows the global theme.

## Acceptance Criteria

- [ ] Settings has a 浅色/深色/跟随系统 control; the choice persists.
- [ ] Switching to 深色 darkens the main window (dashboard/editor/settings, shadcn dark palette) AND the overlay (dark-glass); 浅色 reverts; both windows update live.
- [ ] 跟随系统 matches the OS and reacts to OS theme changes at runtime.
- [ ] Overlay no longer has the Moon button; no local theme state.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Technical Approach

- **Cross-layer `theme`**: `settings.rs` add `#[serde(default = "default_theme")] pub theme: String` (default "system"); add to `Default`; update the field-set tests (default/parse/round-trip/empty). `useSettings.ts` add `theme: "light" | "dark" | "system"` to `Settings` + `DEFAULT_SETTINGS` ("system"); `src/lib/settings.ts` `normalizeSettings` coerces invalid/undefined → "system". Update `lib/settings.test.ts` + `useSettings.test.ts`.
- **index.css**: change `@custom-variant dark (&:is(.theme-dark *))` → `@custom-variant dark (&:is(.dark *))` (standard global). Change `.overlay-card.theme-dark { ... }` → `.dark .overlay-card { ... }` (overlay dark-glass follows global `.dark`); keep `--ov-*` tokens + the light `.overlay-card` defaults.
- **Apply hook** `src/hooks/useApplyTheme.ts`: `useApplyTheme(theme: "light"|"dark"|"system")` → compute isDark (`theme==="dark" || (theme==="system" && matchMedia("(prefers-color-scheme: dark)").matches)`), `document.documentElement.classList.toggle("dark", isDark)`; for `system`, add a matchMedia `change` listener that re-applies; cleanup on unmount/dep change. Typed, no any. Under the hooks coverage gate → add a test (mock matchMedia + assert classList toggling for light/dark/system + listener cleanup).
- **MainWindow.tsx**: `const { settings, reload } = useSettings(); useApplyTheme(settings.theme);` and add a `SETTINGS_CHANGED_EVENT` listener → `reload()` so a theme change saved on the Settings page re-applies in the shell (the Settings page and MainWindow are separate useSettings instances).
- **App.tsx (overlay)**: `useApplyTheme(settings.theme)` (it already has settings + SETTINGS_CHANGED reload). Remove the Moon button, the `darkTheme` state, the `theme-dark` className, and the now-unused `Moon` import. The overlay card dark-glass comes from `.dark .overlay-card`.
- **SettingsPanel.tsx**: add a theme control (a shadcn Select or segmented buttons: 浅色/深色/跟随系统) bound to `draft.theme`; saved with the rest.

## Out of Scope

- A bespoke dark DESIGN for the dashboard/editor (uses shadcn's standard dark palette already defined).
- Windows verification.

## Technical Notes

- Additive cross-layer change: `Settings.theme` mirror in settings.rs ↔ useSettings ↔ normalize. No other contract changes.
- `useApplyTheme` runs per-window; both windows toggle their own `document.documentElement` — that's correct (separate webviews).
- Keep `--ov-*` overlay tokens; only the selector that activates them changes (global `.dark` instead of local `.theme-dark`).
