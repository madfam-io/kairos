import { useState, useEffect } from 'react';
import { useStorage } from '@plasmohq/storage/hook';
import {
  Settings,
  User,
  Zap,
  BookOpen,
  Volume2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  LogIn,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import type { HSKLevel, UserSettings, SubscriptionTier } from '@kairos/types';

import './style.css';

const DEFAULT_SETTINGS: UserSettings = {
  hskLevel: 4,
  showPinyin: true,
  autoPlayAudio: true,
  theme: 'dark',
  fontSize: 'medium',
  simplificationEnabled: false,
  knownWordsHidden: true,
  keyboardShortcutsEnabled: true,
  locale: 'en',
};

function Popup() {
  const [settings, setSettings] = useStorage<UserSettings>('settings', DEFAULT_SETTINGS);
  const [isLoggedIn, setIsLoggedIn] = useStorage<boolean>('isLoggedIn', false);
  const [userEmail, setUserEmail] = useStorage<string | null>('userEmail', null);
  const [subscriptionTier, setSubscriptionTier] = useStorage<SubscriptionTier>(
    'subscriptionTier',
    'free'
  );
  const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main');

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleLogin = () => {
    // Open login page in new tab
    chrome.tabs.create({ url: 'https://app.kairos.dev/login?extension=true' });
  };

  const handleLogout = async () => {
    setIsLoggedIn(false);
    setUserEmail(null);
    setSubscriptionTier('free');
  };

  return (
    <div className="kairos-overlay w-[360px] min-h-[400px] bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-kairos-500 to-kairos-700 flex items-center justify-center">
            <span className="text-lg font-bold">开</span>
          </div>
          <div>
            <h1 className="font-semibold text-sm">Kairos</h1>
            <p className="text-xs text-gray-400">Chinese Immersion</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('main')}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'main' ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <BookOpen size={18} />
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === 'settings' ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'main' ? (
          <MainTab
            isLoggedIn={isLoggedIn}
            userEmail={userEmail}
            subscriptionTier={subscriptionTier}
            settings={settings}
            updateSetting={updateSetting}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
        ) : (
          <SettingsTab settings={settings} updateSetting={updateSetting} />
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-2 border-t border-white/10 bg-gray-900/50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>v0.1.0</span>
          <a
            href="https://kairos.dev/help"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-gray-300 transition-colors"
          >
            Help <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

interface MainTabProps {
  isLoggedIn: boolean;
  userEmail: string | null;
  subscriptionTier: SubscriptionTier;
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  onLogin: () => void;
  onLogout: () => void;
}

function MainTab({
  isLoggedIn,
  userEmail,
  subscriptionTier,
  settings,
  updateSetting,
  onLogin,
  onLogout,
}: MainTabProps) {
  return (
    <div className="space-y-4">
      {/* Account Status */}
      <div className="bg-white/5 rounded-lg p-3">
        {isLoggedIn ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-kairos-600 flex items-center justify-center">
                <User size={20} />
              </div>
              <div>
                <p className="text-sm font-medium">{userEmail}</p>
                <p className="text-xs text-gray-400 capitalize">{subscriptionTier} Plan</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Not logged in</p>
              <p className="text-xs text-gray-400">Log in to sync & access AI features</p>
            </div>
            <button
              onClick={onLogin}
              className="flex items-center gap-2 px-3 py-2 bg-kairos-600 hover:bg-kairos-500 rounded-lg transition-colors text-sm"
            >
              <LogIn size={16} />
              Log In
            </button>
          </div>
        )}
      </div>

      {/* Quick Controls */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Quick Controls
        </h3>

        {/* HSK Level */}
        <div className="flex items-center justify-between">
          <span className="text-sm">HSK Level</span>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5, 6] as HSKLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => updateSetting('hskLevel', level)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  settings.hskLevel === level
                    ? 'bg-kairos-600 text-white'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Simplification Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-kairos-400" />
            <span className="text-sm">AI Simplification</span>
          </div>
          <ToggleSwitch
            enabled={settings.simplificationEnabled}
            onChange={(v) => updateSetting('simplificationEnabled', v)}
            disabled={subscriptionTier === 'free'}
          />
        </div>

        {/* Show Pinyin */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">Show Pinyin</span>
          </div>
          <ToggleSwitch
            enabled={settings.showPinyin}
            onChange={(v) => updateSetting('showPinyin', v)}
          />
        </div>

        {/* Hide Known Words */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings.knownWordsHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="text-sm">Hide Known Words</span>
          </div>
          <ToggleSwitch
            enabled={settings.knownWordsHidden}
            onChange={(v) => updateSetting('knownWordsHidden', v)}
          />
        </div>

        {/* Auto-play Audio */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 size={16} />
            <span className="text-sm">Auto-play Audio</span>
          </div>
          <ToggleSwitch
            enabled={settings.autoPlayAudio}
            onChange={(v) => updateSetting('autoPlayAudio', v)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold text-kairos-400">0</p>
          <p className="text-xs text-gray-400">Words Today</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold text-kairos-400">0</p>
          <p className="text-xs text-gray-400">Cards Mined</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold text-kairos-400">0</p>
          <p className="text-xs text-gray-400">Day Streak</p>
        </div>
      </div>
    </div>
  );
}

interface SettingsTabProps {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
}

function SettingsTab({ settings, updateSetting }: SettingsTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Display</h3>

      {/* Theme */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {settings.theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          <span className="text-sm">Theme</span>
        </div>
        <select
          value={settings.theme}
          onChange={(e) => updateSetting('theme', e.target.value as 'light' | 'dark' | 'system')}
          className="bg-white/10 rounded-lg px-3 py-1.5 text-sm border-none outline-none"
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Font Size */}
      <div className="flex items-center justify-between">
        <span className="text-sm">Subtitle Size</span>
        <select
          value={settings.fontSize}
          onChange={(e) =>
            updateSetting('fontSize', e.target.value as 'small' | 'medium' | 'large')
          }
          className="bg-white/10 rounded-lg px-3 py-1.5 text-sm border-none outline-none"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">
        Behavior
      </h3>

      {/* Keyboard Shortcuts */}
      <div className="flex items-center justify-between">
        <span className="text-sm">Keyboard Shortcuts</span>
        <ToggleSwitch
          enabled={settings.keyboardShortcutsEnabled}
          onChange={(v) => updateSetting('keyboardShortcutsEnabled', v)}
        />
      </div>

      {/* Keyboard Shortcuts Help */}
      {settings.keyboardShortcutsEnabled && (
        <div className="bg-white/5 rounded-lg p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-400">Toggle simplified</span>
            <kbd className="bg-white/10 px-1.5 py-0.5 rounded">S</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Mine current word</span>
            <kbd className="bg-white/10 px-1.5 py-0.5 rounded">M</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Toggle pinyin</span>
            <kbd className="bg-white/10 px-1.5 py-0.5 rounded">P</kbd>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Replay audio</span>
            <kbd className="bg-white/10 px-1.5 py-0.5 rounded">R</kbd>
          </div>
        </div>
      )}

      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Data</h3>

      {/* Export/Import */}
      <div className="flex gap-2">
        <button className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
          Export Data
        </button>
        <button className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
          Import Data
        </button>
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-kairos-600' : 'bg-white/20'}`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default Popup;
