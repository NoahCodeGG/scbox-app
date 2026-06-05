# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

In `scbox-app` there is essentially **one** layer boundary that matters, plus
component-to-component props:

| Boundary | Common Issues |
|----------|---------------|
| React (TS) ↔ Rust (Tauri command) | command-name typos, snake_case↔camelCase arg keys, `invoke<T>` not matching the Rust return type, unregistered command, missing capability |
| Rust ↔ serde (de)serialization | field rename drift between a Rust struct and its TS type |
| Component ↔ Component | props shape changes |

The frontend and Rust cross only via `invoke` (commands) and `emit`/`listen`
(events). Everything important about that contract lives in
[../tauri/ipc-commands.md](../tauri/ipc-commands.md).

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip

---

## The Tauri Command Boundary (this project's critical seam)

A `#[tauri::command]` and its `invoke` call are a single contract written in two
languages. Both sides compile independently, so a mismatch only shows up at
runtime as a rejected promise. After touching either side, check every row:

### Checklist: After Adding or Changing a Command

- [ ] Function name == the string passed to `invoke("name", ...)`
- [ ] Rust parameter names (snake_case) == JS argument keys (camelCase)
- [ ] Rust return type == the `invoke<T>` type argument
- [ ] Command is listed in `tauri::generate_handler![...]` in `lib.rs`
- [ ] A capability in `src-tauri/capabilities/` grants it (and any new plugin's
      permission)
- [ ] Complex payloads have a Rust `serde` struct **and** a matching TS type,
      with field names aligned
- [ ] Failure path returns `Result<T, E: Serialize>`, and the frontend `invoke`
      call is wrapped in `try/catch`

**Why this is the whole game here**: in a Tauri app almost every bug that isn't
pure UI lives at this seam. The TS compiler can't see the Rust signature and the
Rust compiler can't see the `invoke` call, so nothing catches a drift between
them except this discipline.

### Mistake: serde Field Rename Drift

Renaming a field on a Rust `Serialize` struct silently breaks the TS type that
mirrors it. Search for the field name on the frontend before/after renaming, and
update the shared TS type in the same change.

---

## When to Create Flow Documentation

For a single-window desktop app this is rarely needed. Add a short flow note
(in the task's research notes, not here) only when:
- A feature chains several commands/events with ordering requirements
- A command mutates backend state shared via `tauri::State`
- The data shape crossing `invoke` is complex enough to have caused a bug before
