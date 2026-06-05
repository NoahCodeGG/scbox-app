# Component Guidelines

> How React components are built in `scbox-app`.

---

## Baseline

React 18.3 with the automatic JSX runtime (`tsconfig.json` → `"jsx":
"react-jsx"`), so **do not** `import React` just to use JSX. Import only the
hooks/APIs you use, as `App.tsx` does:

```tsx
import { useState } from "react";
```

`src/main.tsx` wraps the tree in `<React.StrictMode>`. Keep it — write effects
and event handlers that tolerate StrictMode's development double-invoke.

---

## Component Structure

Use plain **function components**. Do not use `React.FC`.

```tsx
interface GreetFormProps {
  onSubmit: (name: string) => void;
}

function GreetForm({ onSubmit }: GreetFormProps) {
  const [name, setName] = useState("");

  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
      }}
    >
      <input
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder="Enter a name..."
      />
      <button type="submit">Greet</button>
    </form>
  );
}

export default GreetForm;
```

Conventions visible in `App.tsx`:
- Default-export the primary component.
- Read input values via `e.currentTarget.value` (typed) rather than
  `e.target.value`.
- Handle `onSubmit` on the `<form>` and call `e.preventDefault()` — don't wire
  submit logic onto the button's `onClick`.

---

## Props

- Define props as a named `interface` (e.g. `GreetFormProps`).
- Type callback props explicitly: `onSubmit: (name: string) => void`.
- Destructure props in the parameter list.

---

## Styling

Plain CSS via `className`, imported per-component (`import "./App.css"`). There
is no CSS-in-JS or utility framework in this project. When adding a component,
pair it with its own `.css` file and import it from the component.

---

## Common Mistakes

- Adding `import React from "react"` unnecessarily (the JSX transform handles
  it).
- Calling a Tauri command directly during render instead of in an event handler
  or effect — `invoke` is async and must not run while rendering.
- Letting `App.tsx` accumulate every feature's state; extract early.
