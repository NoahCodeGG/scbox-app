# Quality Guidelines

> Code quality standards for the `scbox-app` frontend.

---

## Build Gate

`npm run build` runs `tsc && vite build`. Type errors fail the build, and
`noUnusedLocals` / `noUnusedParameters` mean dead variables and params are hard
errors. Run the build before considering frontend work complete; the dev server
(`npm run dev`, port 1420) does not type-check on its own.

There is no ESLint, Prettier, or test runner wired up yet. Until one is added,
quality is enforced by the TypeScript compiler and review against these specs.

---

## Required Patterns

- Function components, named prop interfaces, default export of the primary
  component (see [component-guidelines.md](./component-guidelines.md)).
- Immutable state updates (see [state-management.md](./state-management.md)).
- Every `invoke` call wrapped in `try/catch` with the error surfaced to the UI
  (see [hook-guidelines.md](./hook-guidelines.md)).
- Explicit types on exported functions, props, and `invoke<T>` calls.

---

## Forbidden Patterns

| Pattern | Why |
|---------|-----|
| `any` | Defeats strict typing. Use `unknown` + narrowing. |
| `console.log` in committed code | Noise / leaks. Remove before commit. |
| Mutating state in place | Causes stale-render and hidden-side-effect bugs. |
| Untyped `invoke(...)` | Loses the only contract with the Rust layer. |
| Swallowing a rejected command | The user must see IPC failures, not a dead UI. |
| `import React` only for JSX | Unneeded under the automatic runtime. |

---

## Review Checklist

- [ ] `npm run build` passes (type-check + bundle).
- [ ] No `any`, no stray `console.log`, no unused locals/params.
- [ ] Tauri command names + argument keys match the Rust signature.
- [ ] `invoke` calls are typed and wrapped in `try/catch`.
- [ ] State updates are immutable; effects clean up listeners.
- [ ] New components/hooks live in the right directory with correct naming
      (see [directory-structure.md](./directory-structure.md)).
