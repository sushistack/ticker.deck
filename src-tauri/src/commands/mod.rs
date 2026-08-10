use crate::market::yahoo::YahooFinanceProvider;
use crate::{
    market::{ChartRange, MarketService, MarketSnapshot},
    settings::{self, AppSettings},
    window::{self, MonitorPreference},
};
use tauri::{AppHandle, State, WebviewWindow};

#[tauri::command]
pub async fn get_quotes(
    symbols: Vec<String>,
    service: State<'_, MarketService<YahooFinanceProvider>>,
) -> Result<Vec<MarketSnapshot>, String> {
    Ok(service.quotes(symbols).await)
}
#[tauri::command]
pub async fn get_charts(
    symbols: Vec<String>,
    range: ChartRange,
    service: State<'_, MarketService<YahooFinanceProvider>>,
) -> Result<Vec<MarketSnapshot>, String> {
    Ok(service.charts(symbols, range).await)
}
#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    settings::load(&app)
}
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    settings::save(&app, &settings)
}
#[tauri::command]
pub fn list_monitors(window: WebviewWindow) -> Result<Vec<MonitorPreference>, String> {
    window::list(&window)
}
#[tauri::command]
pub fn move_to_monitor(
    window: WebviewWindow,
    preference: Option<MonitorPreference>,
    fullscreen: bool,
) -> Result<(), String> {
    window::move_to(&window, preference.as_ref(), fullscreen)
}
