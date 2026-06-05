import { useGameSnapshot } from "./hooks/useGameSnapshot";
import { useBuildOrderVoice } from "./hooks/useBuildOrderVoice";
import { formatGameTime, raceLabel } from "./lib/format";
import type { BuildOrder } from "./types/build";
import type { GameSnapshot } from "./types/sc2";
import terranStandard from "./data/builds/terran-standard.json";
import "./App.css";

// MVP ships a single matchup; import the one authored build statically.
// Build the typed value explicitly (instead of a bare `as` cast) so a renamed
// or missing required field in the JSON fails the type-check. The JSON may also
// carry doc-only keys (e.g. `_note`) that are intentionally dropped here.
const BUILD_ORDER: BuildOrder = {
  matchup: terranStandard.matchup,
  race: terranStandard.race,
  leadTimeSec: terranStandard.leadTimeSec,
  steps: terranStandard.steps.map((step) => ({
    time: step.time,
    say: step.say,
  })),
};

function statusText(snapshot: GameSnapshot): string {
  if (!snapshot.connected) return "SC2 未连接";
  if (snapshot.is_replay) return "回放中（不引导）";
  if (!snapshot.in_game) return "已连接 · 等待对局";
  return "对局进行中";
}

function App() {
  const snapshot = useGameSnapshot();
  const { nextStep, spokenCount } = useBuildOrderVoice(snapshot, BUILD_ORDER);

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
      </div>

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
        <div className="build">
          {nextStep ? (
            <>
              <span className="build-label">下一步</span>
              <span className="build-say">{nextStep.say}</span>
              <span className="build-time">
                {formatGameTime(nextStep.time)}
                <span className="build-countdown">
                  {" "}
                  ({Math.max(
                    0,
                    Math.ceil(
                      nextStep.time -
                        BUILD_ORDER.leadTimeSec -
                        snapshot.display_time,
                    ),
                  )}
                  s)
                </span>
              </span>
            </>
          ) : (
            <span className="build-done">建造顺序已播完 ({spokenCount})</span>
          )}
        </div>
      )}
    </main>
  );
}

export default App;
