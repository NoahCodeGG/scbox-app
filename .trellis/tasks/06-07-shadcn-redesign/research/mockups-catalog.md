# Research: Mockups Catalog (8 static HTML files)

- **Query**: Catalog each of the 8 redesign mockups in `/Users/noahcode/Downloads/scbox-app/`
- **Scope**: external (static HTML prototypes provided by user) + cross-reference to in-app windows
- **Date**: 2026-06-07

## Summary table

| File | Purpose | In-app vs marketing | Maps to real window |
|---|---|---|---|
| `overlay.html` | The product overlay, shown inside a **demo harness** | IN-APP (the overlay itself) | `main` window (320x200 always-on-top) |
| `editor.html` | Build-order visual editor + live JSON preview | IN-APP | `editor` window (900x700) |
| `settings.html` | Settings form (identification / announce / overlay groups) | IN-APP | currently the in-overlay `SettingsPanel` popover — NOT a separate window today |
| `dashboard.html` | Main-window "仪表盘" with sidebar nav, connection/match cards, build picker, step preview | IN-APP (NET-NEW) | no current equivalent window/screen |
| `onboarding.html` | First-run 3-step setup wizard | IN-APP (NET-NEW) | no current equivalent |
| `landing.html` | Marketing landing page (hero, features, how-it-works, download) | MARKETING (website) | OUT of desktop re-skin |
| `scbox-overview.html` | Index of all 6 screens with CSS thumbnails | MARKETING/showcase | OUT of desktop re-skin |
| `index.html` | Byte-identical duplicate of `scbox-overview.html` | MARKETING/showcase | OUT (dedup of overview) |

All mockups are in Simplified Chinese (`lang="zh-CN"`), matching the current app's zh UI.

## Per-file detail

### `overlay.html` (the core, riskiest screen)
- **It is NOT the literal 320x200 overlay markup.** It is a full-viewport **demo harness**: a left `.harness` control panel (theme toggle, state toggle, play/reset clock sim) + a right `.stage` faux-game background. The actual product is the `.overlay` div, width **328px**, auto height. The harness/stage are explicitly commented "not part of the product" and must be discarded when porting.
- **The real overlay component to extract is `.overlay`** with these regions:
  - `.ov-bar` — drag region (`cursor:grab`), grip glyph `⠿`, matchup `TvP` (the `v` is accent-colored), build name (`terran-standard · 2基础开局`), and icon buttons: reload + settings (gear).
  - `.ov-clock` — large mono clock `0:00` (26px, tabular-nums) + connection pill `.conn` with pulsing `.dot` (states: green pulse / gray / amber `.warn`) and text `已连接 6119`.
  - `.ov-steps` — up to **3** steps. `.step.current` (highlighted, larger say text + countdown like `-0:06` or `现在`), `.step.upcoming` (dimmed; last one dimmer). `.step.firing` is a brief scale animation when a cue announces.
  - `.ov-banner` — `waiting` ("等待对局开始…" with spinner) and `paused` ("对局已暂停") banners that REPLACE the steps in those states.
  - `.ov-foot` — voice tag (speaker icon, `语音 开 · 1.0×`, `.speaking` highlight on announce) + lead-time text (`提前 4s 播报`).
- **Two themes via class on `.overlay`:**
  - default = **light** (white surface, black accent — the shadcn palette).
  - `.theme-dark` = dark glass: `--ov-dark-surface #0b0d10`, `--ov-dark-raise #15181d`, `--ov-dark-fg #f4f5f7`, `--ov-dark-muted #8a8f99`, `--ov-dark-border #262b33`, cyan accent `--ov-accent-cyan #22d3ee`, plus `backdrop-filter: blur(14px)`. The dark variant is the one that reads best over a game.
- **Four states** (harness toggles): `state-live` (highlight + countdown), `passthrough` (`opacity:.45`, plus a `穿透模式开启 · 按 Ctrl+Shift+S 解除` hint), `state-waiting` (banner replaces steps; dot gray), `state-paused` (banner + dimmed/grayscale steps; clock muted).
- These four states map cleanly to current snapshot fields (see code-mapping.md): live=`in_game`, waiting=`connected && !in_game`, paused≈clock frozen, passthrough=`settings.clickThrough`.

