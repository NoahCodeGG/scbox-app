import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  DISCONNECTED_SNAPSHOT,
  GAME_EVENT,
  type GameSnapshot,
} from "../types/sc2";

/**
 * State returned by `useGameSnapshot`, including the current snapshot and a
 * cosmetic refetch function (the Rust poll loop runs continuously at 1s
 * intervals, so this just returns the current snapshot immediately).
 */
export interface GameSnapshotState {
  snapshot: GameSnapshot;
  /**
   * Cosmetic "refetch" that returns the current snapshot. The actual polling
   * happens in Rust every 1s, so this is best-effort for UI feedback only.
   */
  refetch: () => GameSnapshot;
}

/**
 * Subscribes to the Rust poll loop and returns the latest game snapshot.
 * Unsubscribes on unmount (StrictMode-safe). The `refetch` function is cosmetic
 * since the Rust backend continuously polls every 1s.
 */
export function useGameSnapshot(): GameSnapshotState {
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

  const refetch = (): GameSnapshot => {
    // The Rust poll loop runs every 1s in the background, so we just return
    // the current snapshot. This is cosmetic for the "重试连接" button.
    return snapshot;
  };

  return { snapshot, refetch };
}
