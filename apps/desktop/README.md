# @kairos/desktop

Desktop video player for Kairos, built with Tauri and React.

## Overview

The desktop app is the **primary platform** for Kairos, providing:
- Local video playback (.mkv, .mp4, .avi)
- Subtitle overlay with Chinese segmentation
- One-click vocabulary mining
- AI-powered sentence simplification
- Keyboard-first interface
- Offline support

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Tauri](https://tauri.app) | Desktop framework (Rust) |
| [React](https://react.dev) | UI framework |
| [React Router](https://reactrouter.com) | Navigation |
| [Vite](https://vitejs.dev) | Build tool |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| [Zustand](https://zustand-demo.pmnd.rs) | State management |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust 1.70+

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Development

```bash
# From repository root
pnpm --filter @kairos/desktop dev

# Or from this directory
cd apps/desktop
pnpm dev
```

This opens a Tauri development window with hot reload.

## Project Structure

```
apps/desktop/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Router setup
│   ├── pages/
│   │   ├── HomePage.tsx          # Library/dashboard
│   │   ├── PlayerPage.tsx        # Video player (core)
│   │   ├── VocabularyPage.tsx    # Word management
│   │   ├── LibraryPage.tsx       # Video library
│   │   └── SettingsPage.tsx      # Preferences
│   ├── components/
│   │   ├── Layout.tsx
│   │   └── player/
│   │       ├── SubtitleOverlay.tsx
│   │       ├── SubtitleSidebar.tsx
│   │       └── MiningModal.tsx
│   ├── store/
│   │   ├── vocabulary.ts
│   │   ├── video.ts
│   │   └── settings.ts
│   └── hooks/
│       ├── useVideoPlayer.ts
│       └── useSubtitles.ts
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry
│   │   └── lib.rs                # Commands
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Tauri config
│   └── icons/                    # App icons
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── package.json
└── tsconfig.json
```

## Features

### Video Player

Full-featured video player with:

- Play/pause, seek, volume control
- Keyboard shortcuts (space, arrows, m, f)
- Fullscreen support
- Subtitle track selection
- Playback speed control

### Subtitle Overlay

Chinese subtitle processing:

- Word segmentation (PaddleNLP)
- Hover for definitions
- Click to mine vocabulary
- HSK level highlighting
- Pinyin display (toggle)

### Mining Workflow

1. Click word in subtitle
2. Mining modal opens with:
   - Word, pinyin, definitions
   - Full sentence context
   - AI-simplified version
   - Screenshot capture
   - Audio clip
3. Click "Mine" to save card
4. Export to Anki later

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play/pause |
| `←` / `→` | Seek ±5s |
| `↑` / `↓` | Volume ±10% |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `S` | Toggle simplification |
| `P` | Toggle pinyin |
| `Esc` | Exit fullscreen / Go back |

## Pages

### HomePage

Dashboard showing:
- Recent videos
- Learning statistics
- Quick actions

### PlayerPage

Core video player with:
- Video element
- Subtitle overlay
- Control bar
- Mining modal
- Subtitle sidebar

### VocabularyPage

Word management:
- Search and filter
- Status updates
- Bulk actions
- Export options

### LibraryPage

Video library:
- Folder browser
- Recent files
- Drag and drop

### SettingsPage

User preferences:
- HSK level
- Display options
- Keyboard shortcuts
- Account settings

## State Management

### Video Store

```typescript
interface VideoState {
  currentVideo: string | null;
  recentVideos: RecentVideo[];
  setCurrentVideo: (path: string) => void;
  addRecentVideo: (video: RecentVideo) => void;
}
```

### Vocabulary Store

```typescript
interface VocabularyState {
  words: Vocabulary[];
  loading: boolean;
  addWord: (word: Vocabulary) => void;
  updateWord: (id: string, updates: Partial<Vocabulary>) => void;
  deleteWord: (id: string) => void;
}
```

### Settings Store

```typescript
interface SettingsState {
  hskLevel: number;
  showPinyin: boolean;
  simplificationEnabled: boolean;
  theme: 'light' | 'dark';
  setHskLevel: (level: number) => void;
  togglePinyin: () => void;
  toggleSimplification: () => void;
}
```

## Tauri Commands

Custom Rust commands for native functionality:

```rust
// src-tauri/src/lib.rs

#[tauri::command]
fn get_video_metadata(path: &str) -> Result<VideoMetadata, String> {
    // Extract video duration, resolution, etc.
}

#[tauri::command]
fn extract_audio_clip(
    video_path: &str,
    start: f64,
    end: f64,
    output_path: &str,
) -> Result<(), String> {
    // Extract audio segment using FFmpeg
}
```

## Styling

Tailwind CSS with custom theme:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        kairos: {
          500: '#6366f1',
          600: '#4f46e5',
        },
      },
    },
  },
};
```

## Building

### Development

```bash
pnpm dev
```

### Production Build

```bash
# Build for current platform
pnpm build

# Outputs:
# - macOS: target/release/bundle/dmg/
# - Windows: target/release/bundle/msi/
# - Linux: target/release/bundle/appimage/
```

### Cross-Platform Build

Use GitHub Actions for cross-compilation:

```yaml
# .github/workflows/build-desktop.yml
jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
```

## Code Signing

### macOS

```bash
# Sign application
codesign --sign "Developer ID Application: Your Name" \
  --options runtime \
  target/release/bundle/macos/Kairos.app

# Notarize
xcrun notarytool submit Kairos.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "@keychain:AC_PASSWORD"
```

### Windows

```bash
signtool sign /f certificate.pfx /p password \
  target/release/bundle/msi/Kairos.msi
```

## Auto-Update

Tauri supports automatic updates:

```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://releases.kairos.dev/{{target}}/{{current_version}}"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ..."
    }
  }
}
```

## Debugging

### Frontend

Right-click in window → "Inspect Element" to open DevTools.

### Backend (Rust)

```bash
RUST_LOG=debug pnpm dev
```

### Logs

Logs are stored at:
- macOS: `~/Library/Logs/Kairos/`
- Windows: `%APPDATA%\Kairos\logs\`
- Linux: `~/.local/share/Kairos/logs/`

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [Development Guide](../../docs/DEVELOPMENT.md) - Local setup
- [Deployment Guide](../../docs/DEPLOYMENT.md) - Production deployment
- [packages/sync](../../packages/sync/README.md) - Sync engine
