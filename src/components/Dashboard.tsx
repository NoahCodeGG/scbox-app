import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Square } from "lucide-react";
import { useGameSnapshot } from "../hooks/useGameSnapshot";
import { useInterpolatedClock } from "../hooks/useInterpolatedClock";
import { useBuildOrders } from "../hooks/useBuildOrders";
import { useSettings } from "../hooks/useSettings";
import { useConnectionDiagnostic } from "../hooks/useConnectionDiagnostic";
import { identifyMatchup, matchupMatches, raceCodeToLetter, selectBuild } from "../lib/matchup";
import { formatGameTime } from "../lib/format";
import { previewSpokenSet } from "../lib/schedule";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import DiagnosticPanel from "./DiagnosticPanel";
import type { GameSnapshot, PlayerInfo } from "../types/sc2";
import type { StoredBuild } from "../types/build";
import type { DetectedMatchup } from "../lib/matchup";

/** Mono uppercase eyebrow heading matching the dashboard card mockup. */
function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </CardTitle>
  );
}

/** A label/value row inside a card (mockup `.kv`). */
function KeyValue({
  k,
  v,
  accent,
}: {
  k: string;
  v: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between border-t py-2 text-sm first:border-t-0">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("font-mono tabular-nums", accent && "text-success")}>
        {v}
      </span>
    </div>
  );
}

/** The connection-status card, fed by the live snapshot + client port. */
function ConnectionCard({
  snapshot,
  port,
  onRetry,
}: {
  snapshot: GameSnapshot;
  port: number;
  onRetry: () => void;
}) {
  const connected = snapshot.connected;
  const navigate = useNavigate();
  // Reuse the 30s-disconnect timer here: the main window can show the modal
  // properly (it has room to scroll), so an auto-open after a sustained
  // disconnect is helpful rather than broken (as it was in the overlay).
  const { showDiagnostic, openDiagnostic, closeDiagnostic } =
    useConnectionDiagnostic(connected);

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="flex-row items-center justify-between px-5">
        <CardEyebrow>连接状态</CardEyebrow>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={openDiagnostic}
        >
          诊断 / 如何启用
        </Button>
      </CardHeader>
      <CardContent className="px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "size-[7px] rounded-full",
                connected ? "bg-success" : "bg-warning",
              )}
              aria-hidden
            />
            <span className="font-mono text-[30px] font-semibold tabular-nums tracking-tight">
              {port}
            </span>
            <span className="text-[13px] text-muted-foreground">
              Client API 端口
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[12px]",
              connected
                ? "border-success/40 bg-success/10 text-success"
                : "border-warning/40 bg-warning/10 text-warning",
            )}
          >
            <span
              className={cn(
                "size-[7px] rounded-full",
                connected ? "bg-success" : "bg-warning",
              )}
              aria-hidden
            />
            {connected ? "已连接" : "未连接"}
          </span>
        </div>
        <div className="mt-4">
          <KeyValue k="轮询间隔" v="1.0s · 插值 ~100ms" />
          <KeyValue k="端点" v={`127.0.0.1:${port}/game`} />
          <KeyValue k="语音引擎" v="Web Speech · zh-CN" />
        </div>
      </CardContent>
      <DiagnosticPanel
        isOpen={showDiagnostic}
        currentPort={port}
        status={snapshot.status}
        onClose={closeDiagnostic}
        onOpenSettings={() => {
          closeDiagnostic();
          navigate("/settings");
        }}
        onRetry={onRetry}
      />
    </Card>
  );
}

