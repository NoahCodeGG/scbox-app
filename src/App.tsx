import { useEffect, useRef, useState } from "react";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { useBuildOrders } from "./hooks/useBuildOrders";
import { useBuildOrderVoice } from "./hooks/useBuildOrderVoice";
import { useInterpolatedClock } from "./hooks/useInterpolatedClock";
import { useVoiceCapability } from "./hooks/useVoiceCapability";
import { useSettings } from "./hooks/useSettings";
import { FALLBACK_BUILD } from "./lib/builds";
import { identifyMatchup, selectBuild } from "./lib/matchup";
import { formatGameTime, raceLabel } from "./lib/format";
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
}

/**
 * The next-step coach panel. Extracted so the voice hook only runs (and only
 * needs a non-null build) when there is actually a build to coach with.
 * `currentTime` is the interpolated in-game clock, driving both the cue
 * scheduling and the smooth per-second countdown.
 */
function BuildPanel({ build, snapshot, currentTime }: BuildPanelProps) {
  const { nextStep, spokenCount } = useBuildOrderVoice(
    snapshot,
    build,
    currentTime,
  );

  if (nextStep) {
    return (
      <div className="build">
        <span className="build-label">下一步</span>
        <span className="build-say">{nextStep.say}</span>
        <span className="build-time">
          {formatGameTime(nextStep.time)}
          <span className="build-countdown">
            {" "}
            ({Math.max(
              0,
              Math.ceil(nextStep.time - build.leadTimeSec - currentTime),
            )}
            s)
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="build">
      <span className="build-done">建造顺序已播完 ({spokenCount})</span>
    </div>
  );
}

function App() {
  const snapshot = useGameSnapshot();
  const currentTime = useInterpolatedClock(snapshot);
  const { builds, errors, loadError, reload } = useBuildOrders();
  const { needsInstallHint } = useVoiceCapability();
  const { settings, saveSettings, error: settingsError } = useSettings();
  const [hintDismissed, setHintDismissed] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Keep the editable draft in sync once settings load (or change externally).
  useEffect(() => {
    setNameDraft(settings.playerName);
  }, [settings.playerName]);

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

  const persistName = (): void => {
    const trimmed = nameDraft.trim();
    if (trimmed !== settings.playerName) {
      void saveSettings({ ...settings, playerName: trimmed });
    }
  };

  return (
    <main className="overlay">
      <div className="status-row">
        <span
          className={`dot ${snapshot.connected ? "dot-on" : "dot-off"}`}
          aria-hidden
        />
        <span className="status-text">{statusText(snapshot)}</span>
        {snapshot.in_game && (
          <span className="clock">{formatGameTime(snapshot.display_time)}</span>
        )}
        <button type="button" className="reload-btn" onClick={reload}>
          重载
        </button>
      </div>

      <div className="settings-row">
        <label className="player-name-label" htmlFor="player-name">
          我的名字
        </label>
        <input
          id="player-name"
          className="player-name-input"
          value={nameDraft}
          placeholder="输入游戏内名称"
          onChange={(e) => setNameDraft(e.currentTarget.value)}
          onBlur={persistName}
          onKeyDown={(e) => {
            if (e.key === "Enter") persistName();
          }}
        />
      </div>

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
        />
      )}
    </main>
  );
}

export default App;
