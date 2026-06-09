import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import {
  MousePointer2,
  Pencil,
  Repeat,
  RotateCw,
  Settings as SettingsIcon,
  Volume2,
  X,
} from "lucide-react";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { useBuildOrders } from "./hooks/useBuildOrders";
import { useBuildOrderVoice } from "./hooks/useBuildOrderVoice";
import { useRecurringCues } from "./hooks/useRecurringCues";
import type { RecurringCueState } from "./hooks/useRecurringCues";
import { useInterpolatedClock } from "./hooks/useInterpolatedClock";
import { useVoiceCapability } from "./hooks/useVoiceCapability";
import { useApplyTheme } from "./hooks/useApplyTheme";
import { useSettings } from "./hooks/useSettings";
import { useWindowControls } from "./hooks/useWindowControls";
import { cn } from "@/lib/utils";
import { FALLBACK_BUILD } from "./lib/builds";
import { identifyMatchup, parseMatchup, selectBuild } from "./lib/matchup";
import { formatGameTime, raceLabel } from "./lib/format";
import { upcomingStepIndices } from "./lib/schedule";
import {
  BUILDS_CHANGED_EVENT,
  NAVIGATE_EDITOR_EVENT,
  OVERLAY_VISIBILITY_EVENT,
  SETTINGS_CHANGED_EVENT,
  type NavigateEditorPayload,
  type OverlayVisibilityPayload,
} from "./lib/events";
import type { Settings } from "./hooks/useSettings";
import type { BuildOrder, StoredBuild } from "./types/build";
import type { GameSnapshot } from "./types/sc2";

/** The current connection/coaching state derived from the live snapshot. */
type OverlayState = "live" | "waiting" | "replay" | "disconnected";

/**
 * Resolve the manually-overridden build by filename within the loaded set. A
 * null override (auto) or a filename no longer present yields null so the caller
 * falls back to the matchup auto-selection.
 */
function resolveOverride(
  stored: StoredBuild[],
  override: string | null,
): BuildOrder | null {
  if (override === null) return null;
  return stored.find((s) => s.filename === override)?.build ?? null;
}

function overlayState(snapshot: GameSnapshot): OverlayState {
  if (!snapshot.connected) return "disconnected";
  if (snapshot.is_replay) return "replay";
  if (snapshot.in_game) return "live";
  return "waiting";
}

/** Short connection line shown next to the clock (mockup `.conn`). */
function connText(state: OverlayState, port: number): string {
  switch (state) {
    case "live":
      return `已连接 ${port}`;
    case "waiting":
      return "等待对局";
    case "replay":
      return "回放中";
    case "disconnected":
      return "未连接";
  }
}

/** Render a matchup like `TvP` with the middle `v` in the accent color. */
function MatchupLabel({ matchup }: { matchup: string }) {
  const parsed = parseMatchup(matchup);
  if (!parsed) {
    return (
      <span className="font-mono text-[12px] font-semibold text-[color:var(--o-fg)]">
        {matchup}
      </span>
    );
  }
  return (
    <span className="font-mono text-[12px] font-semibold text-[color:var(--o-fg)]">
      {parsed.mine}
      <span className="text-[color:var(--o-accent)]">v</span>
      {parsed.opp}
    </span>
  );
}

interface BuildPanelProps {
  build: BuildOrder;
  snapshot: GameSnapshot;
  currentTime: number;
  settings: Settings;
  /** Reports whether a cue is actively firing, to drive the footer's speaking state. */
  onSpeakingChange: (speaking: boolean) => void;
}

/**
 * Per-cue UI state plus the live clock, so the discipline rows can compute their
 * own countdown without threading `currentTime` separately into the renderer.
 */
interface RecurringRow extends RecurringCueState {
  currentTime: number;
}

/**
 * The "discipline timer" section: a compact, always-on row per recurring cue
 * showing its next-occurrence countdown, kept separate from the upcoming-steps
 * list so it never crowds the future-3-steps view. Renders nothing when the
 * active build has no recurring cues, so layout is unchanged for those builds.
 *
 * Countdown mirrors the imminent-step text: `-Ns` while pending, `现在` at/after
 * the target, and `—` when there is no upcoming occurrence (past `endSec`).
 */
