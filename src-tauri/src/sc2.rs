use serde::{Deserialize, Serialize};

/// One player entry as returned by the SC2 Client API `/game` endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub id: u32,
    pub name: String,
    /// "user" or "computer"
    #[serde(rename = "type")]
    pub player_type: String,
    /// "Terr", "Prot", "Zerg", "random", ...
    pub race: String,
    /// "Undecided", "Victory", "Defeat", "Tie"
    pub result: String,
}

/// Raw shape of `GET http://localhost:6119/game`.
#[derive(Debug, Clone, Deserialize)]
struct RawGame {
    #[serde(rename = "isReplay")]
    is_replay: bool,
    #[serde(rename = "displayTime")]
    display_time: f64,
    players: Vec<PlayerInfo>,
}

/// Why the SC2 Client API poll is (or is not) connected. Serializes to exactly
/// `"ok" | "unreachable" | "timeout" | "bad_http" | "bad_body"` (snake_case), so
/// it mirrors the `ConnectionStatus` TS union in `src/types/sc2.ts`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionStatus {
    /// Reachable, 2xx, body parsed — a real (possibly idle) game state.
    Ok,
    /// Connection error that is not a timeout (SC2 not running, port closed).
    Unreachable,
    /// Request exceeded the client timeout (stalled socket).
    Timeout,
    /// Reachable but returned a non-2xx status (likely a foreign service).
    BadHttp,
    /// 2xx but the body did not parse as the SC2 `/game` shape.
    BadBody,
}

/// Snapshot pushed to the frontend on every poll tick.
///
/// `connected` = SC2 client API reachable AND returned a usable body
/// (`status == Ok`). `in_game` = a real game (not the empty between-games
/// state) is active. `status` carries the disconnect reason for diagnostics.
#[derive(Debug, Clone, Serialize)]
pub struct GameSnapshot {
    pub connected: bool,
    pub status: ConnectionStatus,
    pub in_game: bool,
    pub is_replay: bool,
    pub display_time: f64,
    pub players: Vec<PlayerInfo>,
}

impl GameSnapshot {
    /// A reachable-but-unusable or unreachable snapshot. `connected` is always
    /// false here so the invariant `connected == (status == Ok)` holds.
    fn not_ok(status: ConnectionStatus) -> Self {
        debug_assert!(status != ConnectionStatus::Ok);
        Self {
            connected: false,
            status,
            in_game: false,
            is_replay: false,
            display_time: 0.0,
            players: Vec::new(),
        }
    }

    fn from_raw(raw: RawGame) -> Self {
        let in_game = !raw.players.is_empty();
        Self {
            connected: true,
            status: ConnectionStatus::Ok,
            in_game,
            is_replay: raw.is_replay,
            display_time: raw.display_time,
            players: raw.players,
        }
    }
}

/// Tauri event name for game snapshots.
pub const GAME_EVENT: &str = "sc2://game";

/// Build the SC2 Client API `/game` endpoint URL for the given port. The host
/// is fixed to localhost; only the port is user-configurable (some users launch
/// SC2 with `-clientapi <port>`).
fn game_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/game")
}

/// Fetch one snapshot from the SC2 Client API on `port`. A connection error
/// (SC2 closed, timeout), a non-2xx status, or an unparseable body each map to a
/// disconnected snapshot with a specific `status`, so the poll loop keeps
/// running quietly and the diagnostic can explain *why*.
pub async fn fetch_snapshot(client: &reqwest::Client, port: u16) -> GameSnapshot {
    match client.get(game_url(port)).send().await {
        Err(e) => {
            let status = if e.is_timeout() {
                ConnectionStatus::Timeout
            } else {
                ConnectionStatus::Unreachable
            };
            GameSnapshot::not_ok(status)
        }
        Ok(resp) => {
            if !resp.status().is_success() {
                return GameSnapshot::not_ok(ConnectionStatus::BadHttp);
            }
            match resp.json::<RawGame>().await {
                Ok(raw) => GameSnapshot::from_raw(raw),
                // 2xx but the body is not the SC2 `/game` shape (foreign service
                // on the port). This is NOT the legitimate idle state — a real
                // idle SC2 returns valid JSON with empty players.
                Err(_) => GameSnapshot::not_ok(ConnectionStatus::BadBody),
            }
        }
    }
}

/// Base poll cadence while connected, in milliseconds.
pub const BASE_POLL_INTERVAL_MS: u64 = 1000;

/// Maximum poll interval while disconnected, in milliseconds.
pub const MAX_POLL_INTERVAL_MS: u64 = 5000;

