import { useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Type,
  Languages,
  Play,
  Cloud,
  RotateCcw,
  LogOut,
  User,
} from 'lucide-react';
import clsx from 'clsx';

import {
  useSettingsStore,
  type Theme,
  type SubtitlePosition,
  type HSKLevel,
} from '~/store/settings';

export function SettingsPage() {
  const settings = useSettingsStore();
  const [activeSection, setActiveSection] = useState<string>('appearance');

  const sections = [
    { id: 'appearance', label: 'Appearance', icon: <Sun size={18} /> },
    { id: 'learning', label: 'Learning', icon: <Languages size={18} /> },
    { id: 'playback', label: 'Playback', icon: <Play size={18} /> },
    { id: 'account', label: 'Account', icon: <User size={18} /> },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  activeSection === section.id
                    ? 'bg-kairos-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl">
          {activeSection === 'appearance' && (
            <AppearanceSettings settings={settings} />
          )}
          {activeSection === 'learning' && (
            <LearningSettings settings={settings} />
          )}
          {activeSection === 'playback' && (
            <PlaybackSettings settings={settings} />
          )}
          {activeSection === 'account' && (
            <AccountSettings settings={settings} />
          )}
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  settings: ReturnType<typeof useSettingsStore>;
}

function AppearanceSettings({ settings }: SectionProps) {
  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun size={18} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={18} /> },
    { value: 'system', label: 'System', icon: <Monitor size={18} /> },
  ];

  const positions: { value: SubtitlePosition; label: string }[] = [
    { value: 'bottom', label: 'Bottom' },
    { value: 'top', label: 'Top' },
    { value: 'side', label: 'Side Panel' },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-medium mb-4">Theme</h3>
        <div className="flex gap-2">
          {themes.map((theme) => (
            <button
              key={theme.value}
              onClick={() => settings.setTheme(theme.value)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                settings.theme === theme.value
                  ? 'bg-kairos-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700'
              )}
            >
              {theme.icon}
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium mb-4">Subtitle Font Size</h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={12}
            max={48}
            value={settings.fontSize}
            onChange={(e) => settings.setFontSize(Number(e.target.value))}
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <Type size={18} />
            <span className="w-12 text-right">{settings.fontSize}px</span>
          </div>
        </div>
        <p
          className="mt-4 text-center bg-gray-800 rounded-lg p-4"
          style={{ fontSize: settings.fontSize }}
        >
          你好世界
        </p>
      </div>

      <div className="card">
        <h3 className="font-medium mb-4">Subtitle Position</h3>
        <div className="flex gap-2">
          {positions.map((pos) => (
            <button
              key={pos.value}
              onClick={() => settings.setSubtitlePosition(pos.value)}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors',
                settings.subtitlePosition === pos.value
                  ? 'bg-kairos-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700'
              )}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LearningSettings({ settings }: SectionProps) {
  const hskLevels: HSKLevel[] = [1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-medium mb-4">Target HSK Level</h3>
        <p className="text-sm text-gray-400 mb-4">
          Words above this level will be highlighted and eligible for simplification.
        </p>
        <div className="flex gap-2">
          {hskLevels.map((level) => (
            <button
              key={level}
              onClick={() => settings.setTargetHSKLevel(level)}
              className={clsx(
                'w-12 h-12 rounded-lg font-medium transition-colors',
                settings.targetHSKLevel === level
                  ? 'bg-kairos-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700'
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-medium">Display Options</h3>

        <ToggleSetting
          label="Show Pinyin"
          description="Display pinyin pronunciation above Chinese characters"
          checked={settings.showPinyin}
          onChange={settings.setShowPinyin}
        />

        <ToggleSetting
          label="Show Definitions"
          description="Show English definitions in tooltips"
          checked={settings.showDefinitions}
          onChange={settings.setShowDefinitions}
        />

        <ToggleSetting
          label="Highlight Unknown Words"
          description="Highlight words not in your vocabulary"
          checked={settings.highlightUnknown}
          onChange={settings.setHighlightUnknown}
        />

        <ToggleSetting
          label="Auto-Simplify"
          description="Automatically simplify sentences above your HSK level"
          checked={settings.autoSimplify}
          onChange={settings.setAutoSimplify}
        />
      </div>
    </div>
  );
}

function PlaybackSettings({ settings }: SectionProps) {
  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h3 className="font-medium">Playback Behavior</h3>

        <ToggleSetting
          label="Auto-Pause on New Subtitle"
          description="Pause playback when a new subtitle appears"
          checked={settings.autoPause}
          onChange={settings.setAutoPause}
        />

        <ToggleSetting
          label="Pause on Unknown Words"
          description="Pause when a subtitle contains unknown words"
          checked={settings.pauseOnUnknown}
          onChange={settings.setPauseOnUnknown}
        />
      </div>

      <div className="card">
        <h3 className="font-medium mb-4">Repeat Count</h3>
        <p className="text-sm text-gray-400 mb-4">
          Number of times to repeat a subtitle section when using the repeat feature.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => settings.setRepeatCount(settings.repeatCount - 1)}
            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            disabled={settings.repeatCount <= 1}
          >
            -
          </button>
          <span className="w-8 text-center text-xl font-medium">
            {settings.repeatCount}
          </span>
          <button
            onClick={() => settings.setRepeatCount(settings.repeatCount + 1)}
            className="w-10 h-10 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            disabled={settings.repeatCount >= 10}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountSettings({ settings }: SectionProps) {
  const isLoggedIn = !!settings.accessToken;

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-medium mb-4">Account</h3>
        {isLoggedIn ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-kairos-600 flex items-center justify-center">
                <User size={24} />
              </div>
              <div>
                <p className="font-medium">Connected</p>
                <p className="text-sm text-gray-400">Your data is synced to the cloud</p>
              </div>
            </div>
            <button
              onClick={() => settings.setAccessToken(null)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400">
              Sign in to sync your vocabulary and progress across devices.
            </p>
            <button className="flex items-center gap-2 px-4 py-2 bg-kairos-600 hover:bg-kairos-500 rounded-lg transition-colors">
              <Cloud size={18} />
              Sign In
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-medium mb-4">API Settings</h3>
        <label className="block">
          <span className="text-sm text-gray-400">API URL</span>
          <input
            type="text"
            value={settings.apiUrl}
            onChange={(e) => settings.setApiUrl(e.target.value)}
            className="mt-1 w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-kairos-600"
          />
        </label>
      </div>

      <div className="card">
        <h3 className="font-medium mb-4">Reset Settings</h3>
        <p className="text-sm text-gray-400 mb-4">
          Reset all settings to their default values. This won't affect your vocabulary or cards.
        </p>
        <button
          onClick={settings.resetSettings}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RotateCcw size={18} />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={clsx(
          'w-12 h-6 rounded-full transition-colors relative',
          checked ? 'bg-kairos-600' : 'bg-gray-700'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
            checked ? 'left-7' : 'left-1'
          )}
        />
      </button>
    </div>
  );
}
