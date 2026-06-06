import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
// Tailwind base + design-system theme tokens. Imported first so per-component
// CSS (e.g. App.css) still overrides it until each surface is re-skinned.
import "./index.css";
// Self-hosted fonts (no runtime CDN — packaged app must not depend on network).
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import "@fontsource/fira-code/600.css";
import App from "./App";
import BuildEditor from "./components/BuildEditor";

// Both the overlay and the editor load the same bundle; render by window label.
const isEditor = getCurrentWindow().label === "editor";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  isEditor ? <BuildEditor /> : <App />,
);