/// Pure backoff curve for the poll loop. While `connected`, poll at the base
/// cadence (1000ms). While disconnected, double the current interval (capped at
/// 5000ms): the first disconnected step from 1000 goes 1000→2000→4000→5000→5000.
/// A current value below the base is treated as the base so the first doubling
/// lands on 2000ms.
pub fn next_poll_interval_ms(current_ms: u64, connected: bool) -> u64 {
    if connected {
        return BASE_POLL_INTERVAL_MS;
    }
    let base = current_ms.max(BASE_POLL_INTERVAL_MS);
    base.saturating_mul(2).min(MAX_POLL_INTERVAL_MS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_players_is_idle_not_in_game() {
        let raw: RawGame =
            serde_json::from_str(r#"{"isReplay":false,"displayTime":0.0,"players":[]}"#)
                .unwrap();
        let snap = GameSnapshot::from_raw(raw);
        assert!(snap.connected);
        assert!(!snap.in_game);
    }

    #[test]
    fn populated_players_is_in_game_with_fields() {
        let json = r#"{"isReplay":false,"displayTime":100.0,"players":[
            {"id":1,"name":"me","type":"user","race":"Terr","result":"Undecided"},
            {"id":2,"name":"foe","type":"user","race":"Prot","result":"Undecided"}
        ]}"#;
        let raw: RawGame = serde_json::from_str(json).unwrap();
        let snap = GameSnapshot::from_raw(raw);
        assert!(snap.in_game);
        assert_eq!(snap.display_time, 100.0);
        assert_eq!(snap.players.len(), 2);
        assert_eq!(snap.players[0].race, "Terr");
        assert_eq!(snap.players[1].player_type, "user");
    }

    #[test]
    fn replay_flag_is_carried_through() {
        let json = r#"{"isReplay":true,"displayTime":50.0,"players":[
            {"id":1,"name":"a","type":"user","race":"Zerg","result":"Undecided"}
        ]}"#;
        let raw: RawGame = serde_json::from_str(json).unwrap();
        let snap = GameSnapshot::from_raw(raw);
        assert!(snap.is_replay);
        assert!(snap.in_game);
    }

    #[test]
    fn game_url_uses_the_given_port() {
        assert_eq!(game_url(6119), "http://127.0.0.1:6119/game");
        assert_eq!(game_url(5000), "http://127.0.0.1:5000/game");
    }

    #[test]
    fn connection_status_serializes_to_snake_case() {
        let cases = [
            (ConnectionStatus::Ok, "\"ok\""),
            (ConnectionStatus::Unreachable, "\"unreachable\""),
            (ConnectionStatus::Timeout, "\"timeout\""),
            (ConnectionStatus::BadHttp, "\"bad_http\""),
            (ConnectionStatus::BadBody, "\"bad_body\""),
        ];
        for (status, expected) in cases {
            assert_eq!(serde_json::to_string(&status).unwrap(), expected);
        }
    }

    #[test]
    fn from_raw_is_ok_and_connected() {
        let raw: RawGame =
            serde_json::from_str(r#"{"isReplay":false,"displayTime":0.0,"players":[]}"#)
                .unwrap();
        let snap = GameSnapshot::from_raw(raw);
        assert_eq!(snap.status, ConnectionStatus::Ok);
        assert!(snap.connected);
    }

    #[test]
    fn not_ok_constructors_are_disconnected_with_status() {
        for status in [
            ConnectionStatus::Unreachable,
            ConnectionStatus::Timeout,
            ConnectionStatus::BadHttp,
            ConnectionStatus::BadBody,
        ] {
            let snap = GameSnapshot::not_ok(status);
            assert_eq!(snap.status, status);
            assert!(!snap.connected);
            assert!(!snap.in_game);
        }
        assert_eq!(
            GameSnapshot::not_ok(ConnectionStatus::Unreachable).status,
            ConnectionStatus::Unreachable
        );
    }

    #[test]
    fn connected_matches_status_ok_invariant() {
        let ok: RawGame =
            serde_json::from_str(r#"{"isReplay":false,"displayTime":0.0,"players":[]}"#)
                .unwrap();
        let ok = GameSnapshot::from_raw(ok);
        assert_eq!(ok.connected, ok.status == ConnectionStatus::Ok);
        for status in [
            ConnectionStatus::Unreachable,
            ConnectionStatus::Timeout,
            ConnectionStatus::BadHttp,
            ConnectionStatus::BadBody,
        ] {
            let snap = GameSnapshot::not_ok(status);
            assert_eq!(snap.connected, snap.status == ConnectionStatus::Ok);
        }
    }

    #[test]
    fn backoff_resets_to_base_when_connected() {
        assert_eq!(next_poll_interval_ms(5000, true), 1000);
        assert_eq!(next_poll_interval_ms(1000, true), 1000);
    }

    #[test]
    fn backoff_doubles_and_caps_while_disconnected() {
        assert_eq!(next_poll_interval_ms(1000, false), 2000);
        assert_eq!(next_poll_interval_ms(2000, false), 4000);
        assert_eq!(next_poll_interval_ms(4000, false), 5000);
        assert_eq!(next_poll_interval_ms(5000, false), 5000);
    }

    #[test]
    fn backoff_treats_sub_base_current_as_base() {
        assert_eq!(next_poll_interval_ms(0, false), 2000);
        assert_eq!(next_poll_interval_ms(500, false), 2000);
    }
}

