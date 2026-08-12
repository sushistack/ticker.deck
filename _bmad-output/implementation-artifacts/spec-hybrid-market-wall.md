---
title: 'Hybrid 11-instrument market wall with automatic ranges'
type: 'feature'
created: '2026-08-12'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: '00d6a10799eca4614ae9400e141dcca405611e6c'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/init.spec'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The browser preview currently looks live while displaying deterministic mock values, the seven-card layout underuses the 8.8-inch ultrawide panel, and one Yahoo-specific backend serves both equities and crypto.

**Approach:** Present eleven market charts plus one clock/status tile in a dense 6-column × 2-row wall. Route crypto through Binance and US instruments through Yahoo in the native Rust layer, while automatically alternating all charts between 1D and 1M every five seconds.

## Boundaries & Constraints

**Always:** Preserve Tauri + React + TypeScript + Rust and the Ubuntu appliance behavior. Use Binance for crypto and Yahoo for US equities, normalize both behind one internal provider boundary, isolate failures per instrument, retain independent quote/chart cache TTLs, and label browser-only data unmistakably as demo/mock. Configure eleven defaults as BTC, ETH, SOL, XRP, DOGE, BNB, ADA, LINK, AVAX, NVDA, and QQQ; crypto symbols remain UI/config identifiers such as `BTC-USD` and map to Binance USDT pairs only inside the provider. Make the 6×2 composition the priority at 1920×480 while retaining a usable responsive fallback.

**Ask First:** Changing the selected eleven instruments, replacing Binance USDT pairs with another quote currency, or removing settings/window/appliance controls from the clock tile.

**Never:** Call Binance or Yahoo directly from React, show mock data as `LIVE`, refresh full chart histories every five seconds, use a black UI as a substitute for Linux DPMS, or introduce a web-only architecture.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Native mixed refresh | Crypto and stock symbols requested together | Binance supplies crypto; Yahoo supplies stocks; results preserve request order | A failed source marks only its affected symbols stale and cached values remain visible |
| Range rotation | Display active for successive five-second intervals | Global range alternates 1D → 1M → 1D and shows the matching cached chart immediately when present | Failed background refresh retains that range's cached chart |
| Browser preview | `npm run dev` outside Tauri | Eleven deterministic demo cards and clock render in 6×2 | Tile clearly reads `DEMO / MOCK`, never `LIVE` |
| Persisted legacy settings | Existing seven-instrument settings are loaded | Application migrates to the new eleven-instrument default wall | Monitor, fullscreen, autostart, and polling preferences are preserved |

</frozen-after-approval>

## Code Map

- `src-tauri/src/market/{provider,mod,yahoo,binance,hybrid}.rs` -- normalized provider contract, source-specific clients, routing, and per-range caches.
- `src-tauri/src/{lib.rs,commands/mod.rs,appliance/mod.rs,settings/mod.rs}` -- hybrid service registration, native commands/prewarm, and eleven-instrument settings migration.
- `src/{config.ts,types/market.ts,services/marketData.ts,services/settings.ts}` -- defaults, provider-mode metadata, browser demo behavior, and frontend migration.
- `src/{App.tsx,hooks/useMarketDashboard.ts}` -- five-second range rotation and per-range chart state.
- `src/components/{MarketCard,StatusCard}.tsx` and `src/styles.css` -- compact eleven-card wall and clock/status tile.
- `README.md` -- source attribution, demo/native execution distinction, and updated layout.

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/market/` -- add the Binance client and hybrid router with symbol conversion, normalized quotes/klines, stable ordering, and source-isolated errors.
- [x] `src-tauri/src/{lib.rs,commands/mod.rs,appliance/mod.rs}` -- use the hybrid market service for interactive refresh and appliance prewarm.
- [x] `src-tauri/src/settings/mod.rs`, `src/config.ts`, `src/services/settings.ts` -- establish eleven defaults and safely migrate saved seven-card layouts without losing operational preferences.
- [x] `src/hooks/useMarketDashboard.ts`, `src/App.tsx` -- alternate 1D/1M every five seconds and retain separate in-memory charts for both ranges.
- [x] `src/components/`, `src/styles.css` -- render 6×2 at ultrawide dimensions, make the twelfth tile a live local clock/status/control tile, and expose demo mode clearly.
- [x] Rust and frontend test files -- cover Binance normalization/mapping, hybrid ordering/failures, migration, range rotation, cache retention, and demo labeling.
- [x] `README.md` -- document Binance/Yahoo ownership and the automatic range cycle.

**Acceptance Criteria:**
- Given a 1920×480 Tauri window, when the dashboard renders, then eleven instruments and one local clock/status tile fit without page scrolling in a 6×2 grid.
- Given native mode, when a mixed refresh runs, then no crypto request is sent to Yahoo and no US equity request is sent to Binance.
- Given the display is active, when five seconds elapse, then the global chart mode changes and this continues without altering the configured quote refresh interval.
- Given the display is inactive overnight, when time advances, then range rotation and chart polling pause while existing appliance polling policy remains intact.

## Spec Change Log

## Design Notes

The five-second action changes the visible range; it does not force a network history download. Each range owns a frontend snapshot map, while Rust remains authoritative for TTL-based source caching. Binance 24-hour ticker change is normalized into the existing quote shape; charts use Binance klines and US instruments retain Yahoo chart semantics.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test -- --run && npm run build` -- frontend checks pass.
- `cargo test --manifest-path src-tauri/Cargo.toml` -- routing, normalization, cache, settings, and appliance tests pass.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` -- Rust has no warnings.
- `npm run tauri build -- --no-bundle` -- native application compiles.

**Manual checks (if no CLI):**
- Run `npm run dev` and confirm the 6×2 demo wall, visible mock label, local clock, and five-second 1D/1M alternation.
- Run `npm run tauri dev` and confirm native mixed-source values and non-synthetic charts.
