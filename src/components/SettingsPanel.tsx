import type { AppSettings } from "../types/market";
export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: AppSettings;
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
          종목 구성은 <code>shared/instruments.ts</code>에서 변경할 수 있습니다.
        </p>
        <button className="done-button" onClick={onClose}>
          완료
        </button>
      </section>
    </div>
  );
}
