use crate::{market::ChartRange, window::MonitorPreference};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Instrument {
    pub symbol: String,
    pub label: String,
    #[serde(rename = "type")]
    pub kind: String,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub instruments: Vec<Instrument>,
    pub range: ChartRange,
    pub target_monitor: Option<MonitorPreference>,
    pub launch_at_login: bool,
    pub fullscreen: bool,
    pub quote_refresh_seconds: u64,
}
impl Default for AppSettings {
    fn default() -> Self {
        Self {
            instruments: [
                ("BTC-USD", "BTC", "crypto"),
                ("ETH-USD", "ETH", "crypto"),
                ("SOL-USD", "SOL", "crypto"),
                ("XRP-USD", "XRP", "crypto"),
                ("DOGE-USD", "DOGE", "crypto"),
                ("KRW=X", "USD/KRW", "stock"),
                ("^IXIC", "NASDAQ", "stock"),
                ("^GSPC", "S&P500", "stock"),
                ("QQQ", "QQQ", "stock"),
                ("ORCL", "ORCL", "stock"),
                ("LHX", "LHX", "stock"),
            ]
            .into_iter()
            .map(|(symbol, label, kind)| Instrument {
                symbol: symbol.into(),
                label: label.into(),
                kind: kind.into(),
            })
            .collect(),
            range: ChartRange::OneDay,
            target_monitor: None,
            launch_at_login: false,
            fullscreen: false,
            quote_refresh_seconds: 5,
        }
    }
}
impl AppSettings {
    fn sanitize(mut self) -> Self {
        let defaults = Self::default();
        if self.instruments.is_empty()
            || self.instruments.len() != 11
            || self.instruments.iter().any(|item| {
                item.symbol.trim().is_empty()
                    || item.label.trim().is_empty()
                    || !matches!(item.kind.as_str(), "crypto" | "stock")
            })
        {
            self.instruments = defaults.instruments;
        }
        if !matches!(self.quote_refresh_seconds, 5 | 10 | 30) {
            self.quote_refresh_seconds = defaults.quote_refresh_seconds;
        }
        self
    }
}
fn path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|error| error.to_string())
}
pub fn load(app: &AppHandle) -> Result<AppSettings, String> {
    load_path(&path(app)?)
}
pub fn save(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    save_path(&path(app)?, settings)
}
fn load_path(path: &Path) -> Result<AppSettings, String> {
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(serde_json::from_str::<AppSettings>(&contents)
        .unwrap_or_default()
        .sanitize())
}
fn save_path(path: &Path, settings: &AppSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temp = path.with_extension("json.tmp");
    fs::write(
        &temp,
        serde_json::to_vec_pretty(settings).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    fs::rename(temp, path).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn settings_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("settings.json");
        let settings = AppSettings {
            range: ChartRange::OneMonth,
            launch_at_login: true,
            ..AppSettings::default()
        };
        save_path(&file, &settings).unwrap();
        assert_eq!(load_path(&file).unwrap(), settings);
    }
    #[test]
    fn missing_settings_use_safe_defaults() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            load_path(&dir.path().join("missing.json"))
                .unwrap()
                .instruments
                .len(),
            11
        );
    }
    #[test]
    fn malformed_or_unsafe_settings_use_safe_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("settings.json");
        fs::write(&file, "not-json").unwrap();
        assert_eq!(load_path(&file).unwrap(), AppSettings::default());
        let mut settings = AppSettings::default();
        settings.instruments.clear();
        settings.quote_refresh_seconds = 1;
        save_path(&file, &settings).unwrap();
        let loaded = load_path(&file).unwrap();
        assert_eq!(loaded.instruments.len(), 11);
        assert_eq!(loaded.quote_refresh_seconds, 5);
    }
}