function RecurringRows({ cues }: { cues: RecurringRow[] }) {
  if (cues.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-[color:var(--o-border)] px-3.5 pt-2 pb-1">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--o-muted)] [&_svg]:size-[11px]">
        <Repeat />
        循环提醒
      </div>
      {cues.map((cue, i) => {
        const remaining =
          cue.nextTargetTime === null
            ? null
            : Math.max(0, Math.ceil(cue.nextTargetTime - cue.currentTime));
        const countdownText =
          remaining === null ? "—" : remaining > 0 ? `-${remaining}s` : "现在";

        return (
          <div
            key={`${cue.say}-${i}`}
            className="grid grid-cols-[1fr_auto] items-center gap-2 py-0.5"
          >
            <span className="truncate text-[13px] font-medium text-[color:var(--o-fg)]">
              {cue.say}
            </span>
            <span className="font-mono text-[13px] tabular-nums text-[color:var(--o-accent)]">
              {countdownText}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The next-step coach panel. Extracted so the voice hook only runs (and only
 * needs a non-null build) when there is actually a build to coach with.
 * `currentTime` is the interpolated in-game clock, driving both the cue
 * scheduling and the smooth per-second countdown. `settings` supplies the
 * voice gate/rate and the lead-time override.
 *
 * Shows up to 3 upcoming steps: the imminent one (highlighted, with countdown)
 * and the next two dimmed. A brief `firing` pulse plays on the imminent row
 * when the spoken set just grew (a cue announced).
 */
function BuildPanel({
  build,
  snapshot,
  currentTime,
  settings,
  onSpeakingChange,
}: BuildPanelProps) {
  const { spokenCount, spoken } = useBuildOrderVoice(
    snapshot,
    build,
    currentTime,
    {
      voiceEnabled: settings.voiceEnabled,
      voiceRate: settings.voiceRate,
      leadTimeSecOverride: settings.leadTimeSecOverride,
    },
  );

  // Recurring discipline cues (e.g. inject/creep) run in parallel with the
  // linear build order, driven by their own independent voice toggle. The hook
  // must run unconditionally at the top of the component.
  const recurring = useRecurringCues(snapshot, build, currentTime, {
    voiceEnabled: settings.recurringVoiceEnabled,
    voiceRate: settings.voiceRate,
    leadTimeSecOverride: settings.leadTimeSecOverride,
  });

  // Effective lead time mirrors the scheduler: the override when set, else the
  // build's own value. Keeps the countdown in lockstep with when cues fire.
  const effectiveLeadTime = settings.leadTimeSecOverride ?? build.leadTimeSec;

  // Pulse the imminent row + flag "speaking" briefly whenever a new cue fires.
  const prevSpokenCountRef = useRef(spokenCount);
  const [firing, setFiring] = useState(false);
  useEffect(() => {
    if (spokenCount > prevSpokenCountRef.current) {
      setFiring(true);
      onSpeakingChange(true);
      const timer = setTimeout(() => {
        setFiring(false);
        onSpeakingChange(false);
      }, 1200);
      prevSpokenCountRef.current = spokenCount;
      return () => clearTimeout(timer);
    }
    prevSpokenCountRef.current = spokenCount;
  }, [spokenCount, onSpeakingChange]);

  const upcomingIndices = upcomingStepIndices(build, spoken, 3);

  // Pair each cue's UI state with the live clock so the row renderer can compute
  // its own countdown.
  const recurringRows: RecurringRow[] = recurring.map((cue) => ({
    ...cue,
    currentTime,
  }));

  if (upcomingIndices.length === 0) {
    return (
      <>
        <div className="px-2.5 pt-1.5 pb-3">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border border-[color:color-mix(in_oklab,var(--o-accent),transparent_75%)] bg-[color:color-mix(in_oklab,var(--o-accent),transparent_90%)] px-3 py-2.5">
            <span className="font-mono text-[13px] tabular-nums text-[color:var(--o-accent)]">
              —
            </span>
            <span className="text-[14px] font-medium text-[color:var(--o-fg)]">
              建造顺序已播完
            </span>
            <span className="font-mono text-[13px] tabular-nums text-[color:var(--o-accent)]">
              ✓
            </span>
          </div>
        </div>
        <RecurringRows cues={recurringRows} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5 px-2.5 pt-1.5 pb-3">
      {upcomingIndices.map((idx, position) => {
        const step = build.steps[idx];
        const isImminent = position === 0;
        const countdown = isImminent
          ? Math.max(0, Math.ceil(step.time - effectiveLeadTime - currentTime))
          : null;

        return (
          <div
            key={idx}
            className={cn(
              "grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[10px] border border-transparent px-3 py-2.5 transition-all",
              isImminent &&
                "border-[color:color-mix(in_oklab,var(--o-accent),transparent_75%)] bg-[color:color-mix(in_oklab,var(--o-accent),transparent_90%)]",
              isImminent && firing && "ov-step-firing",
              !isImminent && "opacity-55",
              position === 2 && "opacity-30",
            )}
          >
            <span
              className={cn(
                "font-mono text-[13px] tabular-nums",
                isImminent
                  ? "text-[color:var(--o-accent)]"
                  : "text-[color:var(--o-muted)]",
              )}
            >
              {formatGameTime(step.time)}
            </span>
            <span
              className={cn(
                "truncate text-[color:var(--o-fg)]",
                isImminent
                  ? "text-[17px] font-semibold"
                  : "text-[14px] font-medium",
              )}
            >
              {step.say}
            </span>
            <span
              className={cn(
                "font-mono tabular-nums",
                isImminent
                  ? "text-[17px] font-bold text-[color:var(--o-accent)]"
                  : "text-[13px] text-[color:var(--o-muted)]",
              )}
            >
              {countdown !== null
                ? countdown > 0
                  ? `-${countdown}s`
                  : "现在"
                : ""}
            </span>
          </div>
        );
      })}
      </div>
      <RecurringRows cues={recurringRows} />
    </>
  );
}

/**
 * Banner shown in non-live states, replacing the steps/clock/footer. Waiting
 * uses a spinner; replay/disconnected show a static reason.
 */
function OverlayBanner({ state, port }: { state: OverlayState; port: number }) {
  const content: Record<
    OverlayState,
    { title: string; sub: string; spinner: boolean }
  > = {
    live: {
      title: "对局进行中",
      sub: "",
      spinner: false,
    },
    waiting: {
      title: "等待对局开始…",
      sub: `已连接 SC2 Client API（127.0.0.1:${port}）·进入对战后自动播报`,
      spinner: true,
    },
    replay: {
      title: "回放中（不引导）",
      sub: "回放模式下不进行建造顺序播报",
      spinner: false,
    },
    disconnected: {
      title: "SC2 未连接",
      sub: "请启动星际争霸 2 并启用 Client API",
      spinner: false,
    },
  };
  const banner = content[state];

  return (
    <div className="px-4 pt-5 pb-6 text-center">
      {banner.spinner && (
        <div className="mx-auto mb-3.5 size-[22px] animate-spin rounded-full border-2 border-[color:var(--o-border)] border-t-[color:var(--o-accent)]" />
      )}
      <div className="mb-1.5 text-[16px] font-semibold text-[color:var(--o-fg)]">
        {banner.title}
      </div>
      <div className="text-[12px] leading-relaxed text-[color:var(--o-muted)]">
        {banner.sub}
      </div>
    </div>
  );
}

function App() {
  const { snapshot } = useGameSnapshot();
  const currentTime = useInterpolatedClock(snapshot);
  const { builds, stored, errors, loadError, reload } = useBuildOrders();
  const { needsInstallHint } = useVoiceCapability();
  const {
    settings,
    saveSettings,
    reload: reloadSettings,
    error: settingsError,
  } = useSettings();
  const [hintDismissed, setHintDismissed] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Apply the global theme to the overlay's document; the overlay dark-glass
  // (`.dark .overlay-card`) follows the same `.dark` class. Settings + the
  // SETTINGS_CHANGED reload listener below keep `settings.theme` live.
  useApplyTheme(settings.theme);

  // Apply window position, click-through, and listen for global shortcut.
  useWindowControls({ settings, saveSettings });

  // Content-fit sizing (overlay only): keep the frameless, transparent window
  // hugging the full content so there is no empty chrome — or, when auxiliary
  // surfaces (passthrough hint, settings/voice/load/parse errors) render outside
  // the card, no overflow/scrollbar — in any state. Observe the inner fixed-width
  // `w-[328px]` content column (which contains the card AND all auxiliary
  // surfaces) and resize the window to its offset box plus the `<main>` `p-2`
  // padding (16px). Measuring the intrinsic-width column rather than `<main>`
  // means a transient scrollbar can't shrink `offsetWidth` and collapse the
  // window into a sliver. `App` only renders in the overlay window, so this is
  // inherently overlay-scoped.
  const contentRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const appWindow = getCurrentWindow();

    const applySize = (): void => {
      // Measure the inner fixed-width column (intrinsic 328px, immune to any
      // scrollbar) and re-add the `<main>` `p-2` padding (8px each side = 16).
      const width = Math.ceil(el.offsetWidth) + 16;
      const height = Math.ceil(el.offsetHeight) + 16;
      void appWindow
        .setSize(new LogicalSize(width, height))
        .catch((e: unknown) => {
          console.error("Failed to resize overlay window:", e);
        });
    };

    applySize();
    const observer = new ResizeObserver(() => applySize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reload build orders on the transition INTO a live game, so an edit made
  // between games is picked up without restarting the app.
  const wasInGameRef = useRef(false);
  useEffect(() => {
    if (snapshot.in_game && !wasInGameRef.current) {
      reload();
    }
    wasInGameRef.current = snapshot.in_game;
  }, [snapshot.in_game, reload]);

  // Reload immediately when the main window saves/deletes a build, so the
  // overlay reflects edits without waiting for the next game or a manual reload.
  useEffect(() => {
    const unlisten = listen(BUILDS_CHANGED_EVENT, () => reload());
    return () => {
      void unlisten.then((off) => off());
    };
  }, [reload]);

  // Reload settings live when the main window saves them (Q4): click-through,
  // voice, lead-time, and the active-build override all take effect at once.
  useEffect(() => {
    const unlisten = listen(SETTINGS_CHANGED_EVENT, () => {
      void reloadSettings();
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [reloadSettings]);

  // The active build = the manual override (looked up by filename in the loaded
  // set) when set, else the matchup auto-selection (Q2). When live with a known
  // matchup, auto-select by race; otherwise guide with the first loaded build.
  // Either path falls back to the bundled build when nothing loaded.
  const matchup = snapshot.in_game ? identifyMatchup(snapshot.players) : null;
  const overridden = resolveOverride(stored, settings.activeBuildOverride);
  const autoSelected = matchup
    ? selectBuild(builds, matchup.myRace, matchup.oppRace)
    : builds.length > 0
      ? builds[0]
      : null;
  const activeBuild: BuildOrder = overridden ?? autoSelected ?? FALLBACK_BUILD;

  // Filename of the active build, used to navigate the editor to it. The
  // override carries its filename directly; in auto mode reverse-look it up in
  // the loaded set. Unknown (e.g. FALLBACK_BUILD) resolves to "" so the editor
  // opens without forcing a selection.
  const activeFilename =
    settings.activeBuildOverride ??
    stored.find((s) => s.build === activeBuild)?.filename ??
    "";

  // Open + focus the main window, then ask it to navigate to the editor and
  // select the active build (cross-window, so via an app event).
  const openEditor = (): void => {
    void invoke("open_main")
      .then(() => {
        const payload: NavigateEditorPayload = { filename: activeFilename };
        return emit(NAVIGATE_EDITOR_EVENT, payload);
      })
      .catch(() => {
        // Main window failed to focus / event failed; nothing actionable here.
      });
  };

  // Hide the overlay itself and tell the dashboard so its launch toggle syncs.
  const hideOverlay = (): void => {
    void invoke("hide_overlay")
      .then(() => {
        const payload: OverlayVisibilityPayload = { shown: false };
        return emit(OVERLAY_VISIBILITY_EVENT, payload);
      })
      .catch(() => {
        // Hide failed; leave the dashboard state unchanged.
      });
  };

  const state = overlayState(snapshot);
  const showBuild = state === "live";
  const passthrough = settings.clickThrough;
  const leadTime = settings.leadTimeSecOverride ?? activeBuild.leadTimeSec;

  const iconBtn =
    "grid size-[26px] place-items-center rounded-md border-0 bg-transparent text-[color:var(--o-muted)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--o-fg),transparent_90%)] hover:text-[color:var(--o-fg)] [&_svg]:size-[15px]";

  return (
    <main className="p-2">
      {/* Fixed-width content column (328px mockup design width). Wrapping the
          card AND the auxiliary surfaces here keeps the content-fit measured
          width constant: hints/errors wrap within 328px instead of widening
          `<main>`, so toggling passthrough only changes height. The content-fit
          ResizeObserver measures THIS column (intrinsic 328px), not `<main>`,
          so a transient scrollbar can never shrink the window into a sliver. */}
      <div ref={contentRef} className="w-[328px]">
        <div
          className={cn(
            "overlay-card overflow-hidden rounded-[14px] border border-[color:var(--o-border)] bg-[color:var(--o-surface)] text-[color:var(--o-fg)] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-opacity",
            passthrough && "opacity-45",
          )}
        >
          {/* Title bar = drag region. Icon buttons opt out of dragging so they
            stay clickable (children without the attr are interactive). */}
          <div
            data-tauri-drag-region
            className="flex cursor-grab select-none items-center justify-between border-b border-[color:var(--o-border)] bg-[color:var(--o-raise)] px-3 py-2 active:cursor-grabbing"
          >
            <div className="pointer-events-none flex min-w-0 items-center gap-2">
              <span className="font-mono text-[12px] tracking-[1px] text-[color:var(--o-muted)]">
                ⠿
              </span>
              <MatchupLabel matchup={activeBuild.matchup} />
              {activeBuild.name?.trim() ? (
                <span className="truncate text-[11px] text-[color:var(--o-fg)]">
                  {activeBuild.name}
                </span>
              ) : (
                <span className="truncate text-[11px] text-[color:var(--o-muted)]">
                  {raceLabel(activeBuild.race)}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                className={iconBtn}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={reload}
                aria-label="重载建造顺序"
              >
                <RotateCw />
              </button>
              <button
                type="button"
                className={iconBtn}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={openEditor}
                aria-label="编辑建造顺序"
              >
                <Pencil />
              </button>
              <button
                type="button"
                className={cn(
                  iconBtn,
                  passthrough && "text-[color:var(--o-accent)]",
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  void saveSettings({
                    ...settings,
                    clickThrough: !settings.clickThrough,
                  });
                }}
                aria-pressed={passthrough}
                aria-label="穿透模式"
                title="穿透模式（Ctrl+Shift+S 解除）"
              >
                <MousePointer2 />
              </button>
              <button
                type="button"
                className={iconBtn}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  void invoke("open_main").catch(() => {
                    // Main window failed to focus; nothing actionable here.
                  });
                }}
                aria-label="设置"
              >
                <SettingsIcon />
              </button>
              <button
                type="button"
                className={iconBtn}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={hideOverlay}
                aria-label="隐藏悬浮窗"
              >
                <X />
              </button>
            </div>
          </div>

          {showBuild ? (
            <>
              {/* Clock + connection */}
              <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1">
                <span className="font-mono text-[26px] font-semibold tabular-nums tracking-[0.02em] text-[color:var(--o-fg)]">
                  {formatGameTime(snapshot.display_time)}
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[color:var(--o-muted)]">
                  <span
                    className="ov-dot size-[7px] rounded-full"
                    aria-hidden
                  />
                  {connText(state, settings.clientApiPort)}
                </span>
              </div>

              <BuildPanel
                build={activeBuild}
                snapshot={snapshot}
                currentTime={currentTime}
                settings={settings}
                onSpeakingChange={setSpeaking}
              />

              {/* Footer: voice + lead time */}
              <div className="flex items-center justify-between border-t border-[color:var(--o-border)] px-3.5 pt-2 pb-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-mono text-[11px] [&_svg]:size-[13px]",
                    speaking
                      ? "text-[color:var(--o-accent)]"
                      : "text-[color:var(--o-muted)]",
                  )}
                >
                  <Volume2 />
                  {settings.voiceEnabled
                    ? `语音 开 · ${settings.voiceRate.toFixed(1)}×`
                    : "语音 关"}
                </span>
                <span className="font-mono text-[11px] text-[color:var(--o-muted)]">
                  提前 {leadTime}s 播报
                </span>
              </div>
            </>
          ) : (
            <OverlayBanner state={state} port={settings.clientApiPort} />
          )}
        </div>

        {/* Auxiliary surfaces — outside the overlay card so they don't disturb
          the live coaching layout. Settings, updates, and the connection
          diagnostic now live in the main window (the gear icon focuses it); the
          overlay keeps only the load hints. */}
        {settingsError && (
          <div className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[13px] text-destructive">
            无法保存设置：{settingsError}
          </div>
        )}

        {needsInstallHint && !hintDismissed && (
          <div className="mt-2 flex items-center gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-[12px] text-warning">
            <span>
              未检测到中文语音，请在系统中安装中文语音包以启用语音播报
            </span>
            <button
              type="button"
              className="ml-auto shrink-0 text-[15px] leading-none text-muted-foreground hover:text-foreground"
              onClick={() => setHintDismissed(true)}
              aria-label="关闭提示"
            >
              ×
            </button>
          </div>
        )}

        {loadError && (
          <div className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[13px] text-destructive">
            无法加载建造顺序：{loadError}
          </div>
        )}
        {errors.length > 0 && (
          <ul className="mt-2 list-none rounded-md bg-warning/10 px-2.5 py-1.5 text-[12px] text-warning">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {passthrough && (
          <div className="mt-2 text-center font-mono text-[11px] text-muted-foreground">
            穿透模式开启 · 按 Ctrl+Shift+S 解除
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
