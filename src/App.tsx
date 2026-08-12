import { useEffect, useState } from "react";
import { MarketCard } from "./components/MarketCard";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusCard } from "./components/StatusCard";
import { DEFAULT_SETTINGS, RANGE_ROTATION_MS } from "./config";
import { nextRange, useMarketDashboard } from "./hooks/useMarketDashboard";
import { useApplianceMode } from "./hooks/useApplianceMode";
import {
  listMonitors,
  loadSettings,
  moveToMonitor,
  saveSettings,
  setAutostart,
} from "./services/settings";
import type { AppSettings, MonitorPreference } from "./types/market";
import { isDemoMarketData } from "./services/marketData";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState(false);
  const [monitors, setMonitors] = useState<MonitorPreference[]>([]);
  const [displayRange, setDisplayRange] = useState(settings.range);
  const appliance = useApplianceMode();
  const { snapshots, lastUpdated, refresh } = useMarketDashboard(
    settings.instruments,
    displayRange,
    settings.quoteRefreshSeconds,
    appliance.ready && appliance.status.displayActive,
  );
  useEffect(() => {
    void loadSettings()
      .catch(() => DEFAULT_SETTINGS)
      .then((value) => {
        setSettings(value);
        setDisplayRange(value.range);
        setReady(true);
        void moveToMonitor(value.targetMonitor, value.fullscreen).catch(
          () => undefined,
        );
      });
  }, []);
  useEffect(() => {
    if (!(appliance.ready && appliance.status.displayActive)) return;
    const timer = window.setInterval(
      () => setDisplayRange((value) => nextRange(value)),
      RANGE_ROTATION_MS,
    );
    return () => window.clearInterval(timer);
  }, [appliance.ready, appliance.status.displayActive]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(
      () => void saveSettings(settings).catch(() => undefined),
      200,
    );
    return () => window.clearTimeout(timer);
  }, [ready, settings]);
  const updateSettings = (next: AppSettings) => {
    if (next.launchAtLogin !== settings.launchAtLogin)
      void setAutostart(next.launchAtLogin).catch(() =>
        setSettings((value) => ({
          ...value,
          launchAtLogin: settings.launchAtLogin,
        })),
      );
    if (
      next.targetMonitor !== settings.targetMonitor ||
      next.fullscreen !== settings.fullscreen
    )
      void moveToMonitor(next.targetMonitor, next.fullscreen).catch(
        () => undefined,
      );
    setSettings(next);
  };
  const openSettings = () => {
    setPanel(true);
    void listMonitors()
      .then(setMonitors)
      .catch(() => setMonitors([]));
  };
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
          onSettings={openSettings}
          appliance={appliance.status}
          demo={isDemoMarketData()}
        />
      </section>
      {panel && (
        <SettingsPanel
          settings={settings}
          monitors={monitors}
          onChange={updateSettings}
          onClose={() => setPanel(false)}
        />
      )}
    </main>
  );
}
