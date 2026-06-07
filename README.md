# scbox-app

**StarCraft 2 实时战术语音助手** — 一个 Tauri 2 + React + TypeScript 桌面应用，在游戏中通过语音播报和悬浮窗提示引导你完成精准的 build order 和战术时机。

灵感来源于手机应用 SCBox，但作为原生桌面应用运行在 SC2 旁边，无需额外设备。

---

## ✨ 核心特性

- **🎯 自动同步游戏时钟** — 通过 SC2 Client API（`127.0.0.1:6119`）实时读取游戏状态，无需手动计时
- **🗣️ 多层语音播报** — 跨平台语音支持（Web Speech → 原生 TTS → 安装提示），中文语音自动回退
- **📊 精确时间插值** — ~100ms 粒度的平滑倒计时，暂停时冻结，亚秒级提示精度
- **🎮 自动对阵识别** — 根据你的种族和对手种族自动选择对应的 build order，流程列表按当前对阵过滤并提供完整步骤预览
- **📝 52 个内置 build** — 随版本更新下发的只读默认流程，可一键「复制为我的流程」或新建生成可编辑副本（存于用户目录）
- **🪟 智能悬浮窗** — 可拖动定位、可选穿透模式（不抢游戏焦点）、显示未来 3 步、可自定义全局快捷键逃生
- **⚙️ 灵活配置** — 提前播报时间、API 端口、语音开关/速度、主题、窗口位置全部可调
- **🔄 自动更新** — 启动时及设置内「检查更新」自动获取签名新版本

---

## 📦 安装

### Windows（推荐）

