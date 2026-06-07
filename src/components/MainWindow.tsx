import { invoke } from "@tauri-apps/api/core";
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";
import { LayoutGrid, Pencil, Play, Settings as SettingsIcon } from "lucide-react";
import { useAppVersion } from "../hooks/useAppVersion";
import { useSettings } from "../hooks/useSettings";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import BuildEditor from "./BuildEditor";
import SettingsPanel from "./SettingsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Launch (show + focus) the floating overlay window from the dashboard. */
function launchOverlay(): void {
  void invoke("open_overlay").catch(() => {
    // Overlay window failed to open; nothing actionable here.
  });
}

/** Sidebar nav link with active-state styling, mirroring the dashboard mockup. */
function SidebarLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          "[&_svg]:size-[17px]",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

/**
 * Placeholder dashboard page for PR1. The full connection/match/build/preview
 * cards land in PR2; this keeps the launch entry point functional now.
 */
function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">仪表盘</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            对局状态 · build order 已就绪
          </p>
        </div>
        <Button type="button" onClick={launchOverlay}>
          <Play />
          启动悬浮窗
        </Button>
      </div>
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        仪表盘卡片即将上线。当前可从右上角启动悬浮窗开始播报。
      </div>
    </div>
  );
}

/** The build-order editor rendered as a routed page (was a separate window). */
function EditorPage() {
  return <BuildEditor />;
}

/**
 * Settings rendered as a routed page. Lifts the update-check state here and
 * passes a no-op `onClose` (a page does not close) so the existing
 * `SettingsPanel` contract is preserved without behavior changes.
 */
function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const update = useUpdateCheck();

  return (
    <div className="mx-auto max-w-2xl">
      <SettingsPanel
        settings={settings}
        onSave={saveSettings}
        onClose={() => {
          // A settings page has no close affordance; saving stays in place.
        }}
        onCheckUpdate={update.check}
        updateBusy={update.busy}
        updateAvailable={update.available}
        updateVersion={update.version}
        updateUpToDate={update.upToDate}
        updateError={update.error}
      />
    </div>
  );
}

/**
 * The main desktop window: a normal OS window hosting the dashboard shell —
 * a left sidebar nav routing (HashRouter, no server in Tauri) between the
 * Dashboard, Build Order editor, and Settings pages.
 */
function MainWindow() {
  const version = useAppVersion();

  return (
    <HashRouter>
      <div className="grid h-screen grid-cols-[208px_1fr] bg-secondary/40">
        <nav className="flex flex-col gap-2 border-r bg-card p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-[30px] place-items-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">
              SC
            </span>
            <b className="text-base font-semibold">scbox</b>
          </div>
          <SidebarLink to="/" icon={<LayoutGrid />} label="仪表盘" />
          <SidebarLink to="/editor" icon={<Pencil />} label="Build Order" />
          <SidebarLink to="/settings" icon={<SettingsIcon />} label="设置" />
          <div className="flex-1" />
          <span className="font-mono text-[11px] text-muted-foreground">
            SCBox Assistant{version ? ` v${version}` : ""}
          </span>
        </nav>

        <main className="overflow-auto p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default MainWindow;
