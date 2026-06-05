# Frontend Development Guidelines

> Conventions for the React + TypeScript frontend of `scbox-app`.

---

## Stack

- **React 18.3** with the automatic JSX runtime (`react-jsx`).
- **TypeScript 5.6** in `strict` mode (build = `tsc && vite build`).
- **Vite 6** dev server on fixed port **1420** (`npm run dev`).
- Desktop shell via **Tauri 2** — the frontend talks to Rust through IPC
  (`invoke`), documented in the [tauri](../tauri/index.md) spec layer.

State of the code: this started from the `create-tauri-app` scaffold. `App.tsx`
(the `greet` demo) is currently the only real component; the conventions below
define how the frontend should grow from here.

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | File layout and where new code goes |
| [Component Guidelines](./component-guidelines.md) | Function components, props, styling |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks and wrapping Tauri commands |
| [State Management](./state-management.md) | `useState`-first, immutability rules |
| [Type Safety](./type-safety.md) | Strict-mode rules and typing the Rust boundary |
| [Quality Guidelines](./quality-guidelines.md) | Build gate, forbidden patterns, review checklist |

Related: [Tauri spec layer](../tauri/index.md) ·
[Thinking Guides](../guides/index.md).

---

**Language**: All documentation is written in **English**.
