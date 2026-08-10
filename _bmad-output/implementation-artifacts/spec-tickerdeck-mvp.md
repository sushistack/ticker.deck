---
title: 'TickerDeck MVP'
type: 'feature'
created: '2026-08-10'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/init.spec'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A small 8.8-inch ultrawide secondary display needs a low-overhead, always-on view of five crypto assets and two US instruments without seven browser charts. It must remain reliable across Windows and Ubuntu, restore to the intended monitor, and degrade per instrument when market data fails.

**Approach:** Build a Tauri 2 desktop app with a compact 4×2 React grid, native Rust Yahoo Finance provider, separate quote/chart caches, persisted settings, optional autostart, and a deterministic mock mode. Include a standalone HTML preview matching the production UI before completing the live implementation.

## Boundaries & Constraints

**Always:** Keep Yahoo-specific schemas behind normalized Rust models; batch and independently validate symbols; retain last good values with visible stale/error labels; refresh quotes near 5s, 1D charts near 60s, and 1M charts near 10m; clean up timers and chart instances; distinguish direction by icon/text as well as color; support Windows and Ubuntu from one codebase; use a safe primary-monitor fallback.

**Ask First:** Adding a database, cloud service, paid data source, embedded browser chart, platform-specific installer script, or expanding beyond the seven-instrument glance dashboard.

**Never:** Trading, accounts, alerts, news, portfolio accounting, technical indicators, direct frontend Yahoo calls, fabricated candles, a complex settings surface, or deeply hard-coded instrument cards.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal startup | Saved settings and reachable Yahoo data | Seven cards render cached/live quotes and selected-range charts | Show loading only until cached or first response |
| Partial provider failure | One malformed/unavailable symbol | Other cards update; failed card retains last good value | Add stale/error badge and retry on schedule |
| Range switch | User selects 1D or 1M | All charts immediately use cached range, then revalidate if stale | Preserve prior chart if refresh fails |
| Monitor unavailable | Stored monitor fingerprint is absent | App remains visible on primary monitor | Persist new position after a valid move |
| Browser development | Tauri APIs unavailable or mock flag enabled | Dashboard runs with deterministic changing mock data | No native call or CORS failure leaks into UI |

</frozen-after-approval>

## Code Map

- `ui-preview.html` -- standalone 1920×480-oriented visual example.
- `src/` -- React dashboard, range/status controls, settings panel, hooks, services, types, formatting, and tests.
- `src-tauri/src/market/` -- provider trait, Yahoo implementation, normalization, caching, and unit tests.
- `src-tauri/src/commands/` -- frontend-safe market, settings, monitor, window, and autostart commands.
- `src-tauri/` -- Tauri configuration, capabilities, platform plugins, and Rust application entrypoint.
- `README.md` -- setup, platform builds, configuration, caveats, and architecture.

## Tasks & Acceptance

**Execution:**
- [x] `package.json`, Vite/TypeScript/test configs -- scaffold reproducible React/Tauri frontend tooling.
- [x] `ui-preview.html`, `src/components/`, `src/styles.css` -- implement the dense 4×2 ultrawide UI, accessible movement states, responsive fallback, settings overlay, and reusable sparkline cards.
- [x] `src/hooks/`, `src/services/`, `src/utils/` -- implement cached range switching, split polling schedules, mock/native adapters, persistence, formatting, and cleanup.
- [x] `src-tauri/src/market/`, `src-tauri/src/commands/` -- implement normalized batched Yahoo requests, per-symbol isolation, cache policy, settings, monitor matching, and safe window placement.
- [x] `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/` -- register Tauri 2 plugins/commands for store, autostart, and window state with least-required permissions.
- [x] `src/**/*.test.*`, Rust unit tests -- cover normalization, calculations, range mapping, formatting, stale fallback, and settings round trips.
- [x] `README.md` -- document prerequisites, development, Windows/Ubuntu builds, mock mode, autostart, configuration, architecture, and unofficial Yahoo endpoint risk.

**Acceptance Criteria:**
- Given a 1920×480-class viewport, when the dashboard opens, then all seven instruments and one utility card are simultaneously readable without scrolling.
- Given live mode, when data refreshes, then the frontend invokes native commands and never contacts Yahoo directly.
- Given repeated operation, when quote and chart timers run, then history is not fetched at the quote cadence and all timers/listeners/charts are disposed on unmount.
- Given saved settings, when the app restarts, then instruments, range, display preference, autostart choice, and refresh preference are restored.
- Given Windows or Ubuntu prerequisites, when production checks run, then TypeScript, frontend tests, lint, Rust tests, and builds pass.

## Spec Change Log

## Design Notes

Use seven identical market cards plus one utility card; avoid a global header. Optimize the fixed ultrawide case first, then collapse to 2 columns and 1 column for development windows. Use an SVG sparkline rather than a full chart engine: it has no axes/toolbars, updates cheaply, and satisfies the small-card price-trend requirement.

## Verification

**Commands:**
- `npm run typecheck` -- TypeScript passes without emit.
- `npm test -- --run` -- frontend unit/component tests pass.
- `npm run lint` -- ESLint passes.
- `npm run build` -- production frontend bundle succeeds.
- `cargo test --manifest-path src-tauri/Cargo.toml` -- Rust normalization/settings/cache tests pass.
- `cargo check --manifest-path src-tauri/Cargo.toml` -- native application compiles for the host.

**Manual checks (if no CLI):**
- Open `ui-preview.html` at 1920×480 and verify all eight cells fit, movement is recognizable without color, and controls remain keyboard reachable.

## Suggested Review Order

**Application flow**

- Start here for settings restoration, polling state, and the eight-cell composition.
  [`App.tsx:16`](../../src/App.tsx#L16)

- Separate quote/chart schedules prevent expensive history polling at five-second cadence.
  [`useMarketDashboard.ts:22`](../../src/hooks/useMarketDashboard.ts#L22)

**Native data boundary**

- Provider abstraction keeps Yahoo response shapes out of UI components.
  [`provider.rs:5`](../../src-tauri/src/market/provider.rs#L5)

- Batched quotes, resilient fallback, and normalization isolate provider failures.
  [`yahoo.rs:101`](../../src-tauri/src/market/yahoo.rs#L101)

- Per-range native caching serves fresh history without unnecessary downloads.
  [`market/mod.rs:108`](../../src-tauri/src/market/mod.rs#L108)

**Desktop behavior**

- Monitor fingerprint scoring guarantees a visible primary-display fallback.
  [`window/mod.rs:45`](../../src-tauri/src/window/mod.rs#L45)

- Settings validation and replacement-safe persistence survive corrupt local state.
  [`settings/mod.rs:19`](../../src-tauri/src/settings/mod.rs#L19)

**UI and support**

- Compact accessible cards combine direction text, symbols, and low-cost SVG trends.
  [`MarketCard.tsx:5`](../../src/components/MarketCard.tsx#L5)

- Ultrawide-first grid rules fit 1920×480 while retaining development-window fallbacks.
  [`styles.css:33`](../../src/styles.css#L33)

- Setup, cross-platform builds, mock mode, and Yahoo caveats are documented together.
  [`README.md:17`](../../README.md#L17)
