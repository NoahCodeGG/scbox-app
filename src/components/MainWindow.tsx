import { useEffect } from "react";
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { LayoutGrid, Pencil, Settings as SettingsIcon } from "lucide-react";
import { useAppIcon } from "../hooks/useAppIcon";
import { useAppName } from "../hooks/useAppName";
import { useAppVersion } from "../hooks/useAppVersion";
import { useApplyTheme } from "../hooks/useApplyTheme";
import { useSettings } from "../hooks/useSettings";
import { useUpdateCheck } from "../hooks/useUpdateCheck";
import { useUpdateToast } from "../hooks/useUpdateToast";
import {
  NAVIGATE_EDITOR_EVENT,
  SETTINGS_CHANGED_EVENT,
  type NavigateEditorPayload,
} from "../lib/events";
import { setPendingEditorNav } from "../lib/pendingEditorNav";
import BuildEditor from "./BuildEditor";
import Dashboard from "./Dashboard";
import SettingsPanel from "./SettingsPanel";
import { Toaster } from "@/components/ui/sonner";
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
 * Listens (inside the router, so it can call `useNavigate`) for the overlay's
 * NAVIGATE_EDITOR_EVENT. On receipt it stashes the target build filename for the
 * editor to consume on mount, then navigates to /editor. Renders nothing.
 */
function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    const unlisten = listen<NavigateEditorPayload>(
      NAVIGATE_EDITOR_EVENT,
      (event) => {
        setPendingEditorNav(event.payload?.filename ?? "");
        navigate("/editor");
      },
    );
    return () => {
      void unlisten.then((off) => off());
    };
  }, [navigate]);
  return null;
}

/**
 * Settings rendered as a routed page. Lifts the update-check state here. As a
 * page there is no close affordance, so `SettingsPanel`'s `onClose` is omitted.
 */
function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const update = useUpdateCheck(settings.prereleaseUpdates);

  return (
    <div className="flex h-full flex-col">
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
  const name = useAppName();
  const icon = useAppIcon();
  const { settings, reload } = useSettings();

  // Apply the global theme to this window's document. The Settings page uses a
  // separate useSettings instance, so reload here when it saves (the
  // SETTINGS_CHANGED event) to re-apply the theme in the shell live.
  useApplyTheme(settings.theme);

  // Resident startup update check: detect a new version even when the user
  // never opens the routed Settings page, and prompt once with a Sonner toast.
  // The Settings page keeps its own useUpdateCheck for the inline status text.
  useUpdateToast(settings.prereleaseUpdates);

  useEffect(() => {
    const unlisten = listen(SETTINGS_CHANGED_EVENT, () => {
      void reload();
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, [reload]);

  return (
    <HashRouter>
      <NavigationBridge />
      <div className="relative grid h-screen grid-cols-[208px_1fr] bg-secondary">
        {/*
          Overlay titlebar (macOS): the window content draws under the
          transparent native titlebar, with traffic lights floating top-left.
          This empty, non-interactive strip spans both columns at the very top
          so the window stays draggable; it must have no interactive children
          (clicks must reach the nav below).
        */}
        <div
          data-tauri-drag-region
          className="pointer-events-auto absolute inset-x-0 top-0 z-10 h-7 select-none"
        />
        <nav className="flex flex-col gap-2 border-r bg-card p-5 pt-7">
          <div className="mb-4 flex items-center gap-2.5">
            <img src={icon ?? undefined} alt="" className="size-[30px] rounded-lg" />
            <b className="text-base font-semibold">{name ?? ""}</b>
          </div>
          <SidebarLink to="/" icon={<LayoutGrid />} label="仪表盘" />
          <SidebarLink to="/editor" icon={<Pencil />} label="流程" />
          <SidebarLink to="/settings" icon={<SettingsIcon />} label="设置" />
          <div className="flex-1" />
          <span className="font-mono text-[11px] text-muted-foreground">
            {version ? `v${version}` : null}
          </span>
        </nav>

        <main className="overflow-auto p-8 pt-7">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <Toaster theme={settings.theme} />
    </HashRouter>
  );
}

export default MainWindow;
