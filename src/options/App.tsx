import { FormEvent, useEffect, useState } from "react";
import { defaultSettings, getSettings, setSettings } from "../shared/settings";
import { MicroReelSettings } from "../shared/types";

export function App(): JSX.Element {
  const [settings, setLocalSettings] = useState<MicroReelSettings>(defaultSettings);
  const [status, setStatus] = useState("Ready");

  useEffect(() => {
    void getSettings().then((value) => setLocalSettings(value));
  }, []);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await setSettings(settings);
    setStatus("Saved");
    window.setTimeout(() => setStatus("Ready"), 1200);
  }

  return (
    <main className="page">
      <h1>microreel settings</h1>
      <p className="hint">Privacy-first mode: prompt content is not sent to any backend in Phase 1.</p>
      <form className="card" onSubmit={onSubmit}>
        <div className="row">
          <label htmlFor="enabled">Enable overlay</label>
          <input
            id="enabled"
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) =>
              setLocalSettings((prev) => ({
                ...prev,
                enabled: event.target.checked
              }))
            }
          />
        </div>

        <div className="row">
          <label htmlFor="mode">Content mode</label>
          <select
            id="mode"
            value={settings.mode}
            onChange={(event) =>
              setLocalSettings((prev) => ({
                ...prev,
                mode: event.target.value as MicroReelSettings["mode"]
              }))
            }
          >
            <option value="education">Education (tips &amp; cards)</option>
            <option value="entertainment">Entertainment (videos)</option>
          </select>
        </div>

        <div className="row">
          <label htmlFor="position">Overlay position</label>
          <select
            id="position"
            value={settings.position}
            onChange={(event) =>
              setLocalSettings((prev) => ({
                ...prev,
                position: event.target.value as MicroReelSettings["position"]
              }))
            }
          >
            <option value="top-right">Top right</option>
            <option value="side-right">Side panel right</option>
          </select>
        </div>

        <div className="row">
          <label htmlFor="delay">Start delay (ms)</label>
          <input
            id="delay"
            type="number"
            min={250}
            max={10000}
            value={settings.startDelayMs}
            onChange={(event) =>
              setLocalSettings((prev) => ({
                ...prev,
                startDelayMs: Number(event.target.value)
              }))
            }
          />
        </div>

        <div className="row">
          <label htmlFor="rotation">Card rotation (ms)</label>
          <input
            id="rotation"
            type="number"
            min={3000}
            max={30000}
            value={settings.rotationMs}
            onChange={(event) =>
              setLocalSettings((prev) => ({
                ...prev,
                rotationMs: Number(event.target.value)
              }))
            }
          />
        </div>

        <p className="hint">Status: {status}</p>

        <div className="actions">
          <button type="submit">Save settings</button>
        </div>
      </form>
    </main>
  );
}
