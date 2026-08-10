---
title: 'Ubuntu Appliance Operations and Tagged Releases'
type: 'feature'
created: '2026-08-10'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8e97aff'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/init.spec'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-tickerdeck-mvp.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** TickerDeck must operate as a permanent 24/7 market appliance inside an Ubuntu VM connected to an 8.8-inch physical display, while preserving ordinary Windows and Ubuntu desktop support. The display, polling, process recovery, and release artifacts currently require manual operation.

**Approach:** Add an opt-in native appliance runtime that schedules DPMS power, prewarms all market data before the 07:00 wake, and throttles overnight polling; package a non-root systemd user service; and publish Linux and Windows installers only from explicit version tags through GitHub Actions.

## Boundaries & Constraints

**Always:** Keep Tauri + React + TypeScript + Rust; use local VM time; default appliance mode off for development/normal desktops; production defaults to ON 07:00 and OFF 00:00; refresh quotes and selected-range charts before DPMS wake; reduce overnight polling; execute only fixed OS display commands without shell interpolation; surface unsupported DPMS instead of claiming success; run the Linux GUI as the logged-in user with restart-on-failure; preserve monitor fallback and Windows behavior; produce `.deb` first, AppImage second, and a supported Windows installer from version tags.

**Ask First:** Adding root services, privileged udev rules, DDC/CI hardware control, an updater/signing secret, automatic VM deployment, a web kiosk conversion, or release triggers beyond explicit `v*` tags/manual dispatch.

**Never:** Turn a developer's display off unless appliance mode is explicitly enabled; render black as a false substitute for successful DPMS; run the GUI as root; deploy on pushes to main; add self-update to this MVP; embed credentials or user-specific display/session paths.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Morning transition | Appliance mode, local time crosses 07:00 | Native layer refreshes quotes/chart, then requests DPMS ON and UI resumes fast polling | Wake display after bounded refresh even if some symbols are stale |
| Midnight transition | Local time crosses 00:00 | DPMS OFF is requested and UI switches to low-frequency polling | Keep app/process alive and report DPMS failure |
| Restart during daytime | Service restarts between 07:00–00:00 | Full refresh completes before display ON | Cached/error state remains per symbol |
| Restart overnight | Service restarts between 00:00–07:00 | Display stays OFF and no 5-second polling begins | Retry scheduling without crash loops |
| Unsupported session | Wayland or missing `xset` prevents DPMS | App remains functional with explicit unsupported/error status | Never claim the physical display is off |
| Tagged release | Push tag matching `v*` | Linux `.deb`/AppImage and Windows installer attach to one GitHub Release | Any matrix failure leaves release visibly incomplete |

</frozen-after-approval>

## Code Map

