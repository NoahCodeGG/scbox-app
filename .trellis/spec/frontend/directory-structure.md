# Directory Structure

> How the React/TypeScript frontend is organized in `scbox-app`.

---

## Current Layout

```
src/
├── main.tsx          # React entry — mounts <App/> into #root with StrictMode
├── App.tsx           # Root component
├── App.css           # Component styles (plain CSS)
├── vite-env.d.ts     # Vite client type declarations
└── assets/           # Bundled images/icons referenced via import
```

The Rust/Tauri side lives in `src-tauri/` and is documented under
[../tauri/index.md](../tauri/index.md). Vite is told to ignore `src-tauri/`
(`vite.config.ts` → `server.watch.ignored`), so never import across that
boundary directly — cross it only through Tauri IPC.

---

## Where New Code Goes

The scaffold is flat. As the app grows, add these directories under `src/`
rather than piling everything into `App.tsx`:

| Concern | Location | Naming |
|---------|----------|--------|
| Reusable UI components | `src/components/` | `PascalCase.tsx` |
| Custom hooks | `src/hooks/` | `useXxx.ts` |
| Tauri command wrappers | `src/lib/commands.ts` (or `src/lib/ipc/`) | see [../tauri/ipc-commands.md](../tauri/ipc-commands.md) |
| Shared types | `src/types/` or co-located `*.ts` | `PascalCase` types |
| Pure helpers | `src/lib/` | `camelCase.ts` |
| Static assets | `src/assets/` | as imported |

Public, served-as-is files (e.g. `vite.svg`, `tauri.svg`) live in `public/` and
are referenced by absolute path (`/vite.svg`), not imported.

---

## Naming Conventions

- Component files: `PascalCase.tsx`, one primary component per file.
- Hook files: `useThing.ts`, hook name matches the file.
- Everything else: `camelCase.ts`.
- Co-locate a component's CSS next to it (`Thing.tsx` + `Thing.css`) following
  the existing `App.tsx` / `App.css` pairing.

---

## File Size

Keep files focused (200–400 lines typical, 800 max). When `App.tsx` starts
holding unrelated state and markup, extract sections into `src/components/`.
