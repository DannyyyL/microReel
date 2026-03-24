import { useEffect, useRef, useState } from "react";
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

function HostLogo({ host }: { host: HostName }): JSX.Element {
  switch (host) {
    case "chatgpt":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="site-logo-svg">
          <path
            fill="currentColor"
            d="M12 1.75a4.6 4.6 0 0 1 4.48 3.55 4.6 4.6 0 0 1 4.46 7.1 4.6 4.6 0 0 1-1.56 6.26 4.6 4.6 0 0 1-6.7 3.77 4.6 4.6 0 0 1-7.06-2.7 4.6 4.6 0 0 1-2.56-7.82 4.6 4.6 0 0 1 2.88-7.54A4.6 4.6 0 0 1 12 1.75Zm-2.9 5.12-1.38.8a2.63 2.63 0 0 0-1.06 3.58l.19.34 2.25-1.3V7.5l-.01-.63Zm5.37.12v2.62l2.28 1.31.2-.34a2.63 2.63 0 0 0-.7-3.43l-.35-.22-1.43-.82Zm-2.45 1.42-2.26 1.31v2.58l2.24 1.29 2.26-1.3V9.7l-2.24-1.29Zm-4.4 5.73-.2.34a2.63 2.63 0 0 0 1 3.61l1.44.84 2.25-1.3v-2.62l-2.28-1.31-2.22 1.28Zm8.76.02-2.25 1.3v2.62l2.25 1.3 1.39-.8a2.63 2.63 0 0 0 1.06-3.58l-.2-.35-2.25-1.3Zm-4.36 5.04-2.25 1.3.2.34a2.63 2.63 0 0 0 3.45 1l.35-.18 1.43-.82v-2.6l-2.24-1.3-.94.55Zm1.44-1.38v2.59l.92-.53 1.35-.78a2.63 2.63 0 0 0 1.03-3.47l-.18-.35-2.26-1.3-2.24 1.3v2.54l1.38.8Z"
          />
        </svg>
      );
    case "claude":
      return <span className="site-logo-letter">C</span>;
    case "gemini":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="site-logo-svg">
          <path
            fill="currentColor"
            d="M12 2.25c.38 0 .72.24.85.6l1.78 4.86a7.78 7.78 0 0 0 4.66 4.72l4.8 1.74a.9.9 0 0 1 0 1.69l-4.82 1.76a7.78 7.78 0 0 0-4.63 4.63l-1.89 5.14a.9.9 0 0 1-1.69 0l-1.9-5.13a7.78 7.78 0 0 0-4.6-4.6L.9 15.86a.9.9 0 0 1 0-1.69l4.92-1.83A7.78 7.78 0 0 0 10.4 7.7l1.76-4.85a.9.9 0 0 1 .84-.6Z"
          />
        </svg>
      );
    case "copilot":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="site-logo-svg">
          <path
            fill="currentColor"
            d="M12 1.5c2.3 0 5.85.45 8.5 3.35 1.4 1.52 2.02 3.62 2.26 6.42.59.04 1.16.25 1.55.78l.73 1a1.9 1.9 0 0 1 .36 1.1v2.67c0 .6-.28 1.16-.77 1.52C21.28 20.9 16.56 23 12 23c-4.9 0-9.74-2.86-12.63-4.95a1.9 1.9 0 0 1-.77-1.53v-2.66c0-.4.13-.78.37-1.11l.72-1c.4-.53.97-.74 1.56-.78.23-2.8.85-4.9 2.25-6.42C6.15 1.95 9.7 1.5 12 1.5Zm-3.25 11a1.25 1.25 0 0 0-1.25 1.25v2.2a1.25 1.25 0 0 0 2.5 0v-2.2c0-.7-.56-1.25-1.25-1.25Zm6.5 0A1.25 1.25 0 0 0 14 13.75v2.2a1.25 1.25 0 0 0 2.5 0v-2.2c0-.7-.56-1.25-1.25-1.25ZM6.9 4.53c-1 .1-1.84.44-2.28.96-.95 1.07-.74 3.86-.19 4.45.48.47 1.2.7 1.93.7 1.02 0 2.47-.3 3.69-1.54.56-.55.9-1.9.86-3.27-.03-.98-.31-1.81-.72-2.15-.42-.37-1.38-.54-2.3-.45Zm10.2.45c-.41.34-.69 1.17-.72 2.15-.04 1.37.3 2.72.86 3.27a5.1 5.1 0 0 0 3.69 1.54c.74 0 1.46-.23 1.93-.7.56-.59.77-3.38-.18-4.45-.45-.52-1.29-.87-2.3-.97-.9-.09-1.86.08-2.28.46Z"
          />
        </svg>
      );
    default:
      return <span className="site-logo-letter">M</span>;
  }
}

