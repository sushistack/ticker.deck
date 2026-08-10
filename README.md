# TickerDeck

TickerDeck is a lightweight Tauri desktop dashboard for a permanent 8.8-inch ultrawide market display. Its primary production topology is a Proxmox mini PC running an Ubuntu desktop VM connected to the physical display; normal Ubuntu and Windows desktop use remains supported. It shows five crypto assets plus NVDA and QQQ in a dense 4×2 grid, with global 1D/1M ranges, independent quote/chart refresh schedules, per-symbol failure isolation, monitor restoration, and optional login launch.

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
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run tauri build -- --no-bundle
```

On Windows run these commands in PowerShell after installing the Tauri prerequisites. On Ubuntu install the Tauri Debian dependencies first, then run the same commands. Platform configuration produces NSIS on Windows and both `.deb` and AppImage on Linux. Automatic updater artifacts are intentionally disabled for the MVP; version/config boundaries remain separate so the official updater can be added later.

## Ubuntu VM appliance deployment

Use an Ubuntu desktop VM with direct access to the GPU/display output and automatic login for a dedicated, unprivileged appliance user. TickerDeck is a GUI application and must not be installed as a root system service.

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

React renders memo-friendly SVG sparklines and owns separate quote/chart timers. A provider adapter selects mock data in a browser and Tauri commands in desktop mode. Rust's `MarketDataProvider` isolates Yahoo response formats, normalizes quotes/candles, caches chart ranges, and returns a result for each symbol so one failure cannot collapse the grid.

In appliance mode, a native Rust scheduler—not a potentially throttled WebView timer—owns local-time transitions. Its state is emitted to React, which changes polling cadence and shows DPMS failures in the utility card. Appliance mode is opt-in through environment variables, so Windows and ordinary Ubuntu launches never issue display-power commands.

## Tagged release flow

`.github/workflows/release.yml` runs only for `v*` tags or an explicit manual dispatch; pushes to `main` do not deploy. Keep the versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` identical, then release with:

```bash
npm run release:check -- v0.1.0
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions tests both matrix jobs, builds `.deb` and AppImage on Ubuntu, builds the NSIS installer on Windows, and attaches them to one GitHub Release. Code signing and automatic self-update are intentionally deferred; add their secrets and Tauri updater configuration as a separate release-hardening change.

Yahoo Finance access in this project uses unofficial, undocumented endpoints. It is not a guaranteed official free real-time API and may be rate-limited, changed, delayed, or stopped without notice. The provider boundary is intentionally small so another source can replace it.
