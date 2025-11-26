import { Storage } from '@plasmohq/storage';

const storage = new Storage();

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Kairos extension installed');

    // Set default settings
    await storage.set('settings', {
      hskLevel: 4,
      showPinyin: true,
      autoPlayAudio: true,
      theme: 'dark',
      fontSize: 'medium',
      simplificationEnabled: false,
      knownWordsHidden: true,
      keyboardShortcutsEnabled: true,
      locale: 'en',
    });

    // Open welcome page
    // chrome.tabs.create({ url: 'https://kairos.dev/welcome' });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open popup (handled automatically by manifest)
});

// Listen for tab updates to inject content scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isNetflix = tab.url.includes('netflix.com');
    const isYouTube = tab.url.includes('youtube.com');

    if (isNetflix || isYouTube) {
      // Content scripts are injected automatically via manifest
      // But we can set the badge to indicate active
      chrome.action.setBadgeText({ tabId, text: '开' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#16a34a' });
    } else {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  }
});

// Export for Plasmo
export {};
