# Windows dual-boot setup

This guide configures TickerDeck on the Windows side of a PC that also boots Ubuntu. Each operating system has independent application files, display settings, and login-startup configuration. The Ubuntu systemd service and `xrandr` rotation do not run while Windows is booted.

## 1. Install TickerDeck

Download the Windows setup executable from the repository's GitHub Releases page and run it. Release assets are built as a per-user NSIS installer with a name similar to `tickerdeck-<version>-windows-<arch>-setup.exe`.

The release is not currently code-signed, so Windows SmartScreen may show an unrecognized-app warning. Verify that the installer came from the `sushistack/ticker.deck` GitHub repository before choosing **More info → Run anyway**.

Only the packaged installer is needed for normal use. Node.js, Rust, Microsoft C++ Build Tools, and the Tauri CLI are development dependencies and do not need to be installed.

If no release contains the desired commit yet, either create a tagged release using the process in the root README or build the installer from a Windows development environment:

```powershell
npm ci
npm run typecheck
npm run lint
npm test -- --run
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build -- --bundles nsis
```

The locally built installer is written below `src-tauri\target\release\bundle\nsis\`.

## 2. Configure the ultrawide display

1. Open **Settings → System → Display**.
2. Select **Identify** and choose the 8.8-inch HDMI display.
3. Set its scale to **100%**.
4. Choose the landscape orientation that produces an upright image. Depending on the panel's reported native orientation, this may be **Landscape** or **Landscape (flipped)**.
5. Confirm that Windows reports a logical resolution of **1920 × 480**.
6. Arrange the display at the right side of the main monitors and apply the layout.

Display orientation is owned by Windows. TickerDeck selects and fills a display but does not rotate the Windows desktop.

## 3. Select the display and enable startup

1. Start TickerDeck from the Start menu.
2. Open the gear button in the TickerDeck status card.
3. Select the `1920×480` HDMI display as the target monitor.
4. Enable **Fullscreen**.
5. Enable **Launch at login**.
6. Close the settings panel and confirm that TickerDeck fills only the ultrawide display.

These preferences are stored on Windows and must be selected once even if the same choices were already made on Ubuntu. Login launch uses the Tauri autostart integration; a separate Windows Task Scheduler entry is not required.

## 4. Power and scheduling behavior

The workstation setup intentionally does not schedule display power at 07:00 or 00:00. TickerDeck starts after the Windows user signs in and stops when the user signs out or shuts down the PC. Normal Windows monitor sleep and power settings remain in control.

TickerDeck's scheduled DPMS implementation is Linux/X11-only. On Windows the status card may report that managed DPMS is unsupported; this does not affect quotes, charts, monitor selection, fullscreen mode, or login launch.

## 5. Verify after reboot

After rebooting into Windows and signing in, verify the following:

- TickerDeck starts without a manual shortcut or Task Scheduler task.
- The window opens on the 1920×480 HDMI display in fullscreen mode.
- The display is upright and does not overlap either main monitor.
- 1D and 1M rotate automatically and show different range-relative change values.
- ZCASH follows DOGE, and IONQ follows QQQ.

If the app opens on the wrong display, open its settings and select the target again after completing the Windows display arrangement. Windows can change monitor coordinates when cables, GPU ports, or display order change.

## Updating

TickerDeck does not currently self-update. Download and run the newer NSIS installer over the existing installation. The installer uses current-user mode, and saved application preferences should remain in the user's application-data directory. Recheck the target display after a GPU-driver update or cable change.