/** A single race tile (mockup `.race`); `me` flips to the accent color. */
function RaceTile({ letter, me }: { letter: string; me?: boolean }) {
  return (
    <div
      className={cn(
        "grid size-[46px] place-items-center rounded-lg border font-mono text-[20px] font-bold",
        me ? "border-primary bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      {letter}
    </div>
  );
}

/** Race letter for display from the SC2 short race code. */
function raceTileLetter(player: PlayerInfo | undefined): string {
  if (!player) return "—";
  const letter = raceCodeToLetter(player.race);
  return letter === "X" ? "?" : letter;
}

/** The current-match card: players, matchup, the interpolated clock + status. */
function MatchCard({ snapshot }: { snapshot: GameSnapshot }) {
  const clock = useInterpolatedClock(snapshot);
  const detected = snapshot.in_game ? identifyMatchup(snapshot.players) : null;

  if (!detected) {
    return (
      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardEyebrow>当前对局</CardEyebrow>
        </CardHeader>
        <CardContent className="px-5 text-sm text-muted-foreground">
          {snapshot.connected ? "等待对局开始…" : "未连接 SC2 Client API。"}
        </CardContent>
      </Card>
    );
  }

  const me = snapshot.players.find((p) => p.id === detected.meId);
  const opponent = snapshot.players.find((p) => p.id !== detected.meId);
  const matchup = `${detected.myRace}v${detected.oppRace}`;
  const live = snapshot.in_game && !snapshot.is_replay;

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardEyebrow>当前对局</CardEyebrow>
      </CardHeader>
      <CardContent className="px-5">
        <div className="flex items-center gap-4">
          <RaceTile letter={raceTileLetter(me)} me />
          <span className="font-mono text-sm text-muted-foreground">vs</span>
          <RaceTile letter={raceTileLetter(opponent)} />
          <div className="ml-auto text-right text-[13px] text-muted-foreground">
            <div>
              <b className="block font-mono text-[15px] text-foreground">
                {me?.name ?? "—"}
              </b>
              我（自动识别）
            </div>
            <div className="mt-1.5">
              <b className="block font-mono text-[15px] text-foreground">
                {opponent?.name ?? "—"}
              </b>
              对手
            </div>
          </div>
        </div>
        <div className="mt-4">
          <KeyValue k="对阵" v={matchup} />
          <KeyValue k="游戏时钟" v={formatGameTime(clock)} />
          <KeyValue
            k="状态"
            v={live ? "进行中" : snapshot.is_replay ? "回放中" : "待机"}
            accent={live}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Resolve which stored build is auto-selected for the current snapshot. */
function autoSelectedFilename(
  stored: StoredBuild[],
  snapshot: GameSnapshot,
): string | null {
  if (stored.length === 0) return null;
  const detected = snapshot.in_game ? identifyMatchup(snapshot.players) : null;
  const builds = stored.map((s) => s.build);
  const selected = detected
    ? selectBuild(builds, detected.myRace, detected.oppRace)
    : builds[0];
  if (!selected) return null;
  const match = stored.find((s) => s.build === selected);
  return match ? match.filename : null;
}

/**
 * Narrow the stored builds to those relevant to the detected matchup.
 *
 * With no detected matchup, returns the full list. Otherwise keeps builds that
 * match the matchup (plus the currently active build so the selection never
 * disappears), and falls back to the full list when nothing matches so the user
 * is never left with an empty picker.
 */
function computeVisibleStored(
  stored: StoredBuild[],
  detected: DetectedMatchup | null,
  activeFilename: string | null,
): StoredBuild[] {
  if (!detected) return stored;

  const filtered = stored.filter(
    (s) =>
      matchupMatches(s.build.matchup, detected.myRace, detected.oppRace) ||
      s.filename === activeFilename,
  );

  return filtered.length === 0 ? stored : filtered;
}

/** The build-list card with manual override (Q2). */
function BuildSelectCard({
  stored,
  autoFilename,
  override,
  onPick,
  onAuto,
}: {
  stored: StoredBuild[];
  autoFilename: string | null;
  override: string | null;
  onPick: (filename: string) => void;
  onAuto: () => void;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col gap-4 py-5">
      <CardHeader className="flex-row items-center justify-between px-5">
        <CardEyebrow>流程 · 自动匹配</CardEyebrow>
        {override !== null && (
          <Button type="button" variant="ghost" size="xs" onClick={onAuto}>
            恢复自动
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-5">
        {stored.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚未加载任何流程。</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {stored.map((s) => {
              const active =
                override !== null
                  ? s.filename === override
                  : s.filename === autoFilename;
              const isAuto = override === null && s.filename === autoFilename;
              const label = s.build.name?.trim()
                ? s.build.name
                : s.filename.replace(/\.json$/i, "");
              return (
                <button
                  key={s.filename}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPick(s.filename)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground",
                    active &&
                      "border-primary shadow-[inset_0_0_0_1px_var(--primary)]",
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono font-semibold">
                      {s.build.matchup}
                    </span>{" "}
                    · {label}
                  </span>
                  {isAuto ? (
                    <span className="shrink-0 font-mono text-[11px] text-success">
                      ● 自动选中
                    </span>
                  ) : (
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {s.build.steps.length} 步
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          精确匹配优先，<span className="font-mono">vX</span>{" "}
          作为任意对手的兜底。手动选择会覆盖自动匹配并同步到悬浮窗。
        </p>
      </CardContent>
    </Card>
  );
}

/** The upcoming-steps preview card for the active build. */
function StepsPreviewCard({
  stored,
  activeFilename,
  clock,
}: {
  stored: StoredBuild[];
  activeFilename: string | null;
  clock: number;
}) {
  const active =
    stored.find((s) => s.filename === activeFilename)?.build ?? null;

  return (
    <Card className="flex h-full min-h-0 flex-col gap-4 py-5">
      <CardHeader className="px-5">
        <CardEyebrow>步骤预览 · 接下来</CardEyebrow>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-5">
        {!active || active.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">没有可预览的步骤。</p>
        ) : (
          <PreviewSteps build={active} clock={clock} />
        )}
      </CardContent>
    </Card>
  );
}

/** Render the full build order with the next-step highlight and auto-scroll. */
function PreviewSteps({
  build,
  clock,
}: {
  build: StoredBuild["build"];
  clock: number;
}) {
  // Mark every step whose trigger time already passed as "spoken" so the
  // preview tracks the live clock, mirroring the overlay's selection logic.
  // At clock <= 0 (not started) nothing is pre-marked, so the preview starts
  // from the very first step.
  const spoken = previewSpokenSet(build, clock);
  const nextIdx = build.steps.findIndex((_, i) => !spoken.has(i));
  const nextRef = useRef<HTMLDivElement | null>(null);

  // Keep the current position visible as the clock advances.
  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: "nearest" });
  }, [nextIdx, clock]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-1 pr-2">
      {build.steps.map((step, idx) => {
        const next = idx === nextIdx;
        const afterNext = idx === nextIdx + 1;
        const isSpoken = spoken.has(idx);
        return (
          <div
            key={idx}
            ref={next ? nextRef : null}
            className={cn(
              "grid grid-cols-[54px_1fr_auto] items-center gap-3 rounded-lg border-t px-2 py-2.5 text-sm first:border-t-0",
              next && "border-t-0 bg-primary/5",
              afterNext && "border-t-0",
            )}
          >
            <span
              className={cn(
                "font-mono text-[13px] tabular-nums",
                next
                  ? "font-semibold text-primary"
                  : isSpoken
                    ? "text-muted-foreground/60"
                    : "text-muted-foreground",
              )}
            >
              {formatGameTime(step.time)}
            </span>
            <span
              className={cn(
                "min-w-0 truncate font-medium",
                isSpoken && !next && "text-muted-foreground",
              )}
            >
              {step.say}
            </span>
            <span
              className={cn(
                "font-mono text-[11px]",
                next
                  ? "text-primary"
                  : isSpoken
                    ? "text-muted-foreground/60"
                    : "text-muted-foreground",
              )}
            >
              {next
                ? "下一步"
                : isSpoken
                  ? "已播报"
                  : `+${Math.round(step.time - clock)}s`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The dashboard page: real connection / match / build-selection / step-preview
 * cards fed by the live snapshot and loaded builds, plus the overlay launch
 * toggle. Manual build override (Q2) is persisted via `activeBuildOverride`,
 * which the overlay picks up live through `SETTINGS_CHANGED`.
 */
function Dashboard() {
  const { snapshot, refetch } = useGameSnapshot();
  const clock = useInterpolatedClock(snapshot);
  const { stored } = useBuildOrders();
  const { settings, saveSettings } = useSettings();
  const [overlayShown, setOverlayShown] = useState(false);

  const autoFilename = autoSelectedFilename(stored, snapshot);
  const override = settings.activeBuildOverride;
  const activeFilename = override ?? autoFilename;

  // Narrow the build list to the current matchup so the picker shows only the
  // builds relevant to this game. Falls back to the full list when no matchup is
  // detected or nothing matches, and always keeps the active build visible.
  const detected = snapshot.in_game ? identifyMatchup(snapshot.players) : null;
  const visibleStored = computeVisibleStored(stored, detected, activeFilename);

  const pickBuild = (filename: string): void => {
    void saveSettings({ ...settings, activeBuildOverride: filename });
  };
  const clearOverride = (): void => {
    void saveSettings({ ...settings, activeBuildOverride: null });
  };

  const toggleOverlay = (): void => {
    const command = overlayShown ? "hide_overlay" : "open_overlay";
    void invoke(command).catch(() => {
      // Window op failed; leave the tracked state unchanged.
    });
    setOverlayShown((shown) => !shown);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">仪表盘</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            对局状态 · 流程已就绪
          </p>
        </div>
        <Button
          type="button"
          variant={overlayShown ? "secondary" : "default"}
          onClick={toggleOverlay}
        >
          {overlayShown ? <Square /> : <Play />}
          {overlayShown ? "隐藏悬浮窗" : "启动悬浮窗"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ConnectionCard
          snapshot={snapshot}
          port={settings.clientApiPort}
          onRetry={refetch}
        />
        <MatchCard snapshot={snapshot} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        <BuildSelectCard
          stored={visibleStored}
          autoFilename={autoFilename}
          override={override}
          onPick={pickBuild}
          onAuto={clearOverride}
        />
        <StepsPreviewCard
          stored={stored}
          activeFilename={activeFilename}
          clock={clock}
        />
      </div>
    </div>
  );
}

export default Dashboard;
