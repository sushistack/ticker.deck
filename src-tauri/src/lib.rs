mod commands;
mod market;
mod settings;
mod window;

use market::{yahoo::YahooFinanceProvider, MarketService};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(MarketService::new(YahooFinanceProvider::new()))
        .invoke_handler(tauri::generate_handler![
            commands::get_quotes,
            commands::get_charts,
            commands::load_settings,
            commands::save_settings,
            commands::list_monitors,
            commands::move_to_monitor
        ])
        .run(tauri::generate_context!())
        .expect("error while running TickerDeck");
}
