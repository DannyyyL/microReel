# microreel

Browser extension MVP that shows micro-learning cards while ChatGPT or Claude is generating.

## What is implemented

- Manifest V3 extension architecture
- Content script with mutation-observer based generation detection
- Host adapters for ChatGPT and Claude
- Micro-content engine with card rotation and no-repeat window
- Overlay renderer (top-right or side-right)
- Background service worker event coordinator with badge state
- React options page backed by `chrome.storage.sync`

## Run locally

1. Install deps:

   ```bash
   npm install
   ```

2. Build:

   ```bash
   npm run build
   ```

3. Load extension:

   - Open Chrome `chrome://extensions`
   - Enable Developer mode
   - Click **Load unpacked**
   - Select the `dist` folder

4. Open ChatGPT or Claude and prompt once.

## Notes

- Phase 1 is fully local-first: no backend and no prompt telemetry.
- DOM selectors may require tuning as host UIs change over time.