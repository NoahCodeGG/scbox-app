import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
// Tailwind base + design-system theme tokens.
import "./index.css";
// Self-hosted fonts (no runtime CDN — packaged app must not depend on network).
// Inter (variable, sans) is imported in index.css; Fira Code (mono) here.
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import "@fontsource/fira-code/600.css";
import App from "./App";
import MainWindow from "./components/MainWindow";

// Both the main dashboard shell and the floating overlay load the same bundle;
// render by window label. The overlay window renders the always-on-top coaching
// UI (App); every other window (the "main" dashboard) renders MainWindow.
const isOverlay = getCurrentWindow().label === "overlay";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  isOverlay ? <App /> : <MainWindow />,
);
