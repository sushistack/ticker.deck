You are implementing a complete MVP desktop application called "TickerDeck".

Use BMAD dev-auto workflow and proceed autonomously through analysis, implementation, testing, debugging, and refinement.

Do not stop to ask questions unless there is a genuinely blocking ambiguity that cannot be reasonably resolved. Prefer sensible engineering defaults.

==================================================
1. PRODUCT GOAL
==================================================

TickerDeck is a lightweight, always-on market dashboard designed primarily for a small ultrawide secondary monitor.

Primary use case:

- User boots Windows or Ubuntu.
- TickerDeck launches automatically.
- The app opens on the designated secondary monitor.
- It displays 7 market instruments simultaneously in a compact grid.
- The user can glance at crypto and US stock market movements without opening TradingView or a browser.
- Market data should refresh automatically.

The application must work on BOTH:

- Windows
- Ubuntu Linux

The same codebase should support both platforms.

This is a personal desktop application, not a SaaS product.

Prioritize:

1. Reliability
2. Low resource usage
3. Fast startup
4. Readability on a small ultrawide display
5. Simple architecture
6. Cross-platform compatibility

Avoid unnecessary enterprise architecture.

==================================================
2. TECHNOLOGY STACK
==================================================

Preferred stack:

Desktop:
- Tauri

Frontend:
- React
- TypeScript
- Vite

Backend/native layer:
- Rust through Tauri commands

Charting:
- TradingView Lightweight Charts if appropriate
- Or another lightweight open-source chart library if there is a strong technical reason

Market data:
- Yahoo Finance endpoints/data

IMPORTANT:

Do NOT call Yahoo Finance directly from the browser/frontend if that introduces CORS or browser restrictions.

Prefer:

React
    ↓
Tauri invoke
    ↓
Rust
    ↓
Yahoo Finance
    ↓
normalized market data
    ↓
React

Centralize Yahoo-specific logic so the data provider can easily be replaced later.

Do not couple UI components directly to Yahoo response structures.

==================================================
3. DEFAULT INSTRUMENTS
==================================================

The initial dashboard should contain 7 instruments.

Crypto examples:

BTC-USD
ETH-USD
SOL-USD
XRP-USD
DOGE-USD

US market examples:

NVDA
QQQ

Do NOT hard-code these deeply into UI components.

Define instruments through configuration/state so they can easily be changed later.

For example:

[
  { symbol: "BTC-USD", type: "crypto" },
  { symbol: "ETH-USD", type: "crypto" },
  { symbol: "SOL-USD", type: "crypto" },
  { symbol: "XRP-USD", type: "crypto" },
  { symbol: "DOGE-USD", type: "crypto" },
  { symbol: "NVDA", type: "stock" },
  { symbol: "QQQ", type: "stock" }
]

==================================================
4. DASHBOARD UI
==================================================

The application is intended for a small ultrawide monitor, approximately 8.8 inches.

Design for HIGH INFORMATION DENSITY.

Default layout:

4 columns × 2 rows

7 market cards + 1 utility/status area if useful.

Example:

┌──────────┬──────────┬──────────┬──────────┐
│ BTC      │ ETH      │ SOL      │ XRP      │
│ PRICE    │ PRICE    │ PRICE    │ PRICE    │
│ CHANGE   │ CHANGE   │ CHANGE   │ CHANGE   │
│ CHART    │ CHART    │ CHART    │ CHART    │
├──────────┼──────────┼──────────┼──────────┤
│ DOGE     │ NVDA     │ QQQ      │ STATUS   │
│ PRICE    │ PRICE    │ PRICE    │ TIME     │
│ CHANGE   │ CHANGE   │ CHANGE   │ MARKET   │
│ CHART    │ CHART    │ CHART    │ STATUS   │
└──────────┴──────────┴──────────┴──────────┘

The exact layout may be refined based on usability.

Requirements:

- Dark theme by default
- Minimal borders/chrome
- No unnecessary menus
- No large headers
- No wasted padding
- Responsive to different ultrawide resolutions
- Designed to remain readable at small physical sizes

Each market card should display at minimum:

- Symbol
- Current price
- Price change
- Percentage change
- Compact price chart

Positive and negative movements should be visually distinguishable.

Do not rely ONLY on color for state differentiation.

==================================================
5. TIME RANGE MODES
==================================================

Support two primary chart modes:

1D
1M

The user must be able to switch between them.

Provide a global control:

[ 1D ] [ 1M ]

Switching the global mode updates all seven charts.

Optionally allow individual card range overrides if this can be implemented cleanly without complicating the MVP.

Default mode:

1D

Suggested data granularity:

1D:
- intraday data
- approximately 5 minute candles/points where supported

1M:
- hourly or daily data depending on Yahoo availability and chart readability

Choose intervals based on Yahoo Finance capabilities and actual returned data.

