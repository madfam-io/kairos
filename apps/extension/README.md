# @kairos/extension

Browser extension for Kairos, built with Plasmo.

## Overview

The browser extension provides Chinese learning features on streaming platforms:
- Subtitle overlay with word segmentation
- Click-to-define and mining
- AI-powered simplification
- Keyboard shortcuts
- Sync with Kairos account

**Supported Platforms:**
- Netflix
- YouTube

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Plasmo](https://plasmo.com) | Extension framework |
| [React](https://react.dev) | UI components |
| [Chrome MV3](https://developer.chrome.com/docs/extensions/mv3/) | Chrome extension API |
| [Firefox WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) | Firefox compatibility |

## Quick Start

### Development

```bash
# From repository root
pnpm --filter @kairos/extension dev

# Or from this directory
cd apps/extension
pnpm dev
```

### Load in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `build/chrome-mv3-dev`

### Load in Firefox

1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `build/firefox-mv2-dev/manifest.json`

## Project Structure

```
apps/extension/
├── src/
│   ├── popup.tsx                 # Extension popup UI
│   ├── background/
│   │   ├── index.ts              # Service worker
│   │   └── messages/
│   │       ├── word-clicked.ts   # Handle word clicks
│   │       ├── mine-word.ts      # Handle mining
│   │       └── segment-text.ts   # Request segmentation
│   ├── contents/
│   │   ├── netflix.tsx           # Netflix content script
│   │   └── youtube.tsx           # YouTube content script
│   ├── components/
│   │   ├── MiningModal.tsx       # Card creation UI
│   │   ├── SubtitleOverlay.tsx   # Overlay rendering
│   │   └── WordTooltip.tsx       # Word hover tooltip
│   ├── hooks/
│   │   ├── useSubtitleObserver.ts
│   │   └── useSegmentation.ts
│   ├── store/
│   │   └── index.ts              # Plasmo storage
│   └── style.css                 # Global styles
├── assets/
│   └── icon.png                  # Extension icon
├── package.json
└── tsconfig.json
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER TAB                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐  │
│   │   Netflix     │    │   Subtitle    │    │    Mining     │  │
│   │   Content     │───▶│   Overlay     │───▶│    Modal      │  │
│   │   Script      │    │   Component   │    │   Component   │  │
│   └───────────────┘    └───────────────┘    └───────────────┘  │
│          │                                          │            │
└──────────│──────────────────────────────────────────│────────────┘
           │                                          │
           ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKGROUND SERVICE WORKER                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐  │
│   │   Message     │    │     API       │    │    Storage    │  │
│   │   Handlers    │───▶│    Client     │───▶│   (Chrome)    │  │
│   └───────────────┘    └───────────────┘    └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      KAIROS API                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Content Scripts

### Netflix (contents/netflix.tsx)

```typescript
export const config: PlasmoCSConfig = {
  matches: ['https://*.netflix.com/*'],
  world: 'MAIN',
  run_at: 'document_idle',
};
```

Features:
- Observes Netflix subtitle container
- Intercepts and enhances subtitles
- Injects overlay UI

### YouTube (contents/youtube.tsx)

```typescript
export const config: PlasmoCSConfig = {
  matches: ['https://*.youtube.com/*'],
  world: 'MAIN',
  run_at: 'document_idle',
};
```

Features:
- Observes YouTube caption container
- Handles dynamic caption updates
- Works with auto-generated captions

## Background Messages

### word-clicked

Handle when user clicks a word:

```typescript
// contents/netflix.tsx
sendToBackground({
  name: 'word-clicked',
  body: { word: '学习', sentence: '我正在学习中文' },
});

// background/messages/word-clicked.ts
export const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { word, sentence } = req.body;
  // Fetch definition from API
  const definition = await fetchDefinition(word);
  res.send({ definition });
};
```

### mine-word

Handle mining request:

```typescript
sendToBackground({
  name: 'mine-word',
  body: {
    word: '学习',
    sentence: '我正在学习中文',
    sourceTitle: 'The Untamed',
    timestamp: '01:23:45',
  },
});
```

### segment-text

Request text segmentation:

```typescript
const segments = await sendToBackground({
  name: 'segment-text',
  body: { text: '我正在学习中文' },
});
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Toggle simplification |
| `M` | Mine current word |
| `P` | Toggle pinyin |
| `R` | Replay audio |

Shortcuts only work when:
- User is not typing in an input
- Extension is active on the page

## Storage

Using Plasmo Storage (wraps Chrome storage):

```typescript
import { useStorage } from '@plasmohq/storage/hook';

function Popup() {
  const [settings] = useStorage<UserSettings>('settings');
  const [_, setSettings] = useStorage('settings');

  return (
    <button onClick={() => setSettings({ ...settings, hskLevel: 4 })}>
      Set HSK 4
    </button>
  );
}
```

## Popup UI

The extension popup (`popup.tsx`) provides:
- Login/logout
- Quick settings toggle
- Statistics summary
- Link to full app

## Permissions

Defined in `package.json`:

```json
{
  "manifest": {
    "host_permissions": [
      "https://*.netflix.com/*",
      "https://*.youtube.com/*",
      "https://api.kairos.dev/*"
    ],
    "permissions": [
      "storage",
      "activeTab"
    ]
  }
}
```

## Building

### Development

```bash
pnpm dev
```

### Production

```bash
pnpm build
```

Output:
- `build/chrome-mv3-prod/` - Chrome extension
- `build/firefox-mv2-prod/` - Firefox extension

### Package for Stores

```bash
# Chrome
cd build/chrome-mv3-prod
zip -r ../kairos-chrome.zip .

# Firefox
cd build/firefox-mv2-prod
zip -r ../kairos-firefox.zip .
```

## Publishing

### Chrome Web Store

1. Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Create new item
3. Upload `kairos-chrome.zip`
4. Fill listing details
5. Submit for review

### Firefox Add-ons

1. Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
2. Submit new add-on
3. Upload `kairos-firefox.zip`
4. Submit for review

## Platform Resilience

The extension is designed to handle platform changes gracefully:

```typescript
// Graceful degradation
const waitForElement = (selector: string, timeout = 10000) => {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(null); // Graceful fallback
    }, timeout);
  });
};
```

## Debugging

### Chrome

1. Open `chrome://extensions`
2. Find Kairos
3. Click "Inspect" next to "service worker"
4. For content scripts: Right-click page → Inspect → Sources → Content scripts

### Firefox

1. Open `about:debugging`
2. Click extension "Inspect"

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [Development Guide](../../docs/DEVELOPMENT.md) - Local setup
- [Deployment Guide](../../docs/DEPLOYMENT.md) - Production deployment
- [API Reference](../../docs/API.md) - Backend API
