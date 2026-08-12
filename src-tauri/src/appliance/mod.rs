use crate::{
    market::{hybrid::HybridMarketProvider, MarketService},
    settings,
};
use chrono::{Local, Timelike};
use serde::Serialize;
#[cfg(target_os = "linux")]
use std::process::Command;
use std::{env, sync::RwLock, time::Duration};
use tauri::{AppHandle, Emitter, Manager};

const STATUS_EVENT: &str = "appliance-status";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
#[serde(rename_all = "lowercase")]
pub enum DisplayPower {
    Unmanaged,
    Prewarming,
    On,
    Off,
    Unsupported,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplianceStatus {
    pub enabled: bool,
    pub display_active: bool,
    pub display_power: DisplayPower,
    pub next_transition: Option<String>,
    pub detail: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ApplianceConfig {
    enabled: bool,
    on_minute: u16,
    off_minute: u16,
    on_label: String,
    off_label: String,
    warning: Option<String>,
}

impl ApplianceConfig {
    pub fn from_env() -> Self {
        let enabled = env::var("TICKERDECK_APPLIANCE_MODE")
            .is_ok_and(|value| matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "yes"));
        let (on_minute, on_label, on_warning) = parse_time_env("TICKERDECK_DISPLAY_ON", "07:00");
        let (off_minute, off_label, off_warning) =
            parse_time_env("TICKERDECK_DISPLAY_OFF", "00:00");
        let warnings = [on_warning, off_warning]
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();
        Self {
            enabled,
            on_minute,
            off_minute,
            on_label,
            off_label,
            warning: (!warnings.is_empty()).then(|| warnings.join("; ")),
        }
    }
    fn is_active(&self, minute: u16) -> bool {
        if self.on_minute == self.off_minute {
            return true;
        }
        if self.on_minute < self.off_minute {
            minute >= self.on_minute && minute < self.off_minute
        } else {
            minute >= self.on_minute || minute < self.off_minute
        }
    }
    fn next_transition(&self, active: bool) -> String {
        if active {
            self.off_label.clone()
        } else {
            self.on_label.clone()
        }
    }
}

fn parse_time_env(key: &str, fallback: &str) -> (u16, String, Option<String>) {
    match env::var(key) {
        Ok(value) => parse_clock(&value)
            .map(|(minute, label)| (minute, label, None))
            .unwrap_or_else(|| {
                let (minute, label) = parse_clock(fallback).expect("valid built-in schedule");
                (
                    minute,
                    label,
                    Some(format!("Invalid {key}={value}; using {fallback}")),
                )
            }),
        Err(_) => {
            let (minute, label) = parse_clock(fallback).expect("valid built-in schedule");
            (minute, label, None)
        }
    }
}

fn parse_clock(value: &str) -> Option<(u16, String)> {
    let (hour, minute) = value.split_once(':')?;
    let hour: u16 = hour.parse().ok()?;
    let minute: u16 = minute.parse().ok()?;
    if hour > 23 || minute > 59 {
        return None;
    }
    Some((hour * 60 + minute, format!("{hour:02}:{minute:02}")))
}

pub struct ApplianceRuntime {
    config: ApplianceConfig,
    status: RwLock<ApplianceStatus>,
}

impl ApplianceRuntime {
    pub fn new(config: ApplianceConfig) -> Self {
        let status = ApplianceStatus {
            enabled: config.enabled,
            display_active: !config.enabled,
            display_power: DisplayPower::Unmanaged,
            next_transition: config.enabled.then(|| config.on_label.clone()),
            detail: config.warning.clone(),
        };
        Self {
            config,
            status: RwLock::new(status),
        }
    }
    pub fn status(&self) -> ApplianceStatus {
        self.status
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }
    fn update(&self, status: ApplianceStatus) {
        *self
            .status
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = status;
    }
}

#[tauri::command]
pub fn get_appliance_status(runtime: tauri::State<'_, ApplianceRuntime>) -> ApplianceStatus {
    runtime.status()
}

pub fn start(app: AppHandle) {
    if !app.state::<ApplianceRuntime>().status().enabled {
        return;
    }
    tauri::async_runtime::spawn(async move {
        let mut previous = None;
        loop {
            let now = Local::now();
            let minute = (now.hour() * 60 + now.minute()) as u16;
            let active = app.state::<ApplianceRuntime>().config.is_active(minute);
            if previous != Some(active) {
                transition(&app, active).await;
                previous = Some(active);
            } else if app.state::<ApplianceRuntime>().status().display_power == DisplayPower::Error
            {
                retry_power(&app, active);
            }
            tokio::time::sleep(Duration::from_secs(30)).await;
        }
    });
}

async fn transition(app: &AppHandle, active: bool) {
    let runtime = app.state::<ApplianceRuntime>();
    let mut target_active = active;
    let mut next_transition = Some(runtime.config.next_transition(active));
    if active {
        let prewarming = ApplianceStatus {
            enabled: true,
            display_active: false,
            display_power: DisplayPower::Prewarming,
            next_transition: next_transition.clone(),
            detail: Some("Refreshing market data before display wake".into()),
        };
        runtime.update(prewarming.clone());
        let _ = app.emit(STATUS_EVENT, prewarming);
        prewarm_market_data(app).await;
        let now = Local::now();
        target_active = runtime
            .config
            .is_active((now.hour() * 60 + now.minute()) as u16);
        next_transition = Some(runtime.config.next_transition(target_active));
    }
    let (display_power, detail) = set_display_power(target_active);
    let detail = detail.or_else(|| runtime.config.warning.clone());
    let status = ApplianceStatus {
        enabled: true,
        display_active: target_active,
        display_power,
        next_transition,
        detail,
    };
    runtime.update(status.clone());
    let _ = app.emit(STATUS_EVENT, status);
}

fn retry_power(app: &AppHandle, active: bool) {
    let runtime = app.state::<ApplianceRuntime>();
    let (display_power, detail) = set_display_power(active);
    let detail = detail.or_else(|| runtime.config.warning.clone());
    let status = ApplianceStatus {
        enabled: true,
        display_active: active,
        display_power,
        next_transition: Some(runtime.config.next_transition(active)),
        detail,
    };
    runtime.update(status.clone());
    let _ = app.emit(STATUS_EVENT, status);
}

async fn prewarm_market_data(app: &AppHandle) {
    let settings = settings::load(app).unwrap_or_default();
    let symbols = settings
        .instruments
        .into_iter()
        .map(|item| item.symbol)
        .collect::<Vec<_>>();
    let range = settings.range;
    let service = app.state::<MarketService<HybridMarketProvider>>();
    let _ = service.quotes(symbols.clone()).await;
    let _ = service.charts(symbols, range).await;
}

fn set_display_power(on: bool) -> (DisplayPower, Option<String>) {
    #[cfg(target_os = "linux")]
    {
        let session_type = env::var("XDG_SESSION_TYPE").unwrap_or_default();
        if session_type.eq_ignore_ascii_case("wayland")
            || (session_type.is_empty() && env::var_os("WAYLAND_DISPLAY").is_some())
        {
            return (
                DisplayPower::Unsupported,
                Some("Wayland DPMS is compositor-specific; use an Ubuntu on Xorg session".into()),
            );
        }
        if env::var_os("DISPLAY").is_none() {
            return (
                DisplayPower::Unsupported,
                Some("DISPLAY is unavailable in the GUI user session".into()),
            );
        }
        let enable = Command::new("xset").arg("+dpms").status();
        if !enable.is_ok_and(|status| status.success()) {
            return (
                DisplayPower::Error,
                Some("xset could not enable DPMS".into()),
            );
        }
        match Command::new("xset")
            .args(["dpms", "force", if on { "on" } else { "off" }])
            .status()
        {
            Ok(status) if status.success() => match verify_display_power(on) {
                Ok(()) => (
                    if on {
                        DisplayPower::On
                    } else {
                        DisplayPower::Off
                    },
                    None,
                ),
                Err(error) => (DisplayPower::Error, Some(error)),
            },
            Ok(status) => (
                DisplayPower::Error,
                Some(format!("xset exited with {status}")),
            ),
            Err(error) => (
                DisplayPower::Error,
                Some(format!("xset unavailable: {error}")),
            ),
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = on;
        (
            DisplayPower::Unsupported,
            Some("Scheduled DPMS is available only on Linux X11".into()),
        )
    }
}

#[cfg(target_os = "linux")]
fn verify_display_power(on: bool) -> Result<(), String> {
    let output = Command::new("xset")
        .arg("q")
        .output()
        .map_err(|error| format!("xset query failed: {error}"))?;
    if !output.status.success() {
        return Err(format!("xset query exited with {}", output.status));
    }
    let output = String::from_utf8_lossy(&output.stdout);
    if dpms_query_matches(&output, on) {
        Ok(())
    } else {
        Err(format!(
            "DPMS state did not become {}",
            if on { "on" } else { "off" }
        ))
    }
}

#[cfg(any(target_os = "linux", test))]
fn dpms_query_matches(output: &str, on: bool) -> bool {
    output.contains("DPMS is Enabled")
        && output.contains(if on {
            "Monitor is On"
        } else {
            "Monitor is Off"
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn schedule(on: u16, off: u16) -> ApplianceConfig {
        ApplianceConfig {
            enabled: true,
            on_minute: on,
            off_minute: off,
            on_label: "on".into(),
            off_label: "off".into(),
            warning: None,
        }
    }
    #[test]
    fn parses_valid_clock_and_rejects_invalid_values() {
        assert_eq!(parse_clock("07:05"), Some((425, "07:05".into())));
        assert_eq!(parse_clock("24:00"), None);
        assert_eq!(parse_clock("07:60"), None);
        assert_eq!(parse_clock("bad"), None);
    }
    #[test]
    fn daytime_schedule_handles_midnight_off_boundary() {
        let value = schedule(420, 0);
        assert!(!value.is_active(419));
        assert!(value.is_active(420));
        assert!(value.is_active(1439));
        assert!(!value.is_active(0));
    }
    #[test]
    fn overnight_schedule_wraps_across_midnight() {
        let value = schedule(1200, 360);
        assert!(value.is_active(1380));
        assert!(value.is_active(120));
        assert!(!value.is_active(600));
    }
    #[test]
    fn equal_boundaries_mean_always_active() {
        assert!(schedule(60, 60).is_active(720));
    }
    #[test]
    fn desktop_default_is_unmanaged_and_active() {
        let mut config = schedule(420, 0);
        config.enabled = false;
        let runtime = ApplianceRuntime::new(config);
        assert!(!runtime.status().enabled);
        assert!(runtime.status().display_active);
        assert_eq!(runtime.status().display_power, DisplayPower::Unmanaged);
    }
    #[test]
    fn validates_reported_dpms_state() {
        let on = "DPMS is Enabled\n  Monitor is On";
        let off = "DPMS is Enabled\n  Monitor is Off";
        assert!(dpms_query_matches(on, true));
        assert!(dpms_query_matches(off, false));
        assert!(!dpms_query_matches(on, false));
        assert!(!dpms_query_matches(
            "DPMS is Disabled\n  Monitor is Off",
            false
        ));
    }
}
