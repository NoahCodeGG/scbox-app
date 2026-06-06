import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import BuildEditor from "./components/BuildEditor";

// Both the overlay and the editor load the same bundle; render by window label.
const isEditor = getCurrentWindow().label === "editor";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  isEditor ? <BuildEditor /> : <App />,
);
