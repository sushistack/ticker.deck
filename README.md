# TickerDeck

[![Release](https://github.com/sushistack/ticker.deck/actions/workflows/release.yml/badge.svg)](https://github.com/sushistack/ticker.deck/actions/workflows/release.yml)

> A glanceable market dashboard built for an always-on 8.8-inch ultrawide display.

TickerDeck is a lightweight Tauri desktop dashboard for a permanent 8.8-inch ultrawide market display. It runs as a normal Ubuntu or Windows desktop application, including on a dual-boot workstation. It shows six crypto assets, USD/KRW, NASDAQ, S&P 500, QQQ, IONQ, ORCL, and LHX alongside a local clock/status tile in a dense 7×2 grid, with automatic 1D/1M rotation, range-relative changes, independent quote/chart refresh schedules, per-symbol failure isolation, monitor restoration, and optional login launch.

## Highlights

- Native Tauri 2 application with a React/TypeScript UI and Rust market-data layer
- Purpose-built 7×2 layout for a 1920×480 8.8-inch ultrawide display
- Binance crypto quotes/charts and Yahoo Finance US equity data behind one Rust provider
- Optional scheduled Ubuntu/X11 DPMS wake and sleep for dedicated appliances
- Reduced overnight polling for reliable 24/7 appliance operation
- Tag-based GitHub releases for Ubuntu `.deb`/AppImage and Windows NSIS artifacts

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
npm run tauri dev            # desktop; native Binance + Yahoo providers
VITE_MOCK_DATA=true npm run tauri dev
```

Mock mode intentionally simulates rising/falling prices and chart changes and is visibly marked `DEMO / MOCK`. Production Tauri mode routes all external data through Rust: Binance supplies crypto data and Yahoo supplies US equity data. React never calls either service directly.

## Build and verify

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run tauri build -- --no-bundle
```

On Windows run these commands in PowerShell after installing the Tauri prerequisites. On Ubuntu install the Tauri Debian dependencies first, then run the same commands. Platform configuration produces NSIS on Windows and both `.deb` and AppImage on Linux. Automatic updater artifacts are intentionally disabled for the MVP; version/config boundaries remain separate so the official updater can be added later.

## Windows desktop setup

For the dual-boot workstation setup, follow [`docs/windows-setup.md`](docs/windows-setup.md). Windows needs its own TickerDeck installation, display orientation, target-monitor selection, fullscreen preference, and login-launch preference; Linux systemd and `xrandr` settings do not carry across operating systems. Installing the packaged app does not require Node.js, Rust, or the Tauri CLI.

## Ubuntu VM appliance deployment

For a dedicated Ubuntu display appliance, use an unprivileged graphical desktop user with direct access to the display output and automatic login. TickerDeck is a GUI application and must not be installed as a root system service. An ordinary workstation can leave appliance mode disabled and still use login launch, monitor restoration, and fullscreen mode.

The MVP physical power controller uses X11 DPMS through `xset`, whose DPMS force operation supports explicit on/off states. Select **Ubuntu on Xorg** at login and install `x11-xserver-utils`. Wayland compositor power APIs are not portable; TickerDeck reports them as unsupported rather than pretending a black window powered off the monitor.

Install the `.deb`, then enable the packaged user service from the graphical user's terminal:

```bash
sudo apt install ./tickerdeck_*_amd64.deb
/usr/share/tickerdeck/install-user-service.sh
systemctl --user status tickerdeck.service
journalctl --user -u tickerdeck.service -f
```

The unit uses `graphical-session.target`, has no `User=` or root service, and restarts after unexpected failures. It enables appliance mode with display ON at `07:00` and OFF at `00:00` local VM time. Override the schedule in `~/.config/tickerdeck/appliance.env`:

```dotenv
TICKERDECK_APPLIANCE_MODE=1
TICKERDECK_DISPLAY_ON=07:00
TICKERDECK_DISPLAY_OFF=00:00
```

After editing, run `systemctl --user restart tickerdeck.service`. The native scheduler attempts a complete quote and selected-chart refresh before issuing DPMS ON. While the display is off, quote polling drops to once per 15 minutes and chart polling pauses. A restart during the active period repeats the refresh-before-wake sequence; a restart overnight immediately requests DPMS OFF.

If the service cannot reach the display, verify `echo "$XDG_SESSION_TYPE"` reports `x11`, `xset q` succeeds, and the service environment contains `DISPLAY`/`XAUTHORITY`. Re-run the installer from a graphical terminal to import the current session environment. The AppImage is intended for manual testing and does not install the service unit.

## Configuration

Default instruments live in `src/config.ts`. Runtime settings include range, target-monitor fingerprint, fullscreen, quote interval, and login launch. They are saved atomically to Tauri's application config directory (browser development uses local storage). Login launch is disabled by default and uses the official Tauri autostart plugin on Windows and Linux.

Monitor selection compares available displays by name, resolution, position, and scale factor. If a saved display disappears, TickerDeck falls back to the primary monitor so the window cannot be stranded off-screen. The window-state plugin also restores ordinary position and size.

## Architecture

React renders memo-friendly SVG sparklines and owns separate quote/chart timers. A provider adapter selects clearly labeled mock data in a browser and Tauri commands in desktop mode. Rust's hybrid `MarketDataProvider` routes `*-USD` crypto identifiers to Binance USDT pairs and US symbols to Yahoo, normalizes both response formats, caches each chart range, and returns a result for every symbol so one source failure cannot collapse the grid.

The visible range automatically alternates between 1D and 1M every five seconds while the display is active. This is a cache/view transition, not a five-second full-history download: 1D histories retain a 60-second TTL and 1M histories retain a 10-minute TTL. Rotation and chart polling pause while the appliance display is asleep.

In appliance mode, a native Rust scheduler—not a potentially throttled WebView timer—owns local-time transitions. Its state is emitted to React, which changes polling cadence and shows DPMS failures in the utility card. Appliance mode is opt-in through environment variables, so Windows and ordinary Ubuntu launches never issue display-power commands.

## Tagged release flow

`.github/workflows/release.yml` runs only for `v*` tags or an explicit manual dispatch; pushes to `main` do not deploy. Keep the versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` identical, then release with:

```bash
npm run release:check -- v0.1.0
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions tests both matrix jobs, builds `.deb` and AppImage on Ubuntu, builds the NSIS installer on Windows, and attaches them to one GitHub Release. Code signing and automatic self-update are intentionally deferred; add their secrets and Tauri updater configuration as a separate release-hardening change.

Binance access uses its public market-data REST endpoints. Yahoo Finance access uses unofficial, undocumented endpoints and may be rate-limited, changed, delayed, or stopped without notice. Neither source should be treated as an exchange-grade trading feed; the provider boundary is intentionally small so either source can be replaced.
