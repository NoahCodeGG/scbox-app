import {
  HashRouter,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";
import { LayoutGrid, LogOut, Pencil, Settings as SettingsIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppVersion } from "../hooks/useAppVersion";
import { useSettings } from "../hooks/useSettings";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import BuildEditor from "./BuildEditor";
import Dashboard from "./Dashboard";
import SettingsPanel from "./SettingsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

/** The build-order editor rendered as a routed page (was a separate window). */
function EditorPage() {
  return <BuildEditor />;
}

/**
 * Settings rendered as a routed page. Lifts the update-check state here. As a
 * page there is no close affordance, so `SettingsPanel`'s `onClose` is omitted.
 */
function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const update = useUpdateCheck();

  return (
    <div className="mx-auto max-w-2xl">
      <SettingsPanel
        settings={settings}
        onSave={saveSettings}
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
      <div className="grid h-screen grid-cols-[208px_1fr] bg-secondary">
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
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground hover:text-foreground"
            onClick={() => {
              void invoke("exit_app").catch((e: unknown) => {
                console.error("Failed to exit app:", e);
              });
            }}
          >
            <LogOut />
            退出
          </Button>
          <span className="font-mono text-[11px] text-muted-foreground">
            SCBox Assistant{version ? ` v${version}` : ""}
          </span>
        </nav>

        <main className="overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default MainWindow;