1. 从 [GitHub Releases](https://github.com/NoahCodeGG/scbox-app/releases/latest) 下载最新的 `.msi` 或 `.exe` 安装包（已签名 + 支持自动更新）
2. 运行安装程序
3. 开发构建可在 [GitHub Actions（ci.yml）](https://github.com/NoahCodeGG/scbox-app/actions/workflows/ci.yml) 获取

### macOS

`release.yml` 现也构建 macOS `.dmg`（**Apple Silicon / 未公证**）。首次打开需右键「打开」，或执行：

```bash
xattr -dr com.apple.quarantine /Applications/scbox-app.app
```

### 本地开发（macOS / Linux / Windows）

```bash
# 安装依赖
pnpm install

# 开发模式运行
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

---

## 🚀 使用指南

### 1️⃣ 启用 SC2 Client API

在 SC2 启动选项中添加：

```
-clientapi 6119
```

或在 Battle.net 客户端 → SC2 设置 → 游戏启动参数中添加上述选项。

### 2️⃣ 准备 Build Order

应用内置 52 个只读默认 build（随版本更新下发），无需手动准备即可使用。要定制，请在主窗口左侧导航「流程」页：

- 选中某个只读默认流程，点击「复制为我的流程」生成可编辑副本
- 或直接新建一个流程

用户的可编辑 build 保存在用户目录：

**Windows:** `%APPDATA%\com.scbox-app.app\builds\`  
**macOS:** `~/Library/Application Support/com.scbox-app.app/builds/`

应用永远不会覆盖你的用户 build；开始新一局时会自动重载。

**Build Order JSON 格式：**（示例文件名如 `tvz-两船兵.json`）

```json
{
  "name": "TvZ 两船兵",
  "matchup": "TvZ",
  "race": "Terran",
  "leadTimeSec": 4,
  "steps": [
    { "time": 14, "say": "补给站" },
    { "time": 16, "say": "兵营" },
    { "time": 19, "say": "气矿" }
  ]
}
```

- `name`: 人类可读的流程名称
- `matchup`: 对阵匹配（如 `TvP`、`TvZ`、`TvX` = 任意对手）
- `race`: 你的种族（`Terran` / `Protoss` / `Zerg`）
- `leadTimeSec`: 提前几秒播报（可在设置中覆盖）
- `steps`: 时间点（游戏秒数）+ 播报内容；编辑器以 **mm:ss** 输入，磁盘仍存为秒（number）

### 3️⃣ 配置设置

在主窗口左侧导航点击 **设置**（仪表盘 / 流程 / 设置）打开设置面板：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| **玩家名** | 你的游戏内 ID（用于多人对战时识别"我"） | 空（自动识别） |
| **Client API 端口** | SC2 API 端口，匹配启动参数 | 6119 |
| **提前播报时间** | 覆盖 build order 的 leadTimeSec | null（使用 build 自带） |
| **语音播报** | 开关语音提示 | 开启 |
| **语音速度** | 播报速度（0.5–2.0） | 1.0 |
| **穿透模式** | 点击穿透到游戏（不抢焦点） | 关闭 |
| **穿透快捷键** | 解除穿透的全局快捷键（可自定义） | `Ctrl+Shift+S` |
| **主题** | 界面主题（深色 / 浅色 / 跟随系统） | 跟随系统 |

设置面板内还提供 **「检查更新」** 按钮，可手动触发自动更新检查（应用启动时也会自动检查）。

### 4️⃣ 悬浮窗操作

- **拖动：** 鼠标拖动窗口顶部条移动位置
- **穿透模式：** 开启后窗口变透明点击，**按穿透快捷键解除**（默认 `Ctrl+Shift+S`，可在设置自定义，防锁死）
- **多步显示：** 同时显示接下来 3 步，最近的高亮 + 倒计时，后两步灰显

---

## 🛠️ 开发

### 技术栈

- **前端:** React 18 + TypeScript + Vite
- **桌面:** Tauri 2（Rust + WebView2/WKWebView）
- **测试:** Vitest（前端单元测试）+ cargo test（Rust）
- **自动更新:** tauri-plugin-updater（启动 + 手动检查）
- **CI/CD:** GitHub Actions — `ci.yml`（push/PR 测试+构建）+ `release.yml`（tag 触发签名发布 + 自动更新，Win+Mac）

### 项目结构

```
scbox-app/
├── src/                    # React 前端代码
│   ├── components/         # UI 组件（SettingsPanel、流程编辑器页 等）
│   ├── hooks/             # React hooks（useGameSnapshot, useBuildOrderVoice 等）
│   ├── lib/               # 纯函数逻辑（schedule, clock, matchup, speech）
│   ├── types/             # TypeScript 类型定义
│   └── App.tsx            # 主应用（悬浮窗）
├── src-tauri/             # Tauri 后端（Rust）
│   ├── src/
│   │   ├── data/builds/   # 内置默认 build（编译期只读嵌入）
│   │   ├── builds.rs      # Build order 磁盘 IO
│   │   ├── sc2.rs         # SC2 Client API 轮询
│   │   ├── settings.rs    # 用户设置持久化
│   │   ├── tts.rs         # 原生 TTS 封装（tts crate）
│   │   └── lib.rs         # 主入口 + 命令注册
│   ├── capabilities/      # Tauri 权限配置
│   └── tauri.conf.json    # Tauri 配置（窗口、打包）
└── .trellis/              # Trellis 任务管理 + 规范文档
```

### 本地运行

```bash
# 1. 安装依赖
pnpm install

# 2. 开发模式（热重载）
pnpm tauri dev

# 3. 运行测试
pnpm test              # 前端单元测试
cd src-tauri && cargo test  # Rust 测试

# 4. 类型检查
npx tsc --noEmit

# 5. 构建生产版本
pnpm tauri build       # 输出到 src-tauri/target/release/bundle/
```

### 关键设计决策

1. **游戏时钟同步**  
   每秒轮询 `http://127.0.0.1:6119/game`，前端插值到 ~100ms 粒度（`useInterpolatedClock`），暂停时冻结。

2. **敌我识别**  
   优先匹配玩家名 → 回退 1v1 user vs computer → 兜底 `players[0]`。多人对战时第一个通常是本地玩家。

3. **语音分层回退**  
   Web Speech（浏览器）→ 原生 TTS（Rust `tts` crate，WinRT/AVFoundation）→ 安装提示。中文语音是 OS 级功能，需用户自行安装语音包。

4. **窗口控制**  
   `data-tauri-drag-region` 拖动、`setIgnoreCursorEvents` 穿透、全局快捷键（`tauri-plugin-global-shortcut`）解除穿透，位置持久化到 settings。

5. **Build Order 选择**  
   `matchup` 字段格式 `<我的种族字母>v<对手种族字母>`（如 `TvP`），精确匹配优先，`vX` 作为通配符。

---

## 📋 已知问题

- **多屏位置** — 多显示器时窗口位置持久化可能不准确
- **Windows 语音** — 需要系统安装中文语音包，否则无声（会提示）
- **macOS 未公证** — 应用未经 Apple 公证，首次打开需右键「打开」或 `xattr -dr com.apple.quarantine` 绕过 Gatekeeper

---

## 🤝 贡献

欢迎提 issue 和 PR！开发流程：

1. Fork 本仓库
2. 创建 feature 分支（`git checkout -b feature/xxx`）
3. 提交改动（`git commit -m 'feat: xxx'`）
4. Push 到分支（`git push origin feature/xxx`）
5. 提交 Pull Request

代码规范遵循 `.trellis/spec/` 下的文档。

---

## 📄 License

MIT License

---

## 🙏 致谢

- 灵感来源：[SCBox（参考视频）](https://www.bilibili.com/video/BV1564y1o7WE/)
- SC2 Client API 文档和社区
- Tauri 团队提供的跨平台桌面框架
