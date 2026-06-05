import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  DISCONNECTED_SNAPSHOT,
  GAME_EVENT,
  type GameSnapshot,
} from "../types/sc2";

/**
 * Subscribes to the Rust poll loop and returns the latest game snapshot.
 * Unsubscribes on unmount (StrictMode-safe).
 */
export function useGameSnapshot(): GameSnapshot {
  const [snapshot, setSnapshot] = useState<GameSnapshot>(
    DISCONNECTED_SNAPSHOT,
  );

  useEffect(() => {
    const unlistenPromise = listen<GameSnapshot>(GAME_EVENT, (event) => {
      setSnapshot(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return snapshot;
}
