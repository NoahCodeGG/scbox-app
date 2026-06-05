# Type Safety

> Type safety conventions in `scbox-app`.

---

## Compiler Baseline (enforced)

`tsconfig.json` runs in `strict` mode with these extra checks on — they are part
of `npm run build` (`tsc && vite build`), so a violation fails the build:

- `strict: true`
- `noUnusedLocals: true` — no unused variables
- `noUnusedParameters: true` — no unused function parameters
- `noFallthroughCasesInSwitch: true`
- `isolatedModules: true` — use `import type` for type-only imports
- `allowImportingTsExtensions` + `noEmit` — Vite emits, `tsc` only type-checks

Because the build type-checks, **do not** rely on the dev server alone; run
`npm run build` (or `tsc --noEmit`) before declaring frontend work done.

---

## Rules

- **No `any`.** Use `unknown` for untrusted input (e.g. a caught error) and
  narrow it. See the error handling in [hook-guidelines.md](./hook-guidelines.md).
- Add explicit parameter and return types to exported functions and component
  props; let TypeScript infer obvious local variables.
- Use `interface` for object/prop shapes; use `type` for unions, intersections,
  and utilities. Prefer string-literal unions over `enum`.
- Use `import type { ... }` for type-only imports (required by
  `isolatedModules`).

---

## Typing the Rust Boundary

`invoke` is generic and returns `Promise<unknown>` by default. Always supply the
type argument and keep it in sync with the Rust command's return type:

```tsx
const msg = await invoke<string>("greet", { name });
```

Define a shared TS type per command payload/return and mirror the Rust
`serde`-serialized shape exactly (camelCase ↔ the Rust field names Tauri maps).
See [../tauri/ipc-commands.md](../tauri/ipc-commands.md) for the contract.

> The `invoke<T>` type argument is an **assertion**, not a runtime guarantee. If
> a command can return data shaped by external/untrusted input, validate it
> after the call (e.g. with a type guard) rather than trusting `T` blindly.

---

## Forbidden

- `any` in application code.
- Unchecked `as` assertions to silence the compiler (narrow instead).
- `@ts-ignore` / `@ts-expect-error` outside genuine tooling shims (the only
  current use is the documented `process` global in `vite.config.ts`).
