# @kairos/mobile

Mobile app for Kairos, built with React Native and Expo.

## Overview

The mobile app provides:
- Vocabulary review with spaced repetition (SRS)
- Progress tracking and statistics
- Shadowing practice with pitch visualization
- Cross-device synchronization
- Offline support

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [React Native](https://reactnative.dev) | Mobile framework |
| [Expo](https://expo.dev) | Development platform |
| [Expo Router](https://docs.expo.dev/router) | File-based routing |
| [Zustand](https://zustand-demo.pmnd.rs) | State management |
| [React Query](https://tanstack.com/query) | Data fetching |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Expo Go app on your device (for development)

### Development

```bash
# From repository root
pnpm --filter @kairos/mobile dev

# Or from this directory
cd apps/mobile
pnpm dev
```

This opens Expo DevTools. Scan the QR code with Expo Go.

### iOS Simulator

```bash
pnpm ios
```

### Android Emulator

```bash
pnpm android
```

## Project Structure

```
apps/mobile/
├── src/
│   ├── app/                      # Expo Router pages
│   │   ├── (auth)/               # Auth stack
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx
│   │   │   └── register.tsx
│   │   ├── (tabs)/               # Tab navigation
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Dashboard
│   │   │   ├── vocabulary.tsx
│   │   │   ├── cards.tsx
│   │   │   ├── discover.tsx
│   │   │   └── settings.tsx
│   │   ├── _layout.tsx           # Root layout
│   │   ├── reader.tsx            # Reader mode
│   │   ├── review.tsx            # SRS review
│   │   ├── shadowing.tsx         # Pitch practice
│   │   ├── progress.tsx          # Analytics
│   │   └── subscription.tsx      # Billing
│   ├── components/
│   │   └── PitchContourGraph.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSync.ts
│   │   ├── useVocabulary.ts
│   │   ├── useCards.ts
│   │   ├── useSpeech.ts
│   │   ├── usePitch.ts
│   │   ├── useReader.ts
│   │   ├── useAnalytics.ts
│   │   └── useStats.ts
│   └── providers/
│       ├── AuthProvider.tsx
│       └── ThemeProvider.tsx
├── assets/
├── app.json                      # Expo configuration
├── eas.json                      # EAS Build configuration
├── package.json
└── tsconfig.json
```

## Navigation

### Auth Flow

```
(auth)
├── login       # Email/password login
└── register    # Create account
```

### Main App

```
(tabs)
├── index       # Dashboard with stats
├── vocabulary  # Word list and management
├── cards       # Flashcard browser
├── discover    # Content discovery
└── settings    # User preferences

Standalone screens:
├── review      # SRS review session
├── shadowing   # Pitch practice
├── progress    # Analytics dashboard
├── reader      # Text reader mode
└── subscription # Billing/upgrade
```

## Features

### Dashboard

- Learning streak tracking
- Due card count
- Quick access to review
- Recent activity

### Vocabulary Review

SM-2 spaced repetition algorithm:

```typescript
// Quality ratings
0 - Complete blackout
1 - Incorrect, remembered after seeing answer
2 - Incorrect, easy recall after seeing answer
3 - Correct with difficulty
4 - Correct with hesitation
5 - Perfect recall
```

### Shadowing Practice

Real-time pitch visualization:

1. Listen to reference audio
2. Record your voice
3. See pitch contour comparison
4. Get tone accuracy feedback

### Offline Support

- Vocabulary and cards cached locally
- Reviews work offline
- Sync when online with CRDT

## Hooks

### useAuth

```typescript
const { user, isAuthenticated, login, logout } = useAuth();
```

### useVocabulary

```typescript
const {
  vocabulary,
  isLoading,
  addWord,
  updateWord,
  deleteWord,
} = useVocabulary();
```

### usePitch

```typescript
const {
  comparePitch,
  analyzeTone,
  loading,
} = usePitch();

// Compare user recording to reference
const result = await comparePitch(referenceUri, userRecordingUri);
console.log(result.similarity); // 0-1
```

### useSync

```typescript
const {
  status,
  pendingCount,
  isOnline,
  syncNow,
} = useSyncStatus();
```

## Styling

We use React Native StyleSheet with a consistent design system:

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a', // Dark theme
  },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
  },
  primaryButton: {
    backgroundColor: '#6366f1', // Kairos purple
    borderRadius: 12,
    padding: 16,
  },
});
```

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#0a0a0a` | Screen background |
| Card | `#1f2937` | Card backgrounds |
| Primary | `#6366f1` | Buttons, accents |
| Success | `#22c55e` | Positive indicators |
| Warning | `#f59e0b` | Warnings |
| Error | `#ef4444` | Errors |
| Text | `#ffffff` | Primary text |
| Muted | `#9ca3af` | Secondary text |

## Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## Building

### Development Build

```bash
# iOS
eas build --platform ios --profile development

# Android
eas build --platform android --profile development
```

### Production Build

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

### Submit to Stores

```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

## OTA Updates

Push JavaScript updates without store review:

```bash
eas update --branch production --message "Bug fixes"
```

## Environment Variables

Set in `eas.json` or EAS Secrets:

```json
{
  "build": {
    "production": {
      "env": {
        "API_URL": "https://api.kairos.dev",
        "SENTRY_DSN": "..."
      }
    }
  }
}
```

## Debugging

### React Native Debugger

Press `j` in Expo CLI to open debugger.

### Flipper

Install [Flipper](https://fbflipper.com/) for advanced debugging:
- Network inspector
- Layout inspector
- React DevTools

### Logs

```bash
# View device logs
npx react-native log-ios
npx react-native log-android
```

## Related Documentation

- [Architecture](../../docs/ARCHITECTURE.md) - System design
- [Development Guide](../../docs/DEVELOPMENT.md) - Local setup
- [Deployment Guide](../../docs/DEPLOYMENT.md) - Production deployment
- [packages/sync](../../packages/sync/README.md) - Sync engine
