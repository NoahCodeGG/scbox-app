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

/// Snapshot pushed to the frontend on every poll tick.
///
/// `connected` = SC2 client API reachable. `in_game` = a real game (not the
/// empty between-games state) is active.
#[derive(Debug, Clone, Serialize)]
pub struct GameSnapshot {
    pub connected: bool,
    pub in_game: bool,
    pub is_replay: bool,
    pub display_time: f64,
    pub players: Vec<PlayerInfo>,
}

impl GameSnapshot {
    fn disconnected() -> Self {
        Self {
            connected: false,
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
/// (SC2 closed) maps to a disconnected snapshot rather than an error, so the
/// poll loop can keep running quietly.
pub async fn fetch_snapshot(client: &reqwest::Client, port: u16) -> GameSnapshot {
    match client.get(game_url(port)).send().await {
        Ok(resp) => match resp.json::<RawGame>().await {
            Ok(raw) => GameSnapshot::from_raw(raw),
            // Reachable but unparseable (e.g. not in a game yet) -> connected, idle.
            Err(_) => GameSnapshot {
                connected: true,
                in_game: false,
                is_replay: false,
                display_time: 0.0,
                players: Vec::new(),
            },
        },
        Err(_) => GameSnapshot::disconnected(),
    }
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
}