- `src-tauri/src/appliance/` -- schedule parsing, state transitions, fixed-command DPMS adapter, prewake refresh, and events.
- `src/hooks/useApplianceMode.ts` -- native status subscription and active/overnight polling policy.
- `src/hooks/useMarketDashboard.ts` -- accepts active state and uses reduced overnight cadence.
- `src/components/StatusCard.tsx` -- shows appliance/DPMS state without obscuring market data.
- `deployment/linux/` -- packaged systemd user unit and safe installation helper.
- `src-tauri/tauri.*.conf.json` -- platform-specific `.deb`, AppImage, and Windows installer configuration.
- `.github/workflows/release.yml` -- tag/manual gated cross-platform build and GitHub Release publication.
- `README.md` -- VM, X11/DPMS, systemd, packaging, release, and recovery runbook.

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/appliance/`, `src-tauri/src/lib.rs` -- implement opt-in native schedule state machine, cache prewarm, DPMS adapter, status commands/events, and deterministic tests.
- [x] `src/hooks/useApplianceMode.ts`, `src/hooks/useMarketDashboard.ts`, `src/App.tsx` -- bind appliance status and switch cleanly between daytime and overnight polling.
- [x] `src/components/StatusCard.tsx`, `src/types/` -- expose active/sleeping/unsupported/error state in the utility cell.
- [x] `deployment/linux/`, `src-tauri/tauri.linux.conf.json`, `src-tauri/tauri.windows.conf.json` -- package service assets and primary desktop artifacts without root execution.
- [x] `.github/workflows/release.yml` -- validate and publish Linux/Windows bundles only for `v*` tags or manual dispatch.
- [x] `README.md` -- document Proxmox Ubuntu VM setup, graphical-session environment, DPMS compatibility, service recovery, install/update procedure, and release flow.

**Acceptance Criteria:**
- Given appliance environment variables are absent, when TickerDeck starts on a normal desktop, then display power and existing polling behavior are unchanged.
- Given appliance mode is enabled, when local schedule boundaries occur, then native transitions are idempotent and the UI observes the new active state.
- Given a wake transition, when the display power command runs, then a bounded full native refresh has already been attempted.
- Given overnight mode, when the dashboard remains running, then quote polling is no more frequent than every 15 minutes and chart polling is paused.
- Given the installed user service exits unexpectedly, when systemd evaluates it, then it restarts without root privileges after a short delay.
- Given a non-tag push to main, when GitHub evaluates workflows, then no release deployment runs.

## Spec Change Log

## Design Notes

Use environment variables in the packaged user service (`TICKERDECK_APPLIANCE_MODE`, `TICKERDECK_DISPLAY_ON`, `TICKERDECK_DISPLAY_OFF`) so desktop defaults stay safe and updater support can later be layered on without changing runtime contracts. X11 `xset dpms force on/off` is the supported MVP control path; Wayland is detected and reported as unsupported because compositor-specific private APIs are not reliable cross-desktop contracts.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test -- --run && npm run build` -- frontend checks pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` -- schedule, transition, DPMS, cache, and settings tests pass.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` -- native code is warning-free.
- `npm run tauri build -- --no-bundle` -- host production app builds.
- `actionlint .github/workflows/release.yml` -- release workflow syntax is valid when actionlint is available.

**Manual checks (if no CLI):**
- On Ubuntu Xorg, run the user service with temporary near-future schedule values and confirm refresh-before-wake, physical DPMS off/on, and restart-on-failure.

## Suggested Review Order

**Native appliance lifecycle**

- Start here for opt-in startup and ownership of the native scheduler.
  [`lib.rs:10`](../../src-tauri/src/lib.rs#L10)

- Local-time transitions prewarm data before attempting physical display wake.
  [`appliance/mod.rs:152`](../../src-tauri/src/appliance/mod.rs#L152)

- Fixed X11 commands verify reported DPMS state and reject Wayland ambiguity.
  [`appliance/mod.rs:236`](../../src-tauri/src/appliance/mod.rs#L236)

- Four-second quote caching prevents duplicate fetches immediately after prewarm.
  [`market/mod.rs:69`](../../src-tauri/src/market/mod.rs#L69)

**Frontend coordination**

- Native events safely expose appliance readiness and transition state to React.
  [`useApplianceMode.ts:13`](../../src/hooks/useApplianceMode.ts#L13)

- Daytime and overnight polling policies remain explicit and independently tested.
  [`useMarketDashboard.ts:6`](../../src/hooks/useMarketDashboard.ts#L6)

- Utility UI distinguishes sleeping, prewarming, and unsupported physical power states.
  [`StatusCard.tsx:9`](../../src/components/StatusCard.tsx#L9)

**Deployment and release**

- User-session service starts after graphical login and restarts only on failure.
  [`tickerdeck.service:6`](../../deployment/linux/tickerdeck.service#L6)

- Version-tag workflow builds Linux and Windows release artifacts without main deployment.
  [`release.yml:1`](../../.github/workflows/release.yml#L1)

- VM installation, DPMS diagnosis, service recovery, and releases form one runbook.
  [`README.md:42`](../../README.md#L42)