Do not fabricate missing market data.

==================================================
6. DATA REFRESH STRATEGY
==================================================

Current prices should refresh approximately every:

5 seconds

However:

DO NOT download an entire month of historical chart data every 5 seconds.

Use separate refresh strategies.

Suggested architecture:

Current quote:
- refresh every 5 seconds

1D chart:
- refresh approximately every 60 seconds

1M chart:
- refresh approximately every 5-15 minutes

When switching between 1D and 1M:

1. immediately display cached data if available
2. refresh in background if data is stale

Implement sensible caching.

Avoid unnecessary Yahoo Finance requests.

==================================================
7. YAHOO FINANCE PROVIDER
==================================================

Implement a provider abstraction.

Example conceptual interface:

MarketDataProvider

Methods such as:

getQuote(symbol)
getChart(symbol, range)
getQuotes(symbols)

YahooFinanceProvider implements this interface.

Normalize Yahoo responses into internal application models.

Example:

Quote {
    symbol
    price
    previousClose
    change
    changePercent
    timestamp
}

ChartPoint {
    timestamp
    price
}

Handle:

- network errors
- malformed responses
- unavailable symbols
- market closed state
- missing candles
- rate limiting / HTTP errors

One failed symbol MUST NOT break the entire dashboard.

Show a subtle stale/error indicator on the affected card.

Keep the most recent valid value when appropriate.

==================================================
8. CROSS-PLATFORM WINDOW BEHAVIOR
==================================================

Support:

Windows
Ubuntu Linux

The application should be capable of:

- enumerating monitors
- remembering the selected target monitor
- opening on that monitor
- restoring its previous position
- using borderless/fullscreen mode suitable for a dashboard

Do NOT assume monitor numbering is stable.

Prefer storing useful monitor identification information such as:

- name if available
- resolution
- position
- scale factor

If the configured monitor cannot be found:

fallback safely to the primary monitor.

The application must remain usable with only one monitor attached.

==================================================
9. AUTO START
==================================================

Provide optional "Launch at login" functionality.

Support:

Windows login/startup
Ubuntu desktop autostart

Prefer a supported Tauri plugin or clean platform abstraction rather than brittle custom shell scripts.

Autostart should be configurable.

Default:

disabled during development.

Make production behavior easy to enable from settings.

==================================================
10. SETTINGS
==================================================

Persist basic application settings locally.

At minimum:

- instruments
- selected chart range
- target monitor
- launch at login
- fullscreen/borderless preference
- refresh interval where appropriate

Use a simple local configuration mechanism.

No database is necessary unless strongly justified.

Settings must survive application restart.

==================================================
11. MARKET STATUS
==================================================

The eighth grid slot may display useful status information.

Possible information:

- local time
- US market status: OPEN / CLOSED
- last successful refresh
- network/data status

Keep this simple.

Do not build a complicated market calendar system for MVP.

If determining market status accurately requires a large dependency or unreliable assumptions, prefer displaying:

"Last update: HH:mm:ss"

instead.

==================================================
12. PERFORMANCE
==================================================

This application may remain running all day.

Therefore:

- minimize CPU usage
- avoid unnecessary React rerenders
- clean up timers
- clean up chart instances
- avoid memory leaks
- avoid recreating charts every refresh
- update existing chart series efficiently
- batch market requests where practical
- do not poll invisible/unnecessary resources excessively

The application should be significantly lighter than running multiple browser-based TradingView charts.

==================================================
13. UX DETAILS
==================================================

Prices should format appropriately.

Examples:

BTC:
116,320

ETH:
3,820.42

DOGE:
0.23184

Stocks:
182.31

Avoid meaningless fixed decimal counts.

Show percentage changes clearly.

Examples:

+2.31%
-0.72%

Charts should remain visually useful even in very small cards.

Avoid:

- axis clutter
- excessive labels
- large legends
- toolbars
- unnecessary grid lines

A sparkline-style chart is acceptable and may be preferable.

==================================================
14. PROJECT STRUCTURE
==================================================

Keep architecture straightforward.

Suggested frontend structure:

src/
  components/
    Dashboard
    MarketCard
    RangeSelector
    StatusCard
  hooks/
  services/
  stores/
  types/
  utils/

Tauri/Rust:

src-tauri/
  src/
    market/
      mod.rs
      provider.rs
      yahoo.rs
    commands/
    settings/
    window/

Exact structure may differ if a cleaner implementation emerges.

Avoid premature abstraction.

==================================================
15. TESTING
==================================================

Add meaningful automated tests.

At minimum test:

- Yahoo response normalization
- price/change calculations
- range mapping
- price formatting
- stale/error handling
- settings serialization/deserialization

Frontend components should have tests where they provide useful confidence.

Do not create tests purely to increase test count.

Run:

- TypeScript checks
- frontend tests
- Rust tests
- linting
- production build

Fix failures before declaring completion.

==================================================
16. DEVELOPMENT MOCK MODE
==================================================

Provide a simple mock-data mode so UI development does not depend entirely on Yahoo availability.

Mock mode should simulate:

- positive movement
- negative movement
- price updates
- chart data

The real Yahoo provider remains the normal production provider.

==================================================
17. README
==================================================

Create a useful README containing:

- what TickerDeck is
- screenshots section placeholder
- prerequisites
- development setup
- Windows build instructions
- Ubuntu build instructions
- Yahoo Finance data caveat
- configuration
- autostart behavior
- architecture overview

Clearly state that Yahoo Finance access used by this project may rely on unofficial/undocumented endpoints and therefore can change or stop working.

Do NOT describe Yahoo Finance as a guaranteed official free realtime API.

==================================================
18. OUT OF SCOPE FOR MVP
==================================================

Do NOT implement unless required by the core architecture:

- user accounts
- cloud synchronization
- trading
- broker integration
- alerts
- notifications
- portfolio accounting
- technical indicators
- drawing tools
- TradingView embedding
- order books
- news feeds
- complex settings UI
- automatic updates
- mobile support

Keep the MVP focused.

==================================================
19. ACCEPTANCE CRITERIA
==================================================

The project is considered complete when:

1. Application launches successfully with Tauri.
2. Same codebase supports Windows and Ubuntu.
3. Seven configured instruments are visible simultaneously.
4. Yahoo Finance data is retrieved through the native/Tauri layer.
5. Current prices refresh approximately every 5 seconds.
6. 1D and 1M chart modes work.
7. Historical chart data is cached and is NOT unnecessarily fetched every 5 seconds.
8. Individual API failures do not crash the dashboard.
9. App settings persist between launches.
10. Target monitor selection/restore works with a safe fallback.
11. Optional launch-at-login functionality exists.
12. UI is usable on a small ultrawide secondary monitor.
13. Application can run for extended periods without obvious resource leaks.
14. Development mock mode works.
15. Tests pass.
16. Production build succeeds.
17. README explains setup and architecture.

==================================================
20. IMPLEMENTATION APPROACH
==================================================

Before coding:

1. Inspect the existing repository.
2. Determine whether this is a new or existing Tauri project.
3. Preserve useful existing code.
4. Create a concise implementation plan.
5. Identify Yahoo Finance endpoints/response formats needed.
6. Verify current Tauri APIs/plugins before relying on them.

Then implement autonomously.


Additional decisions made after the original specification:

1. Keep the existing Tauri + React + TypeScript + Rust architecture.
   Do NOT convert the project into a web-only kiosk application.

2. The primary production deployment target is now:
   Proxmox Mini PC
   -> Ubuntu VM
   -> TickerDeck Tauri application
   -> physical 8.8-inch HDMI/DP display

3. Windows and normal Ubuntu desktop builds should still remain supported,
   but the Ubuntu VM is the primary always-on deployment environment.

4. The VM and TickerDeck application may remain running 24/7.

5. The physical display should follow this schedule:
   - ON: 07:00 local time
   - OFF: 00:00 local time
   The goal is for the user to be able to glance at the market immediately
   in the morning without manually starting another PC.

6. Prefer turning the actual display output/backlight off through the OS
   display/DPMS mechanism rather than merely rendering a black screen.

7. Before the display turns on in the morning, perform a full market-data
   refresh so the first visible state is current.

8. Outside the display-active period, aggressive 5-second polling is not
   necessary. It is acceptable to pause or significantly reduce polling
   overnight and refresh immediately before display wake.

9. Production Linux packaging:
   - .deb is the primary Ubuntu deployment artifact.
   - AppImage may also be produced for easy testing/manual execution.

10. Windows packaging:
    - Produce the normal supported Tauri Windows installer artifact.

11. Preferred release flow:
    git tag / release
    -> GitHub Actions
    -> build Linux and Windows artifacts
    -> publish artifacts to GitHub Release

12. Do not deploy automatically on every push to main.
    Prefer explicit version/tag-based releases.

13. For the Ubuntu VM:
    - TickerDeck should start automatically after graphical login.
    - Prefer a user-level systemd service or another reliable GUI-session
      startup mechanism.
    - Configure automatic restart after unexpected application failure.
    - Do not run the GUI application as a normal root system service.

14. Automatic application self-update is NOT required for the initial MVP.
    Structure the project so Tauri updater support could be added later.

15. The Ubuntu VM/display deployment is operationally more important than
    generic multi-monitor desktop behavior.
    Preserve multi-monitor support, but prioritize reliable startup on the
    dedicated VM-connected 8.8-inch display.

16. Treat the 8.8-inch monitor as a permanent market appliance/display,
    not merely a temporary second monitor attached to a workstation.