### `editor.html`
- macOS-style window chrome: `.titlebar` with traffic-light dots + `scbox-app — Build Order 编辑器`.
- Two-column `.cols` (1.25fr / 1fr): left = form, right = sticky live JSON preview.
- **Form**: `.pagehead` (title + 重载/保存 buttons), `.meta-grid` (3 fields: `matchup` text, `race` select, `leadTimeSec` number). `.sect-label` ("步骤 · steps" + count). `.steps` list of `.srow` rows: index, time (number + `s` unit), say (text), delete (trash icon). `.addbtn` dashed "添加步骤". `.savebar` with path `builds/terran-standard.json` and "按时间自动排序" note.
- **JSON preview**: dark code block (`pre`, bg `#0b0d10`) with syntax-colored tokens (`.k` keys cyan, `.s` strings green, `.n` numbers amber, `.p` punctuation gray), `.pv-head` with filename + green "JSON 有效" validity dot.
- The mockup form is simpler than the real editor: it lacks the sidebar build list, opponent select, supply→time estimate, import/export, and delete-confirm flow that exist today (see code-mapping.md).

### `settings.html`
- Same window chrome as editor. Max-width 760px.
- Three `.group` cards each with a `.ghead` mono label:
  - **对局识别**: 玩家名 (text, currently `NoahCode`), Client API 端口 (number `6119`).
  - **播报**: 提前播报时间 (number, `秒` unit), 语音播报 (toggle switch), 语音速度 (range slider 0.5–2.0, `1.0×` readout).
  - **悬浮窗**: 穿透模式 (toggle + amber hint about `Ctrl+Shift+S`), 置顶显示 (toggle), 窗口位置 (mono `x 1180 · y 64` + 重置 button).
- `.footbar`: app-data path + 还原默认 / 保存设置 buttons.
- **New fields vs current settings**: 玩家名 (player name), 置顶显示 (always-on-top toggle), 窗口位置 display + reset. Current `Settings` has no `playerName`, no `alwaysOnTop` (it's hardcoded in tauri.conf), and exposes windowX/Y only implicitly. The toggle UI (`.switch`/`.slider`) is a custom CSS toggle = shadcn `Switch`.

### `dashboard.html` (NET-NEW screen)
- macOS window chrome + a **sidebar shell** (`.shell` grid 208px/1fr). Sidebar: logo, nav links (仪表盘 active / Build Order → editor.html / 设置 → settings.html), version footer `v0.3.1 · Tauri 2`.
- Main: pagehead (仪表盘 + "启动悬浮窗" primary button). Two `.card` rows:
  - **连接状态** card: port `6119`, 已连接 badge, kv rows (轮询间隔, 端点, 语音引擎).
  - **当前对局** card: race badges (T me vs P), player names, kv rows (对阵 TvP, 游戏时钟 live, 状态 进行中).
  - **Build Order · 自动匹配** card: `.buildsel` list of selectable `.bopt` (pressed = bordered).
  - **步骤预览 · 接下来** card: `.strow` list with `.now` highlight.
- **No backend exists for this as a window** — it implies a multi-page main window with routing (sidebar nav) that the app does not have today. Data shown (connection, matchup, clock, build pick, steps) DOES exist in hooks, but there is no dashboard window/route.

### `onboarding.html` (NET-NEW screen)
- macOS window chrome. 3-step wizard: progress bar (`.prog`), steps with numbered circles (done/active states):
  1. 启用 SC2 Client API — copyable `-clientapi 6119`.
  2. 准备 Build Order — app-data path hints (Windows/macOS).
  3. 检测连接 — live `.detect` indicator that flips from spinner → green "已连接 · 检测到对局" (JS simulates after 2.6s).
- Footer: 稍后设置 (→dashboard) / 进入主窗口 (disabled until detect succeeds).
- **No backend / no first-run flag exists today.** This is a wholly new feature (needs a "has onboarded" persisted flag + connection-detect wiring).

### `landing.html` (MARKETING — out of scope for desktop re-skin)
- Sticky nav, hero with a mini overlay mock visual, 6 feature cards, 3-step how-it-works, download CTA (GitHub Actions / .msi / .exe), footer. Links to GitHub repo `NoahCodeGG/scbox-app`. This is a website, not an app window.

### `scbox-overview.html` and `index.html` (MARKETING/showcase — out of scope)
- `index.html` is a **byte-for-byte duplicate** of `scbox-overview.html` (verified: identical `<style>` and body; only a leading blank line differs). Both are a gallery linking to the other 6 screens with pure-CSS thumbnails. They are the design-system showcase / prototype index, not a product window.

## Caveats / Not Found
- The overlay mockup's harness/stage are demo scaffolding — only `.overlay` and its CSS (incl. the `.theme-dark` block and the four state classes) are the real artifact to port.
- `dashboard.html` and `onboarding.html` are NET-NEW screens with no current window or route; treat as feature work, not re-skin (see risks file).
- Mockups assume a `playerName` setting and always-on-top toggle the current backend does not have.