function getSiteTone(host: HostName): string {
  switch (host) {
    case "chatgpt":
      return "emerald";
    case "claude":
      return "amber";
    case "gemini":
      return "violet";
    case "copilot":
      return "slate";
    default:
      return "indigo";
  }
}

export function App(): JSX.Element {
  const [settings, setLocalSettings] = useState<MicroReelSettings>(initialSettings);
  const [status, setStatus] = useState("Loading settings...");
  const statusTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void getSettings().then((value) => {
      setLocalSettings(value);
      setStatus("Changes save automatically");
    });

    return () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
      }
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const enabledSiteCount = supportedHosts.filter(({ id }) => settings.siteEnabled[id]).length;

  function queueSave(nextSettings: MicroReelSettings): void {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }

    setStatus("Saving...");
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void setSettings(nextSettings)
        .then(() => {
          setStatus("Saved");
          statusTimerRef.current = window.setTimeout(() => {
            setStatus("Changes save automatically");
            statusTimerRef.current = null;
          }, 1200);
        })
        .catch(() => {
          setStatus("Could not save settings");
        });
    }, 160);
  }

  function patchSettings(update: (prev: MicroReelSettings) => MicroReelSettings): void {
    setLocalSettings((prev) => {
      const next = update(prev);
      queueSave(next);
      return next;
    });
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
            <span className="stat-label">Status</span>
            <strong>{settings.enabled ? "On" : "Off"}</strong>
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

      <section className="settings">
        <section className="panel">
          <div className="panel-header">
            <p className="section-tag">Behavior</p>
            <h2>Core experience</h2>
            <p>Global rules that apply before any site-specific toggle is checked.</p>
          </div>

          <div className="toggle-row">
            <span className="copy">
              <span className="field-title">Show MicroReel</span>
              <span className="field-body">
                Turn MicroReel on or off everywhere without changing your site preferences.
              </span>
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) =>
                  patchSettings((prev) => ({
                    ...prev,
                    enabled: event.target.checked
                  }))
                }
              />
              <span className="slider"></span>
            </label>
          </div>

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
                <option value="entertainment">Entertainment (videos)</option>
                <option value="education" disabled>Education (Coming Soon)</option>
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

          <div className="toggle-row toggle-row--spaced">
            <span className="copy">
              <span className="field-title">Stop when host stops</span>
              <span className="field-body">
                Hide instantly when the AI response ends instead of letting content finish naturally.
              </span>
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.stopOnHostDone}
                onChange={(event) =>
                  patchSettings((prev) => ({
                    ...prev,
                    stopOnHostDone: event.target.checked
                  }))
                }
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="toggle-row toggle-row--spaced">
            <span className="copy">
              <span className="field-title">Mute MicroReel audio</span>
              <span className="field-body">
                Keep the extension silent even when the current tab itself is not muted.
              </span>
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.extensionMuted}
                onChange={(event) =>
                  patchSettings((prev) => ({
                    ...prev,
                    extensionMuted: event.target.checked
                  }))
                }
              />
              <span className="slider"></span>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <p className="section-tag">Coverage</p>
            <h2>Site controls</h2>
            <p>
              Keep MicroReel on, then decide which supported AI surfaces are allowed to show
              MicroReel.
            </p>
          </div>

          <div className="site-grid">
            {supportedHosts.map((host) => (
              <label
                key={host.id}
                className={`site-card site-card--${getSiteTone(host.id)} ${settings.siteEnabled[host.id] ? "is-on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={settings.siteEnabled[host.id]}
                  onChange={(event) => updateSite(host.id, event.target.checked)}
                />
                <span className="site-card-body">
                  <span className="site-head">
                    <span className="site-logo" aria-hidden="true">
                      <HostLogo host={host.id} />
                    </span>
                    <span className="site-head-copy">
                      <span className="site-title">{host.label}</span>
                      <span className="site-copy">{host.description}</span>
                    </span>
                  </span>
                  <span className={`site-chip ${settings.siteEnabled[host.id] ? "is-on" : ""}`}>
                    {settings.siteEnabled[host.id] ? "Enabled" : "Off"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <footer className="actions">
          <p className="status">
            {status === "Changes save automatically"
              ? `${enabledSiteCount} of ${supportedHosts.length} sites enabled. Changes save automatically.`
              : status}
          </p>
        </footer>
      </section>
    </main>
  );
}
