# State Management

> How state is managed in `scbox-app`.

---

## Current Approach

Local component state with `useState` only — see `App.tsx` (`greetMsg`, `name`).
There is **no** global state library (Redux/Zustand/Jotai) and no router in the
project today. Don't add one until a real cross-component need exists.

---

## State Categories

| Category | Tool | Notes |
|----------|------|-------|
| Local UI state | `useState` / `useReducer` | Default. Keep it in the component that owns it. |
| Shared cross-component state | lift to nearest common parent, then `useContext` if prop-drilling gets deep | Reach for a library only when context churn becomes a real problem. |
| "Server" state (Rust IPC results) | local state inside a command hook | See [hook-guidelines.md](./hook-guidelines.md). No cache layer yet. |
| Native events from Rust | `listen` from `@tauri-apps/api/event` inside an effect | Subscribe in `useEffect`, unsubscribe in cleanup. |

---

## Immutability

Never mutate state in place. Produce new objects/arrays with the spread
operator and pass the result to the setter:

```tsx
setUser((prev) => ({ ...prev, name }));
setItems((prev) => [...prev, item]);
```

Use the functional updater form (`setX(prev => ...)`) whenever the next value
depends on the previous one.

---

## When to Promote State

Promote local state to a shared location only when:
- Two or more sibling components need the same value, **and**
- Lifting to the common parent would cause excessive prop-drilling.

Prefer `useContext` before any third-party global-state dependency.

---

## Common Mistakes

- Mutating an object/array held in state instead of creating a new one.
- Duplicating a Rust command's result into several components' state instead of
  fetching once in a parent (or a shared hook) and passing it down.
- Adding a global-state or routing library prematurely for a single screen.
