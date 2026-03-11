import { FormEvent, useEffect, useRef, useState } from "react";
import { supportedHosts } from "../shared/hosts";
import {
  defaultSettings,
  getSettings,
  ROTATION_LIMITS,
  setSettings,
  START_DELAY_LIMITS
} from "../shared/settings";
import { HostName, MicroReelSettings } from "../shared/types";

const initialSettings: MicroReelSettings = {
  ...defaultSettings,
  siteEnabled: { ...defaultSettings.siteEnabled }
};

export function App(): JSX.Element {
  const [settings, setLocalSettings] = useState<MicroReelSettings>(initialSettings);
  const [status, setStatus] = useState("Ready");
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void getSettings().then((value) => setLocalSettings(value));

    return () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const enabledSiteCount = supportedHosts.filter(({ id }) => settings.siteEnabled[id]).length;

  function patchSettings(update: (prev: MicroReelSettings) => MicroReelSettings): void {
    setLocalSettings((prev) => update(prev));
  }

  function updateNumberField(key: "startDelayMs" | "rotationMs", value: number): void {
    if (Number.isNaN(value)) {
      return;
    }

    patchSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  function updateSite(host: HostName, enabled: boolean): void {
    patchSettings((prev) => ({
      ...prev,
      siteEnabled: {
        ...prev.siteEnabled,
        [host]: enabled
      }
    }));
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await setSettings(settings);
    setStatus("Saved");

    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }

    statusTimerRef.current = window.setTimeout(() => {
      setStatus("Ready");
      statusTimerRef.current = null;
    }, 1200);
  }

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-header">
          <img src="icon48.png" alt="MicroReel Logo" className="hero-logo" />
          <p className="eyebrow">MicroReel settings</p>
        </div>
        <h1>Shape the space between prompt and reply.</h1>
        <p className="hero-copy">
          Everything stays local-first. Use this page to decide where MicroReel appears,
          how quickly it starts, and whether it disappears the moment the host finishes.
        </p>

        <div className="hero-stats">
          <article className="stat">
            <span className="stat-label">Master switch</span>
            <strong>{settings.enabled ? "On" : "Paused"}</strong>
          </article>
          <article className="stat">
            <span className="stat-label">Mode</span>
            <strong>{settings.mode === "entertainment" ? "Entertainment" : "Education"}</strong>
          </article>
          <article className="stat">
            <span className="stat-label">Supported sites</span>
            <strong>{enabledSiteCount}/{supportedHosts.length} enabled</strong>
          </article>
        </div>
      </section>

      <form className="settings" onSubmit={onSubmit}>
        <section className="panel">
          <div className="panel-header">
            <p className="section-tag">Behavior</p>
            <h2>Core experience</h2>
            <p>Global rules that apply before any site-specific toggle is checked.</p>
          </div>

          <label className="toggle-row">
            <span className="copy">
              <span className="field-title">Enable overlay</span>
              <span className="field-body">
                Pause MicroReel everywhere without losing your site preferences.
              </span>
            </span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) =>
                patchSettings((prev) => ({
                  ...prev,
                  enabled: event.target.checked
                }))
              }
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span className="field-title">Content mode</span>
              <select
                value={settings.mode}
                onChange={(event) =>
                  patchSettings((prev) => ({
                    ...prev,
                    mode: event.target.value as MicroReelSettings["mode"]
                  }))
                }
              >
                <option value="education">Education (tips and cards)</option>
                <option value="entertainment">Entertainment (videos)</option>
              </select>
            </label>

            <label className="field">
              <span className="field-title">Overlay position</span>
              <select
                value={settings.position}
                onChange={(event) =>
                  patchSettings((prev) => ({
                    ...prev,
                    position: event.target.value as MicroReelSettings["position"]
                  }))
                }
              >
                <option value="top-right">Top right</option>
                <option value="side-right">Side panel right</option>
              </select>
            </label>

            <label className="field">
              <span className="field-title">Start delay</span>
              <input
                type="number"
                min={START_DELAY_LIMITS.min}
                max={START_DELAY_LIMITS.max}
                step={50}
                value={settings.startDelayMs}
                onChange={(event) => updateNumberField("startDelayMs", event.target.valueAsNumber)}
              />
              <span className="field-note">
                Wait before the first card or video appears.
              </span>
            </label>

            <label className="field">
              <span className="field-title">Card rotation</span>
              <input
                type="number"
                min={ROTATION_LIMITS.min}
                max={ROTATION_LIMITS.max}
                step={500}
                value={settings.rotationMs}
                onChange={(event) => updateNumberField("rotationMs", event.target.valueAsNumber)}
              />
              <span className="field-note">
                Used for education mode and short host replies.
              </span>
            </label>
          </div>

          <label className="toggle-row toggle-row--spaced">
            <span className="copy">
              <span className="field-title">Stop when host stops</span>
              <span className="field-body">
                Hide instantly when the AI response ends instead of letting content finish naturally.
              </span>
            </span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={settings.stopOnHostDone}
              onChange={(event) =>
                patchSettings((prev) => ({
                  ...prev,
                  stopOnHostDone: event.target.checked
                }))
              }
            />
          </label>

          <label className="toggle-row toggle-row--spaced">
            <span className="copy">
              <span className="field-title">Mute MicroReel audio</span>
              <span className="field-body">
                Keep the extension silent even when the current tab itself is not muted.
              </span>
            </span>
            <input
              className="toggle-input"
              type="checkbox"
              checked={settings.extensionMuted}
              onChange={(event) =>
                patchSettings((prev) => ({
                  ...prev,
                  extensionMuted: event.target.checked
                }))
              }
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-header">
            <p className="section-tag">Coverage</p>
            <h2>Site controls</h2>
            <p>
              Keep the main switch on, then decide which supported AI surfaces are allowed to show
              MicroReel.
            </p>
          </div>

          <div className="site-grid">
            {supportedHosts.map((host) => (
              <label
                key={host.id}
                className={`site-card ${settings.siteEnabled[host.id] ? "is-on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={settings.siteEnabled[host.id]}
                  onChange={(event) => updateSite(host.id, event.target.checked)}
                />
                <span className="site-card-body">
                  <span className="site-title">{host.label}</span>
                  <span className="site-copy">{host.description}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <footer className="actions">
          <p className="status">
            {status === "Ready"
              ? `Ready - ${enabledSiteCount} of ${supportedHosts.length} sites enabled.`
              : status}
          </p>
          <button type="submit">Save settings</button>
        </footer>
      </form>
    </main>
  );
}
