# 修复暗色主题下原生滚动条显示为白色

## Goal

打包后在暗色主题下，主窗口内可滚动区域（流程列表、步骤预览等）的原生滚动条仍渲染成浅色（白色），与暗色界面割裂、观感差。需让原生滚动条跟随主题。

## What I already know

* `src/index.css` 未声明 `color-scheme`，也无自定义滚动条样式；`:root` 为浅色 token，`.dark` 类切换暗色 token（`index.css:139`）。
* WKWebView/Chromium 在缺省 `color-scheme` 时按浅色渲染原生滚动条，故暗色下为白色。

## Decision (ADR-lite)

**Context**: 暗色下原生滚动条为浅色，需跟随主题。
**Decision**: 用 `color-scheme`：`:root { color-scheme: light }`、`.dark { color-scheme: dark }`。让浏览器原生滚动条按主题着色（macOS + Windows 均生效），与系统观感一致。不自定义 webkit 滚动条样式。
**Consequences**: 改动最小、跨平台一致；放弃对滚动条尺寸/圆角的精细控制（当前无此需求）。

## Requirements

* `:root` 声明 `color-scheme: light`，`.dark` 声明 `color-scheme: dark`。
* 暗色主题下主窗口可滚动区域的原生滚动条为暗色。
* 不影响悬浮窗（其 body/#root `overflow: hidden`，无滚动条）。

## Acceptance Criteria

* [ ] 暗色主题下流程列表/步骤预览的滚动条为暗色（非白）。
* [ ] 浅色主题滚动条仍正常。
* [ ] `pnpm tauri dev` 下暗色实测滚动条颜色正确。

## Out of Scope

* 自定义滚动条尺寸/圆角/悬停样式。
* Bug 2（检查更新报错）——属运维（发布 draft release），另行处理。

## Technical Notes

* 仅改 `src/index.css`。主题切换由 `<html>` 上的 `.dark` 类驱动（见 `index.css:6-9`）。
