import type { AppSettings, MonitorPreference } from "../types/market";
export function SettingsPanel({
  settings,
  monitors,
  onChange,
  onClose,
}: {
  settings: AppSettings;
  monitors: MonitorPreference[];
  onChange: (next: AppSettings) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="settings-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="settings-heading">
          <h2 id="settings-title">Dashboard settings</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="설정 닫기"
          >
            ×
          </button>
        </div>
        <label>
          <span>대상 모니터</span>
          <select
            value={
              settings.targetMonitor
                ? `${settings.targetMonitor.x}:${settings.targetMonitor.y}`
                : ""
            }
            onChange={(event) =>
              onChange({
                ...settings,
                targetMonitor: monitors.find(
                  (item) => `${item.x}:${item.y}` === event.target.value,
                ),
              })
            }
          >
            <option value="">기본 모니터 (안전 폴백)</option>
            {monitors.map((monitor, index) => (
              <option
                key={`${monitor.x}:${monitor.y}`}
                value={`${monitor.x}:${monitor.y}`}
              >
                {monitor.name || `Display ${index + 1}`} · {monitor.width}×
                {monitor.height}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.fullscreen}
            onChange={(event) =>
              onChange({ ...settings, fullscreen: event.target.checked })
            }
          />
          <span>대시보드 전체화면</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.launchAtLogin}
            onChange={(event) =>
              onChange({ ...settings, launchAtLogin: event.target.checked })
            }
          />
          <span>로그인할 때 실행</span>
        </label>
        <label>
          <span>가격 갱신 주기</span>
          <select
            value={settings.quoteRefreshSeconds}
            onChange={(event) =>
              onChange({
                ...settings,
                quoteRefreshSeconds: Number(event.target.value),
              })
            }
          >
            <option value="5">5초</option>
            <option value="10">10초</option>
            <option value="30">30초</option>
          </select>
        </label>
        <p className="settings-note">
          종목 구성은 <code>src/config.ts</code>에서 간단히 변경할 수 있습니다.
        </p>
        <button className="done-button" onClick={onClose}>
          완료
        </button>
      </section>
    </div>
  );
}
