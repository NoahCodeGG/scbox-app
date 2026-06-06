import { useEffect, useRef, useState } from "react";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { useBuildOrders } from "./hooks/useBuildOrders";
import { useBuildOrderVoice } from "./hooks/useBuildOrderVoice";
import { useInterpolatedClock } from "./hooks/useInterpolatedClock";
import { useVoiceCapability } from "./hooks/useVoiceCapability";
import { useSettings } from "./hooks/useSettings";
import { useWindowControls } from "./hooks/useWindowControls";
import { useConnectionDiagnostic } from "./hooks/useConnectionDiagnostic";
import SettingsPanel from "./components/SettingsPanel";
import DiagnosticPanel from "./components/DiagnosticPanel";
import { FALLBACK_BUILD } from "./lib/builds";
import { identifyMatchup, selectBuild } from "./lib/matchup";
import { formatGameTime, raceLabel } from "./lib/format";
import { upcomingStepIndices } from "./lib/schedule";
import type { Settings } from "./hooks/useSettings";
import type { BuildOrder } from "./types/build";
import type { GameSnapshot } from "./types/sc2";
import "./App.css";

function statusText(snapshot: GameSnapshot): string {
  if (!snapshot.connected) return "SC2 未连接";
  if (snapshot.is_replay) return "回放中（不引导）";
  if (!snapshot.in_game) return "已连接 · 等待对局";
  return "对局进行中";
}

interface BuildPanelProps {
  build: BuildOrder;
  snapshot: GameSnapshot;
  currentTime: number;
  settings: Settings;
}

/**
 * The next-step coach panel. Extracted so the voice hook only runs (and only
 * needs a non-null build) when there is actually a build to coach with.
 * `currentTime` is the interpolated in-game clock, driving both the cue
 * scheduling and the smooth per-second countdown. `settings` supplies the
 * voice gate/rate and the lead-time override.
 *
 * Now shows up to 3 upcoming steps: the imminent one with countdown (highlighted),
 * and the next two dimmed.
 */
function BuildPanel({ build, snapshot, currentTime, settings }: BuildPanelProps) {
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

  // Effective lead time mirrors the scheduler: the override when set, else the
  // build's own value. Keeps the countdown in lockstep with when cues fire.
  const effectiveLeadTime = settings.leadTimeSecOverride ?? build.leadTimeSec;

  const upcomingIndices = upcomingStepIndices(build, spoken, 3);

  if (upcomingIndices.length === 0) {
    return (
      <div className="build">
        <span className="build-done">建造顺序已播完 ({spokenCount})</span>
      </div>
    );
  }

  return (
    <div className="build-steps">
      {upcomingIndices.map((idx, position) => {
        const step = build.steps[idx];
        const isImminent = position === 0;
        const countdown = isImminent
          ? Math.max(0, Math.ceil(step.time - effectiveLeadTime - currentTime))
          : null;

        return (
          <div
            key={idx}
            className={`build-step ${isImminent ? "build-step-imminent" : "build-step-upcoming"}`}
          >
            <span className="build-say">{step.say}</span>
            <span className="build-time">
              {formatGameTime(step.time)}
              {countdown !== null && (
                <span className="build-countdown"> ({countdown}s)</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const { snapshot, refetch } = useGameSnapshot();
  const currentTime = useInterpolatedClock(snapshot);
  const { builds, errors, loadError, reload } = useBuildOrders();
  const { needsInstallHint } = useVoiceCapability();
  const { settings, saveSettings, error: settingsError } = useSettings();
  const [hintDismissed, setHintDismissed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { showDiagnostic, openDiagnostic, closeDiagnostic } =
    useConnectionDiagnostic(snapshot.connected);

  // Apply window position, click-through, and listen for global shortcut.
  useWindowControls({ settings, saveSettings });

  // Reload build orders on the transition INTO a live game, so an edit made
  // between games is picked up without restarting the app.
  const wasInGameRef = useRef(false);
  useEffect(() => {
    if (snapshot.in_game && !wasInGameRef.current) {
      reload();
    }
    wasInGameRef.current = snapshot.in_game;
  }, [snapshot.in_game, reload]);

  // Re-pick the active build for the detected matchup. When live with a known
  // matchup, select by my/opponent race; otherwise guide with the first loaded
  // build. Either path falls back to the bundled build when nothing loaded.
  const matchup = snapshot.in_game
    ? identifyMatchup(snapshot.players, settings.playerName)
    : null;
  const selected = matchup
    ? selectBuild(builds, matchup.myRace, matchup.oppRace)
    : builds.length > 0
      ? builds[0]
      : null;
  const activeBuild: BuildOrder = selected ?? FALLBACK_BUILD;
  const showBuild = snapshot.in_game && !snapshot.is_replay;

  return (
    <main className="overlay">
      <div className="drag-handle" data-tauri-drag-region />
      <div className="status-row">
        <span
          className={`dot ${snapshot.connected ? "dot-on" : "dot-off"}`}
          aria-hidden
        />
        <span className="status-text">{statusText(snapshot)}</span>
        {snapshot.in_game && (
          <span className="clock">{formatGameTime(snapshot.display_time)}</span>
        )}
        {!snapshot.connected && (
          <button
            type="button"
            className="reload-btn"
            onClick={openDiagnostic}
          >
            诊断
          </button>
        )}
        <button type="button" className="reload-btn" onClick={reload}>
          重载
        </button>
        <button
          type="button"
          className="settings-btn"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-label="设置"
          aria-expanded={settingsOpen}
        >
          ⚙
        </button>
      </div>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <DiagnosticPanel
        isOpen={showDiagnostic}
        currentPort={settings.clientApiPort}
        onClose={closeDiagnostic}
        onOpenSettings={() => setSettingsOpen(true)}
        onRetry={refetch}
      />

      {settingsError && (
        <div className="load-error">无法保存设置：{settingsError}</div>
      )}

      {needsInstallHint && !hintDismissed && (
        <div className="voice-hint">
          <span>
            未检测到中文语音，请在系统中安装中文语音包以启用语音播报
          </span>
          <button
            type="button"
            className="voice-hint-dismiss"
            onClick={() => setHintDismissed(true)}
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      )}

      {loadError && (
        <div className="load-error">无法加载建造顺序：{loadError}</div>
      )}
      {errors.length > 0 && (
        <ul className="build-errors">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {showBuild && (
        <div className="active-build">
          <span className="active-build-matchup">{activeBuild.matchup}</span>
          <span className="active-build-name">
            {raceLabel(activeBuild.race)}
          </span>
        </div>
      )}

      {snapshot.in_game && snapshot.players.length > 0 && (
        <ul className="players">
          {snapshot.players.map((player) => (
            <li key={player.id}>
              <span className="player-name">{player.name}</span>
              <span className="player-race">{raceLabel(player.race)}</span>
            </li>
          ))}
        </ul>
      )}

      {showBuild && (
        <BuildPanel
          build={activeBuild}
          snapshot={snapshot}
          currentTime={currentTime}
          settings={settings}
        />
      )}
    </main>
  );
}

export default App;
