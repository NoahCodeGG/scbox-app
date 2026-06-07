# Editable JSON pane replaces the import/export panel

## Goal

The separate copy/paste import/export panel (`BuildTransferPanel`) is low value
now that the editor shows a live JSON preview. Make the JSON pane two-way
EDITABLE so editing/pasting JSON IS import, and selecting/copying it IS export —
and remove `BuildTransferPanel`.

## What I already know

- `src/components/BuildEditor.tsx`: holds `form: EditorForm` (race/opponent/leadTimeSec/steps as strings) as the source of truth. Memoizes `result = validateBuild(toDraft(form))`. Renders `<BuildJsonPreview filename json={result.ok ? exportBuildJson(result.build) : null} error={result.ok ? null : result.error} />` (read-only) AND `<BuildTransferPanel ... />` (textarea copy/paste import/export).
- `src/components/BuildJsonPreview.tsx`: read-only props `{ filename, json: string|null, error: string|null }` — header (filename + valid/invalid indicator) + a dark `<pre>`.
- `src/lib/buildTransfer.ts`: `exportBuildJson(build)` (pretty JSON) + `parseImportedBuild(text)` (`{ok:true,build}|{ok:false,error}`, guarded parse → validateBuild). Reuse both.
- `src/components/BuildTransferPanel.tsx` (+ `.css`): the panel to remove.

## Decision

- Convert `BuildJsonPreview` → an editable JSON editor (a controlled `<textarea>`, mono/dark, with the existing valid/invalid header indicator + a small "复制" button). Rename to `BuildJsonEditor` (or keep the name; your call).
- Two-way sync in `BuildEditor`, FORM is the canonical state:
  - `jsonText` local state + a `jsonFocused` flag.
  - **JSON → form**: on textarea change, `setJsonText(value)`; `parseImportedBuild(value)` → if ok, `setForm(toForm(build))` (form mirrors the JSON) and mark valid; if parse/validate fails, mark invalid + show the error and DO NOT clobber the form (keep last good form).
  - **form → JSON**: regenerate `jsonText` from the form ONLY when the JSON pane is NOT focused (so typing isn't reformatted under the cursor). Use a lenient serialization that always reflects the current form (even mid-edit) — e.g. when `validateBuild(toDraft(form))` is ok use `exportBuildJson(build)`, else serialize a plain object mirroring the form fields so the pane still shows JSON. On blur, re-sync to clean formatting.
- Remove `BuildTransferPanel` rendering + its props from `BuildEditor`; delete `BuildTransferPanel.tsx` + `.css`. KEEP `buildTransfer.ts` + its test (reused by the JSON pane).
- "复制": best-effort `navigator.clipboard.writeText(jsonText)` with graceful fallback (the textarea is selectable anyway).

## Requirements

- Editing/pasting valid JSON updates the build (form fields + steps) — import.
- The JSON pane reflects form edits (when not focused) and is copyable — export.
- Invalid JSON shows the invalid indicator + error and does not corrupt the form; save still validates via the form.
- No separate transfer panel; behavior (save/delete/reload/BUILDS_CHANGED) unchanged.

## Acceptance Criteria

- [ ] Pasting a valid build JSON into the pane populates the form (race/opponent/leadTime/steps); editing JSON values updates the corresponding fields.
- [ ] Editing the form updates the JSON text (when the pane isn't focused); 复制 copies it.
- [ ] Invalid JSON → red invalid + error, form unchanged; fixing it re-syncs.
- [ ] `BuildTransferPanel` is gone (file + css deleted, unimported); `buildTransfer.ts` + test remain.
- [ ] Typing in the JSON pane doesn't jump the cursor/reformat mid-edit.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- New backend; changing save/delete; Windows verification.

## Technical Notes

- Keep FORM as the single source of truth; `jsonText` is a synced text mirror with focus-gated regeneration to avoid bidirectional fights.
- Reuse `exportBuildJson` / `parseImportedBuild`. For the lenient form→JSON serialize when the form is invalid, a small helper that maps the form to a plain object (matchup derived via `raceNameToLetter`, race, leadTimeSec, steps[{time,say,supply?}]) and `JSON.stringify(…, null, 2)` is fine — or just show the last valid JSON; pick the simplest that always shows the current build and doesn't crash.
- The valid/invalid indicator now reflects the JSON pane's parse state (parseImportedBuild) rather than only the form's validateBuild — they coincide since parseImportedBuild delegates to validateBuild.
- No `any`, no console.log, immutable updates. Follow `.trellis/spec/frontend/{component-guidelines,type-safety,ui-system}.md`.
