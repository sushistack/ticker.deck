# TickerDeck

TickerDeck is a lightweight Tauri desktop dashboard for an 8.8-inch ultrawide secondary monitor. It shows five crypto assets plus NVDA and QQQ in a dense 4×2 grid, with global 1D/1M ranges, independent quote/chart refresh schedules, per-symbol failure isolation, monitor restoration, and optional login launch.

## Screenshot

Open [`ui-preview.html`](ui-preview.html) for the standalone 1920×480 design preview. A packaged-app screenshot will be added after platform release builds.

## Prerequisites

- Node.js 22 or newer and npm
- Rust stable
- Tauri 2 platform prerequisites: WebView2 and Microsoft C++ Build Tools on Windows; WebKitGTK and the documented build packages on Ubuntu

Follow the current [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) for exact OS package names.

## Development

```bash
npm install
npm run dev                  # browser; deterministic mock data
npm run tauri dev            # desktop; native Yahoo provider
VITE_MOCK_DATA=true npm run tauri dev
```

Mock mode intentionally simulates rising/falling prices and chart changes. Production Tauri mode routes all external data through Rust; the React frontend never calls Yahoo directly.

## Build and verify

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

On Windows run these commands in PowerShell after installing the Tauri prerequisites. On Ubuntu install the Tauri Debian dependencies first, then run the same commands. Bundling is disabled in `tauri.conf.json` for repository-level verification; set `bundle.active` to `true` and add release icons/signing configuration when producing installers.

## Configuration

Default instruments live in `src/config.ts`. Runtime settings include range, target-monitor fingerprint, fullscreen, quote interval, and login launch. They are saved atomically to Tauri's application config directory (browser development uses local storage). Login launch is disabled by default and uses the official Tauri autostart plugin on Windows and Linux.

Monitor selection compares available displays by name, resolution, position, and scale factor. If a saved display disappears, TickerDeck falls back to the primary monitor so the window cannot be stranded off-screen. The window-state plugin also restores ordinary position and size.

## Architecture

React renders memo-friendly SVG sparklines and owns separate quote/chart timers. A provider adapter selects mock data in a browser and Tauri commands in desktop mode. Rust's `MarketDataProvider` isolates Yahoo response formats, normalizes quotes/candles, caches chart ranges, and returns a result for each symbol so one failure cannot collapse the grid.

Yahoo Finance access in this project uses unofficial, undocumented endpoints. It is not a guaranteed official free real-time API and may be rate-limited, changed, delayed, or stopped without notice. The provider boundary is intentionally small so another source can replace it.
