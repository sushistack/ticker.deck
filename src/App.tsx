import { useEffect, useState } from "react";
import { MarketCard } from "./components/MarketCard";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusCard } from "./components/StatusCard";
import { DEFAULT_SETTINGS, RANGE_ROTATION_MS } from "./config";
import { nextRange, useMarketDashboard } from "./hooks/useMarketDashboard";
import { loadSettings, saveSettings } from "./services/settings";
import type { AppSettings } from "./types/market";
import { isDemoMarketData } from "./services/marketData";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(false);
  const [displayRange, setDisplayRange] = useState(settings.range);
  const { snapshots, lastUpdated, refresh } = useMarketDashboard(
    settings.instruments,
    displayRange,
    settings.quoteRefreshSeconds,
  );
  useEffect(() => {
    void loadSettings()
      .catch(() => DEFAULT_SETTINGS)
      .then((value) => {
        setSettings(value);
        setDisplayRange(value.range);
        setReady(true);
      });
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () => setDisplayRange((value) => nextRange(value)),
      RANGE_ROTATION_MS,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(
      () => void saveSettings(settings).catch(() => undefined),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [ready, settings]);
  const staleCount = Object.values(snapshots).filter(
    (item) => item.stale,
  ).length;
  return (
    <main className="dashboard-shell">
      <section
        className="dashboard-grid"
        aria-label="TickerDeck market dashboard"
      >
        {settings.instruments.map((instrument) => (
          <MarketCard
            key={instrument.symbol}
            instrument={instrument}
            snapshot={snapshots[instrument.symbol]}
            range={displayRange}
          />
        ))}
        <StatusCard
          range={displayRange}
          lastUpdated={lastUpdated}
          staleCount={staleCount}
          onRange={(range) => {
            setDisplayRange(range);
            setSettings((value) => ({ ...value, range }));
          }}
          onRefresh={() => void refresh()}
          onSettings={() => setPanel(true)}
          demo={isDemoMarketData()}
        />
      </section>
      {panel && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={() => setPanel(false)}
        />
      )}
    </main>
  );
}
