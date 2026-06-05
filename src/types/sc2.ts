// Mirrors the Rust `sc2::GameSnapshot` / `PlayerInfo` payloads emitted on the
// `sc2://game` event. Keep field names in sync with src-tauri/src/sc2.rs.

export const GAME_EVENT = "sc2://game";

export interface PlayerInfo {
  id: number;
  name: string;
  /** "user" | "computer" */
  type: string;
  /** "Terr" | "Prot" | "Zerg" | "random" | ... */
  race: string;
  /** "Undecided" | "Victory" | "Defeat" | "Tie" */
  result: string;
}

export interface GameSnapshot {
  connected: boolean;
  in_game: boolean;
  is_replay: boolean;
  display_time: number;
  players: PlayerInfo[];
}

export const DISCONNECTED_SNAPSHOT: GameSnapshot = {
  connected: false,
  in_game: false,
  is_replay: false,
  display_time: 0,
  players: [],
};
