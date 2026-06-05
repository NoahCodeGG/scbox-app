import { useEffect, useRef } from "react";
import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { useBuildOrders } from "./hooks/useBuildOrders";
import { useBuildOrderVoice } from "./hooks/useBuildOrderVoice";
import { useInterpolatedClock } from "./hooks/useInterpolatedClock";
import { pickActiveBuild } from "./lib/builds";
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

  // Reload build orders on the transition INTO a live game, so an edit made
  // between games is picked up without restarting the app.
  const wasInGameRef = useRef(false);
  useEffect(() => {
    if (snapshot.in_game && !wasInGameRef.current) {
      reload();
    }
    wasInGameRef.current = snapshot.in_game;
  }, [snapshot.in_game, reload]);

  const activeBuild = pickActiveBuild(builds);
  const showBuild = snapshot.in_game && !snapshot.is_replay;

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
      {!activeBuild && !loadError && (
        <div className="load-error">没有可用的建造顺序</div>
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

      {showBuild && activeBuild && (
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
