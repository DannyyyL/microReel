const KEY = "microreel.settings";

chrome.storage.sync.get(KEY, (result) => {
  const s = result[KEY] ?? {};
  document.getElementById("enabled").checked = s.enabled !== false;
  document.getElementById("mode").value = s.mode ?? "education";
  document.getElementById("stop-on-done").checked = s.stopOnHostDone === true;
});

function save() {
  chrome.storage.sync.get(KEY, (result) => {
    const existing = result[KEY] ?? {};
    const updated = {
      ...existing,
      enabled: document.getElementById("enabled").checked,
      mode: document.getElementById("mode").value,
      stopOnHostDone: document.getElementById("stop-on-done").checked
    };
    chrome.storage.sync.set({ [KEY]: updated }, () => {
      const el = document.getElementById("saved");
      el.textContent = "Saved \u2713";
      setTimeout(() => { el.textContent = ""; }, 1200);
    });
  });
}

document.getElementById("enabled").addEventListener("change", save);
document.getElementById("mode").addEventListener("change", save);
document.getElementById("stop-on-done").addEventListener("change", save);
document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
