import type { PlasmoCSConfig, PlasmoGetOverlayAnchor } from 'plasmo';
import { useEffect, useState, useCallback } from 'react';
import { useStorage } from '@plasmohq/storage/hook';
import { sendToBackground } from '@plasmohq/messaging';

import { SubtitleOverlay } from '~/components/SubtitleOverlay';
import { useSubtitleObserver } from '~/hooks/useSubtitleObserver';
import type { UserSettings } from '@kairos/types';

import '~/style.css';

export const config: PlasmoCSConfig = {
  matches: ['https://*.netflix.com/*'],
  world: 'MAIN',
  run_at: 'document_idle',
};

// Mount overlay inside Netflix's video container
export const getOverlayAnchor: PlasmoGetOverlayAnchor = async () => {
  // Wait for Netflix player to load
  const waitForElement = (selector: string, timeout = 10000): Promise<Element | null> => {
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
        resolve(null);
      }, timeout);
    });
  };

  // Netflix video player container
  const videoContainer = await waitForElement('.watch-video--player-view');
  return videoContainer;
};

// Overlay styles to position correctly over Netflix
export const getStyle = () => {
  const style = document.createElement('style');
  style.textContent = `
    .plasmo-csui-container {
      position: absolute !important;
      bottom: 100px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
    }
    .plasmo-csui-container > * {
      pointer-events: auto !important;
    }
  `;
  return style;
};

function NetflixOverlay() {
  const [settings] = useStorage<UserSettings>('settings');
  const [isActive, setIsActive] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

  // Observe Netflix subtitle changes
  const { subtitleText, isVisible } = useSubtitleObserver({
    platform: 'netflix',
    selector: '.player-timedtext-text-container',
  });

  useEffect(() => {
    if (subtitleText) {
      setCurrentSubtitle(subtitleText);
    }
  }, [subtitleText]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!settings?.keyboardShortcutsEnabled) return;

    const handleKeydown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 's':
          // Toggle simplification
          sendToBackground({
            name: 'toggle-simplification',
          });
          break;
        case 'm':
          // Mine current word (if one is selected)
          sendToBackground({
            name: 'mine-word',
            body: { subtitle: currentSubtitle },
          });
          break;
        case 'p':
          // Toggle pinyin
          sendToBackground({
            name: 'toggle-pinyin',
          });
          break;
        case 'r':
          // Replay current subtitle audio
          sendToBackground({
            name: 'replay-audio',
          });
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [settings?.keyboardShortcutsEnabled, currentSubtitle]);

  if (!isActive || !isVisible || !currentSubtitle) {
    return null;
  }

  return (
    <SubtitleOverlay
      text={currentSubtitle}
      settings={settings}
      platform="netflix"
      onWordClick={(word, sentence) => {
        sendToBackground({
          name: 'word-clicked',
          body: { word, sentence },
        });
      }}
      onMine={(word, sentence) => {
        sendToBackground({
          name: 'mine-word',
          body: { word, sentence },
        });
      }}
    />
  );
}

export default NetflixOverlay;
