use serde::{Deserialize, Serialize};
use tauri::{Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MonitorPreference {
    pub name: Option<String>,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}
impl From<&Monitor> for MonitorPreference {
    fn from(value: &Monitor) -> Self {
        Self {
            name: value.name().map(String::from),
            width: value.size().width,
            height: value.size().height,
            x: value.position().x,
            y: value.position().y,
            scale_factor: value.scale_factor(),
        }
    }
}
pub fn list(window: &WebviewWindow) -> Result<Vec<MonitorPreference>, String> {
    window
        .available_monitors()
        .map(|items| items.iter().map(Into::into).collect())
        .map_err(|error| error.to_string())
}
fn score(monitor: &Monitor, preference: &MonitorPreference) -> u8 {
    let mut score = 0;
    if monitor.name() == preference.name.as_ref() && preference.name.is_some() {
        score += 4;
    }
    if monitor.size().width == preference.width && monitor.size().height == preference.height {
        score += 2;
    }
    if monitor.position().x == preference.x && monitor.position().y == preference.y {
        score += 1;
    }
    score
}
pub fn move_to(
    window: &WebviewWindow,
    preference: Option<&MonitorPreference>,
    fullscreen: bool,
) -> Result<(), String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let target = preference
        .and_then(|wanted| {
            monitors
                .iter()
                .max_by_key(|monitor| score(monitor, wanted))
                .filter(|monitor| score(monitor, wanted) >= 2)
        })
        .cloned()
        .or(window
            .primary_monitor()
            .map_err(|error| error.to_string())?);
    if let Some(monitor) = target {
        window
            .set_fullscreen(false)
            .map_err(|error| error.to_string())?;
        window
            .set_position(PhysicalPosition::new(
                monitor.position().x,
                monitor.position().y,
            ))
            .map_err(|error| error.to_string())?;
        if fullscreen {
            window
                .set_size(PhysicalSize::new(
                    monitor.size().width,
                    monitor.size().height,
                ))
                .map_err(|error| error.to_string())?;
            window
                .set_fullscreen(true)
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preference_serialization_is_stable() {
        let value = MonitorPreference {
            name: Some("Display".into()),
            width: 1920,
            height: 480,
            x: 1920,
            y: 0,
            scale_factor: 1.0,
        };
        let json = serde_json::to_string(&value).unwrap();
        assert!(json.contains("scaleFactor"));
        assert_eq!(
            serde_json::from_str::<MonitorPreference>(&json).unwrap(),
            value
        );
    }
}
