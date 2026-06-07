# UI 英文统一改中文（i18n 前的过渡）

## Goal

把当前界面上零散的英文 UI 元素统一替换为中文，先满足全中文体验；多语言（i18n）后续单独做。仅改**用户可见文案**，不动代码标识、JSON 键、窗口 label、技术/专有名词。

## Decisions (locked)

- **D1 eyebrow 标签**：编辑器表单 race/opponent/leadTimeSec/name/steps 全译中文。
- **D2 术语**：`Build Order` / `build`（指流程对象）统一译「流程」。

## 译名表（glossary）

- race → 种族
- opponent → 对手
- leadTimeSec → 提前播报秒数
- name → 名称
- steps → 步骤
- Build Order / build（流程对象）→ 流程
- "Build Order 编辑器" → 流程编辑器
- "Build Order · 自动匹配" → 流程 · 自动匹配
- 主窗 tab "Build Order" → 流程
- "尚未加载任何 build" → 尚未加载任何流程
- dialog sr-only "Close" → 关闭

## 保留英文（不译）

- 专有/技术名词：SCV、JSON、Client API、API
- 快捷键：Ctrl / Shift / 等组合键
- 对阵记号：TvZ / TvP / vs / vX、种族字母 T/P/Z/X
- 代码标识、变量、函数名、Tauri 窗口 `label`（内部标识，非显示文案）、JSON 键、文件名、路径（如 `builds/`）、console 日志

## Requirements

- 全面扫描 `src/`（components、App.tsx、pages 等）的用户可见英文文案并按译名表/惯例译中文。
- 区分「显示文案」(译) 与「代码标识/窗口 label/JSON 键/路径」(不译)。
- 不改逻辑、不改数据契约、不改测试预期的非文案断言（若有断言依赖被改文案则同步更新）。

## Acceptance Criteria

- [ ] 主要界面（主窗/Dashboard/流程编辑器/设置/诊断/悬浮窗）无遗留的用户可见英文（保留清单除外）。
- [ ] eyebrow 标签为中文；「流程」术语统一。
- [ ] typecheck / vitest 全绿（受影响断言同步）。
- [ ] 无逻辑/契约改动。

## Definition of Done

- tsc / vitest 绿。
- 人工过一遍主要界面确认无英文残留。

## Out of Scope

- i18n 框架/多语言切换（后续单独任务）。
- 保留清单内的技术/专有名词。

## Technical Notes

- 候选位置：BuildEditor.tsx（标题/eyebrow/footer）、Dashboard.tsx（Build Order·自动匹配、尚未加载任何 build、vs/vX）、MainWindow.tsx（tab label）、SettingsPanel.tsx、DiagnosticPanel.tsx、ui/dialog.tsx（Close）。
- 注意 MainWindow `label=` 若是显示文案则译，若是窗口标识则不动——逐个判断。
